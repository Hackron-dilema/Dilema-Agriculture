"""
Authentication module for Agricultural Decision Support System.
Simple JWT-based auth with OTP verification (mockable for development).
"""
from datetime import datetime, timedelta
from typing import Optional
import os
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-" + secrets.token_hex(16))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing (for future use if needed)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()


# ============== SCHEMAS ==============

class OTPRequest(BaseModel):
    """Request OTP for phone number."""
    phone: str


class OTPVerify(BaseModel):
    """Verify OTP and get token."""
    phone: str
    otp: str


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    farmer_id: Optional[int] = None
    is_new_user: bool = False


class TokenData(BaseModel):
    """Decoded token data."""
    phone: str
    farmer_id: Optional[int] = None


# ============== OTP STORAGE (In-memory for dev) ==============

# In production, use Redis or database
_otp_store: dict[str, tuple[str, datetime]] = {}


def generate_otp(phone: str) -> str:
    """Generate and store OTP for phone number."""
    # For development, use fixed OTP "123456"
    if os.getenv("ENVIRONMENT", "development") == "development":
        otp = "123456"
    else:
        otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store with expiry (5 minutes)
    _otp_store[phone] = (otp, datetime.utcnow() + timedelta(minutes=5))
    return otp


def verify_otp(phone: str, otp: str) -> bool:
    """Verify OTP for phone number."""
    # Development mode - accept "123456"
    if os.getenv("ENVIRONMENT", "development") == "development" and otp == "123456":
        return True
    
    stored = _otp_store.get(phone)
    if not stored:
        return False
    
    stored_otp, expiry = stored
    if datetime.utcnow() > expiry:
        del _otp_store[phone]
        return False
    
    if stored_otp == otp:
        del _otp_store[phone]
        return True
    
    return False


# ============== JWT FUNCTIONS ==============

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone = payload.get("sub")
        farmer_id = payload.get("farmer_id")
        if phone is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return TokenData(phone=phone, farmer_id=farmer_id)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# ============== DEPENDENCIES ==============

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """Dependency to get current authenticated user."""
    return decode_token(credentials.credentials)


async def get_current_farmer_id(
    token_data: TokenData = Depends(get_current_user)
) -> int:
    """Dependency to get current farmer ID."""
    if token_data.farmer_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not onboarded",
        )
    return token_data.farmer_id
