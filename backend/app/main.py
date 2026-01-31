"""
FastAPI main application for Agricultural Decision Support System.
Chat-first, agent-based architecture.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from .database import init_db, close_db
from .routers import auth as auth_router
from .routers import profile as profile_router
from .routers import interaction as interaction_router
from .routers import auth as auth_router
from .routers import profile as profile_router
from .routers import interaction as interaction_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    # Startup
    await init_db()
    print("✅ Database initialized")
    print("🌾 Agricultural Decision Support System ready!")
    yield
    # Shutdown
    await close_db()
    print("👋 Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Agricultural Decision Support System",
    description="""
    AI-Driven Decision Support System for Farmers.
    
    A multi-agent system that provides context-aware, data-backed farming advice.
    
    ## Features
    - 🌦️ Weather-aware advisories
    - 🌱 Crop stage tracking (GDD-based)
    - ⚠️ Proactive risk alerts
    - 💬 Natural language chat interface
    
    ## Core Principles
    - LLM never makes decisions alone
    - All advice is data-backed and explainable
    - Context-aware (crop stage + weather + history)
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(profile_router.router, prefix="/api/profile", tags=["Profile"])
app.include_router(interaction_router.router, prefix="/api", tags=["Chat & Advisory"])


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "status": "healthy",
        "service": "Agricultural Decision Support System",
        "version": "1.0.0",
        "agents": [
            "Weather Intelligence",
            "Crop Stage Prediction",
            "Risk Assessment",
            "Context Manager",
            "Decision Orchestrator",
            "Conversational LLM"
        ]
    }


@app.get("/api/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "weather_api": "open-meteo",
        "llm": os.getenv("LLM_PROVIDER", "ollama")
    }
