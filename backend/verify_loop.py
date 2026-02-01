
import asyncio
from app.database import async_session_maker, init_db
from app.agents import DecisionOrchestrator
from app.models import FarmerDB, CropDB
from sqlalchemy import select, delete
from datetime import date

async def verify_loop_fix():
    await init_db()
    async with async_session_maker() as db:
        # Reset state: Clean crops and conversation state for farmer 1
        print("Cleaning up old state...")
        from app.models import FarmDB
        
        # Get farm first
        result = await db.execute(select(FarmDB).where(FarmDB.farmer_id == 1))
        farm = result.scalar_one_or_none()
        
        if farm:
            await db.execute(delete(CropDB).where(CropDB.farm_id == farm.id))
        
        from app.models import ConversationStateDB
        await db.execute(delete(ConversationStateDB).where(ConversationStateDB.farmer_id == 1))
        await db.commit()
        
        # Get farmer
        result = await db.execute(select(FarmerDB).where(FarmerDB.id == 1))
        farmer = result.scalar_one_or_none()
        
        orchestrator = DecisionOrchestrator()
        
        print("\n=== TURN 1: 'I have bugs' ===")
        r1 = await orchestrator.process_query(farmer=farmer, farm=None, crops=[], query="I have bugs in my crop", db=db)
        print(f"AI: {r1.response}")
        await db.commit()
        
        print("\n=== TURN 2: 'Corn' ===")
        r2 = await orchestrator.process_query(farmer=farmer, farm=None, crops=[], query="Corn", db=db)
        print(f"AI: {r2.response}")
        await db.commit()
        
        print("\n=== TURN 3: '2 weeks ago' ===")
        # Note: '2 weeks ago' might need the date parser to work well, checking that too
        r3 = await orchestrator.process_query(farmer=farmer, farm=None, crops=[], query="2 weeks ago", db=db)
        print(f"AI: {r3.response}")
        await db.commit()
        
        print("\n=== TURN 4: 'My leaves are yellow' (Should NOT ask about crop) ===")
        # Reload crops to mimic next request
        from app.models import FarmDB
        result = await db.execute(
            select(CropDB).join(FarmDB).where(FarmDB.farmer_id == 1).where(CropDB.is_active == True)
        )
        crops = list(result.scalars().all())
        print(f"Active Crops: {[c.crop_type for c in crops]}")
        
        # We must pass the reloaded crops as if it's a new request
        r4 = await orchestrator.process_query(farmer=farmer, farm=farm, crops=crops, query="My leaves are yellow", db=db)
        print(f"AI: {r4.response}")

asyncio.run(verify_loop_fix())
