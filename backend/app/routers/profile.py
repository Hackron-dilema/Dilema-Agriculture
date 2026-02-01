"""
Profile router - Farmer onboarding and profile management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from ..database import get_db
from ..models import (
    FarmerDB, FarmDB, CropDB,
    FarmerCreate, FarmerResponse, FarmCreate, CropCreate, CropResponse,
    OnboardingRequest
)
from ..auth import get_current_user, TokenData, create_access_token

router = APIRouter()


@router.post("/onboard", response_model=dict)
async def complete_onboarding(
    request: OnboardingRequest,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Complete farmer onboarding with all required data.
    Creates farmer, farm, and first crop in one transaction.
    """
    # Verify phone matches token
    if token_data.phone != request.phone:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone number mismatch"
        )
    
    # Check if farmer already exists
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.phone == request.phone)
    )
    existing_farmer = result.scalar_one_or_none()
    
    if existing_farmer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Farmer already onboarded"
        )
    
    # Create farmer
    farmer = FarmerDB(
        phone=request.phone,
        name=request.name,
        language=request.language.value,
        latitude=request.latitude,
        longitude=request.longitude,
        location_name=request.location_name
    )
    db.add(farmer)
    await db.flush()  # Get farmer ID
    
    # Create farm
    farm = FarmDB(
        farmer_id=farmer.id,
        name="My Farm",
        land_size_acres=request.land_size_acres,
        irrigation_type=request.irrigation_type.value
    )
    db.add(farm)
    await db.flush()  # Get farm ID
    
    # Create first crop
    crop = CropDB(
        farm_id=farm.id,
        crop_type=request.crop_type.lower(),
        sowing_date=request.sowing_date,
        current_stage="germination"
    )
    db.add(crop)
    
    await db.commit()
    await db.refresh(farmer)
    await db.refresh(farm)
    await db.refresh(crop)
    
    # Generate new token with farmer_id
    new_token = create_access_token({
        "sub": request.phone,
        "farmer_id": farmer.id
    })
    
    return {
        "success": True,
        "farmer_id": farmer.id,
        "farm_id": farm.id,
        "crop_id": crop.id,
        "access_token": new_token,
        "message": "Onboarding complete! You can now start chatting."
    }


# Pydantic model for basic onboarding (no crop required)
from pydantic import BaseModel
from typing import Optional
from enum import Enum

class LanguageCode(str, Enum):
    """Supported languages."""
    ENGLISH = "en"
    HINDI = "hi"
    TELUGU = "te"
    KANNADA = "kn"
    TAMIL = "ta"
    MARATHI = "mr"
    PUNJABI = "pa"
    GUJARATI = "gu"
    BENGALI = "bn"
    MALAYALAM = "ml"

class BasicOnboardingRequest(BaseModel):
    """Basic onboarding - without crop data (AI will ask)."""
    phone: str
    name: Optional[str] = None
    language: str = "en"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    land_size_acres: Optional[float] = None
    irrigation_type: Optional[str] = None


@router.post("/basic-onboard", response_model=dict)
async def basic_onboarding(
    request: BasicOnboardingRequest,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Basic onboarding - creates farmer profile without crop.
    Crop information will be collected conversationally by the AI.
    """
    # Verify phone matches token
    if token_data.phone != request.phone:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone number mismatch"
        )
    
    # Check if farmer already exists
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.phone == request.phone)
    )
    existing_farmer = result.scalar_one_or_none()
    
    if existing_farmer:
        # Update existing farmer
        existing_farmer.language = request.language
        if request.latitude:
            existing_farmer.latitude = request.latitude
        if request.longitude:
            existing_farmer.longitude = request.longitude
        if request.location_name:
            existing_farmer.location_name = request.location_name
        if request.name:
            existing_farmer.name = request.name
        
        # Update or create farm
        result = await db.execute(
            select(FarmDB).where(FarmDB.farmer_id == existing_farmer.id)
        )
        existing_farm = result.scalar_one_or_none()
        
        if existing_farm:
            if request.land_size_acres:
                existing_farm.land_size_acres = request.land_size_acres
            if request.irrigation_type:
                existing_farm.irrigation_type = request.irrigation_type
        elif request.land_size_acres or request.irrigation_type:
            new_farm = FarmDB(
                farmer_id=existing_farmer.id,
                name="My Farm",
                land_size_acres=request.land_size_acres or 1.0,
                irrigation_type=request.irrigation_type or "rainfed"
            )
            db.add(new_farm)
        
        await db.commit()
        await db.refresh(existing_farmer)
        
        new_token = create_access_token({
            "sub": request.phone,
            "farmer_id": existing_farmer.id
        })
        
        return {
            "success": True,
            "farmer_id": existing_farmer.id,
            "access_token": new_token,
            "message": "Welcome back! Tell me about your crop."
        }
    
    # Create new farmer
    farmer = FarmerDB(
        phone=request.phone,
        name=request.name,
        language=request.language,
        latitude=request.latitude,
        longitude=request.longitude,
        location_name=request.location_name
    )
    db.add(farmer)
    await db.flush()  # Get farmer ID
    
    # Create farm with land size and water source
    farm = FarmDB(
        farmer_id=farmer.id,
        name="My Farm",
        land_size_acres=request.land_size_acres or 1.0,
        irrigation_type=request.irrigation_type or "rainfed"
    )
    db.add(farm)
    
    await db.commit()
    await db.refresh(farmer)
    
    # Generate token with farmer_id
    new_token = create_access_token({
        "sub": request.phone,
        "farmer_id": farmer.id
    })
    
    return {
        "success": True,
        "farmer_id": farmer.id,
        "access_token": new_token,
        "message": "Welcome! The AI will now ask about your farm."
    }


@router.get("/me", response_model=FarmerResponse)
async def get_my_profile(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current farmer's profile."""
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.phone == token_data.phone)
    )
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found"
        )
    
    return farmer


@router.get("/farmer/{farmer_id}", response_model=FarmerResponse)
async def get_farmer(
    farmer_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get farmer by ID."""
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.id == farmer_id)
    )
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found"
        )
    
    return farmer


@router.post("/farmer/{farmer_id}/crops", response_model=CropResponse)
async def add_crop(
    farmer_id: int,
    crop: CropCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a new crop to farmer's farm."""
    # Get farmer's farm
    result = await db.execute(
        select(FarmDB).where(FarmDB.farmer_id == farmer_id)
    )
    farm = result.scalar_one_or_none()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    # Create crop
    new_crop = CropDB(
        farm_id=farm.id,
        crop_type=crop.crop_type.lower(),
        variety=crop.variety,
        sowing_date=crop.sowing_date,
        current_stage="germination"
    )
    db.add(new_crop)
    await db.commit()
    await db.refresh(new_crop)
    
    return new_crop


@router.get("/farmer/{farmer_id}/crops", response_model=list[CropResponse])
async def get_farmer_crops(
    farmer_id: int,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all crops for a farmer."""
    # Get farmer's farm
    result = await db.execute(
        select(FarmDB).where(FarmDB.farmer_id == farmer_id)
    )
    farm = result.scalar_one_or_none()
    
    if not farm:
        return []
    
    # Get crops
    query = select(CropDB).where(CropDB.farm_id == farm.id)
    if active_only:
        query = query.where(CropDB.is_active == True)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/crops/available")
async def get_available_crops():
    """Get list of crops supported by the system."""
    from ..utils.crop_data import get_available_crops
    return {"crops": get_available_crops()}
