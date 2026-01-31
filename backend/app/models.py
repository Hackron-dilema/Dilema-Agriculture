"""
Database models for Agricultural Decision Support System.
Covers: Farmer profiles, Farm details, Crops, and Action History.
"""
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Float, Integer, DateTime, Date, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field
from enum import Enum

from .database import Base


# ============== ENUMS ==============

class Language(str, Enum):
    ENGLISH = "en"
    HINDI = "hi"
    TELUGU = "te"
    KANNADA = "kn"
    TAMIL = "ta"
    MARATHI = "mr"


class IrrigationType(str, Enum):
    RAINFED = "rainfed"
    DRIP = "drip"
    SPRINKLER = "sprinkler"
    FLOOD = "flood"
    CANAL = "canal"


class CropStage(str, Enum):
    GERMINATION = "germination"
    SEEDLING = "seedling"
    VEGETATIVE = "vegetative"
    FLOWERING = "flowering"
    FRUITING = "fruiting"
    MATURITY = "maturity"
    HARVEST = "harvest"


class ActionType(str, Enum):
    IRRIGATION = "irrigation"
    FERTILIZER = "fertilizer"
    PESTICIDE = "pesticide"
    HARVEST = "harvest"
    ADVISORY = "advisory"
    ALERT = "alert"
    QUERY = "query"


# ============== SQLAlchemy MODELS ==============

class FarmerDB(Base):
    """Farmer profile with location and preferences."""
    __tablename__ = "farmers"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="en")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    farms: Mapped[List["FarmDB"]] = relationship("FarmDB", back_populates="farmer", cascade="all, delete-orphan")


class FarmDB(Base):
    """Farm details linked to a farmer."""
    __tablename__ = "farms"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[int] = mapped_column(Integer, ForeignKey("farmers.id"), index=True)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    land_size_acres: Mapped[float] = mapped_column(Float, default=1.0)
    irrigation_type: Mapped[str] = mapped_column(String(20), default="rainfed")
    soil_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    farmer: Mapped["FarmerDB"] = relationship("FarmerDB", back_populates="farms")
    crops: Mapped[List["CropDB"]] = relationship("CropDB", back_populates="farm", cascade="all, delete-orphan")


class CropDB(Base):
    """Active crop with sowing date and current stage."""
    __tablename__ = "crops"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(Integer, ForeignKey("farms.id"), index=True)
    crop_type: Mapped[str] = mapped_column(String(50), index=True)
    variety: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sowing_date: Mapped[date] = mapped_column(Date)
    expected_harvest_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    current_stage: Mapped[str] = mapped_column(String(20), default="germination")
    accumulated_gdd: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    farm: Mapped["FarmDB"] = relationship("FarmDB", back_populates="crops")
    actions: Mapped[List["ActionHistoryDB"]] = relationship("ActionHistoryDB", back_populates="crop", cascade="all, delete-orphan")


class ActionHistoryDB(Base):
    """History of all actions, advisories, and alerts for a crop."""
    __tablename__ = "action_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crop_id: Mapped[int] = mapped_column(Integer, ForeignKey("crops.id"), index=True)
    action_type: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)
    context_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON blob of context at time of action
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    data_sources: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of sources
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    crop: Mapped["CropDB"] = relationship("CropDB", back_populates="actions")


class ChatMessageDB(Base):
    """Chat message history for context."""
    __tablename__ = "chat_messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[int] = mapped_column(Integer, ForeignKey("farmers.id"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text)
    intent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ============== PYDANTIC SCHEMAS ==============

class FarmerCreate(BaseModel):
    """Schema for creating a new farmer."""
    phone: str = Field(..., min_length=10, max_length=15)
    name: Optional[str] = None
    language: Language = Language.ENGLISH
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None


class FarmerResponse(BaseModel):
    """Schema for farmer response."""
    id: int
    phone: str
    name: Optional[str]
    language: str
    latitude: Optional[float]
    longitude: Optional[float]
    location_name: Optional[str]
    
    class Config:
        from_attributes = True


class FarmCreate(BaseModel):
    """Schema for creating a farm."""
    name: Optional[str] = None
    land_size_acres: float = Field(..., gt=0)
    irrigation_type: IrrigationType = IrrigationType.RAINFED
    soil_type: Optional[str] = None


class CropCreate(BaseModel):
    """Schema for registering a new crop."""
    crop_type: str
    variety: Optional[str] = None
    sowing_date: date


class CropResponse(BaseModel):
    """Schema for crop response."""
    id: int
    crop_type: str
    variety: Optional[str]
    sowing_date: date
    current_stage: str
    accumulated_gdd: float
    is_active: bool
    
    class Config:
        from_attributes = True


class OnboardingRequest(BaseModel):
    """Complete onboarding data from frontend."""
    phone: str
    name: Optional[str] = None
    language: Language = Language.ENGLISH
    latitude: float
    longitude: float
    location_name: Optional[str] = None
    land_size_acres: float
    irrigation_type: IrrigationType = IrrigationType.RAINFED
    crop_type: str
    sowing_date: date


class ChatMessage(BaseModel):
    """Schema for chat message."""
    content: str
    farmer_id: int


class ChatResponse(BaseModel):
    """Schema for chat response with reasoning."""
    response: str
    confidence: float
    reasoning: str
    data_sources: List[str]
    alerts: Optional[List[str]] = None


class AgentResponse(BaseModel):
    """Standard response format from all agents."""
    result: dict
    confidence: float = Field(..., ge=0, le=1)
    reasoning: str
    data_sources: List[str]
