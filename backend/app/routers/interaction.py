"""
Interaction router - Chat and advisory endpoints.
Uses Decision Orchestrator for all query processing.
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import json

from ..database import get_db
from ..models import (
    ChatMessage, ChatResponse, ChatMessageDB,
    FarmerDB, CropDB, FarmDB
)
from ..auth import get_current_farmer_id
from ..agents import DecisionOrchestrator

router = APIRouter()

# Active WebSocket connections
connections: dict[int, WebSocket] = {}


@router.post("/chat", response_model=ChatResponse)
async def process_chat_message(
    message: ChatMessage,
    db: AsyncSession = Depends(get_db)
):
    """
    Process a chat message through the Decision Orchestrator.
    Returns context-aware, data-backed response.
    """
    # Get farmer context
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.id == message.farmer_id)
    )
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    
    # Get active crops
    result = await db.execute(
        select(FarmDB).where(FarmDB.farmer_id == farmer.id)
    )
    farm = result.scalar_one_or_none()
    
    crops = []
    if farm:
        result = await db.execute(
            select(CropDB).where(
                CropDB.farm_id == farm.id,
                CropDB.is_active == True
            )
        )
        crops = result.scalars().all()
    
    # Store user message
    user_msg = ChatMessageDB(
        farmer_id=farmer.id,
        role="user",
        content=message.content
    )
    db.add(user_msg)
    
    # Process through Decision Orchestrator
    orchestrator = DecisionOrchestrator()
    response = await orchestrator.process_query(
        farmer=farmer,
        farm=farm,
        crops=crops,
        query=message.content,
        db=db
    )
    
    # Store assistant response
    assistant_msg = ChatMessageDB(
        farmer_id=farmer.id,
        role="assistant",
        content=response.response,
        intent=response.reasoning[:50] if response.reasoning else None
    )
    db.add(assistant_msg)
    
    await db.commit()
    
    return response


@router.websocket("/ws/chat/{farmer_id}")
async def websocket_chat(
    websocket: WebSocket,
    farmer_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time chat.
    """
    await websocket.accept()
    connections[farmer_id] = websocket
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Create chat message
            message = ChatMessage(
                content=message_data.get("content", ""),
                farmer_id=farmer_id
            )
            
            # Process through orchestrator
            # Get farmer context
            result = await db.execute(
                select(FarmerDB).where(FarmerDB.id == farmer_id)
            )
            farmer = result.scalar_one_or_none()
            
            if not farmer:
                await websocket.send_json({
                    "error": "Farmer not found"
                })
                continue
            
            # Get farm and crops
            result = await db.execute(
                select(FarmDB).where(FarmDB.farmer_id == farmer.id)
            )
            farm = result.scalar_one_or_none()
            
            crops = []
            if farm:
                result = await db.execute(
                    select(CropDB).where(
                        CropDB.farm_id == farm.id,
                        CropDB.is_active == True
                    )
                )
                crops = result.scalars().all()
            
            # Store user message
            user_msg = ChatMessageDB(
                farmer_id=farmer.id,
                role="user",
                content=message.content
            )
            db.add(user_msg)
            
            # Process
            orchestrator = DecisionOrchestrator()
            response = await orchestrator.process_query(
                farmer=farmer,
                farm=farm,
                crops=crops,
                query=message.content,
                db=db
            )
            
            # Store assistant response
            assistant_msg = ChatMessageDB(
                farmer_id=farmer.id,
                role="assistant",
                content=response.response
            )
            db.add(assistant_msg)
            await db.commit()
            
            # Send response
            await websocket.send_json({
                "response": response.response,
                "confidence": response.confidence,
                "reasoning": response.reasoning,
                "data_sources": response.data_sources,
                "alerts": response.alerts
            })
            
    except WebSocketDisconnect:
        if farmer_id in connections:
            del connections[farmer_id]


@router.get("/weather/{farmer_id}")
async def get_farmer_weather(
    farmer_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get current weather for farmer's location."""
    from ..utils.weather import fetch_weather, assess_farming_impact
    
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.id == farmer_id)
    )
    farmer = result.scalar_one_or_none()
    
    if not farmer or not farmer.latitude or not farmer.longitude:
        raise HTTPException(status_code=404, detail="Farmer location not found")
    
    weather = await fetch_weather(farmer.latitude, farmer.longitude)
    impact = assess_farming_impact(weather)
    
    return {
        "current": weather.current.model_dump(),
        "forecast": [f.model_dump() for f in weather.forecast_7day],
        "farming_impact": impact.model_dump()
    }


@router.get("/crop-status/{farmer_id}")
async def get_crop_status(
    farmer_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get current status of farmer's crops."""
    from ..utils.crop_data import get_stage_progress, get_crop_info
    from ..utils.gdd import estimate_gdd_from_average
    from ..utils.weather import fetch_weather
    from datetime import date
    
    # Get farmer
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.id == farmer_id)
    )
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    
    # Get farm and crops
    result = await db.execute(
        select(FarmDB).where(FarmDB.farmer_id == farmer.id)
    )
    farm = result.scalar_one_or_none()
    
    if not farm:
        return {"crops": []}
    
    result = await db.execute(
        select(CropDB).where(CropDB.farm_id == farm.id, CropDB.is_active == True)
    )
    crops = result.scalars().all()
    
    # Get weather for GDD estimation
    weather = None
    if farmer.latitude and farmer.longitude:
        try:
            weather = await fetch_weather(farmer.latitude, farmer.longitude)
        except:
            pass
    
    crop_statuses = []
    for crop in crops:
        # Estimate GDD if we have weather
        if weather and weather.forecast_7day:
            avg_max = sum(f.temp_max for f in weather.forecast_7day) / len(weather.forecast_7day)
            avg_min = sum(f.temp_min for f in weather.forecast_7day) / len(weather.forecast_7day)
            gdd_result = estimate_gdd_from_average(
                crop.sowing_date,
                avg_max,
                avg_min,
                crop.crop_type
            )
            accumulated_gdd = gdd_result.accumulated_gdd
        else:
            accumulated_gdd = crop.accumulated_gdd
        
        # Get stage progress
        progress = get_stage_progress(crop.crop_type, accumulated_gdd)
        crop_info = get_crop_info(crop.crop_type)
        
        crop_statuses.append({
            "id": crop.id,
            "crop_type": crop.crop_type,
            "sowing_date": crop.sowing_date.isoformat(),
            "days_since_sowing": (date.today() - crop.sowing_date).days,
            "accumulated_gdd": accumulated_gdd,
            "stage": progress.get("current_stage", "unknown"),
            "stage_progress": progress.get("stage_progress", 0),
            "overall_progress": progress.get("overall_progress", 0),
            "water_need": progress.get("water_need", "unknown"),
            "crop_name": crop_info.name if crop_info else crop.crop_type
        })
    
    return {"crops": crop_statuses}


@router.get("/history/{farmer_id}")
async def get_chat_history(
    farmer_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get recent chat history for a farmer."""
    result = await db.execute(
        select(ChatMessageDB)
        .where(ChatMessageDB.farmer_id == farmer_id)
        .order_by(ChatMessageDB.created_at.desc())
        .limit(limit)
    )
    messages = result.scalars().all()
    
    return {
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.created_at.isoformat()
            }
            for msg in reversed(messages)
        ]
    }
