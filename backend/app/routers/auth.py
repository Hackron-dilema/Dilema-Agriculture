"""
Authentication router - OTP-based phone login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import FarmerDB
from ..auth import (
    OTPRequest, OTPVerify, Token,
    generate_otp, verify_otp, create_access_token
)

router = APIRouter()


@router.post("/request-otp", response_model=dict)
async def request_otp(request: OTPRequest):
    """
    Request OTP for phone number.
    In development, OTP is always '123456'.
    """
    otp = generate_otp(request.phone)
    
    # In production, send OTP via SMS
    # For development, just return success
    return {
        "success": True,
        "message": "OTP sent successfully",
        "phone": request.phone,
        # Remove this in production!
        "dev_otp": otp
    }


@router.post("/verify-otp", response_model=Token)
async def verify_otp_endpoint(
    request: OTPVerify,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OTP and return JWT token.
    Creates new farmer if first time login.
    """
    if not verify_otp(request.phone, request.otp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP"
        )
    
    # Check if farmer exists
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.phone == request.phone)
    )
    farmer = result.scalar_one_or_none()
    
    is_new_user = farmer is None
    farmer_id = farmer.id if farmer else None
    
    # Create JWT token
    token_data = {"sub": request.phone}
    if farmer_id:
        token_data["farmer_id"] = farmer_id
    
    access_token = create_access_token(token_data)
    
    return Token(
        access_token=access_token,
        farmer_id=farmer_id,
        is_new_user=is_new_user
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    phone: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh JWT token."""
    result = await db.execute(
        select(FarmerDB).where(FarmerDB.phone == phone)
    )
    farmer = result.scalar_one_or_none()
    
    token_data = {"sub": phone}
    if farmer:
        token_data["farmer_id"] = farmer.id
    
    access_token = create_access_token(token_data)
    
    return Token(
        access_token=access_token,
        farmer_id=farmer.id if farmer else None,
        is_new_user=farmer is None
    )
