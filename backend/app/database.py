"""
Database configuration for Agricultural Decision Support System.
Uses SQLite with async SQLAlchemy for simplicity.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

# Database URL - SQLite for development, can switch to PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/farm_advisor.db")

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency for FastAPI routes to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connection."""
    await engine.dispose()
