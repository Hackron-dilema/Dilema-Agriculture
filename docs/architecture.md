# System Architecture

## Overview

The AI-Driven Agricultural Decision Support System is built on a multi-agent architecture where specialized agents collaborate through a central Decision Orchestrator to provide context-aware farming advice.

## Core Components

### 1. Frontend Layer
- Chat-first interface (primary interaction method)
- Mobile-first responsive design
- WebSocket for real-time messaging
- Simple crop lifecycle timeline

### 2. API Layer (FastAPI)
- RESTful endpoints for auth, profile, chat
- WebSocket endpoint for real-time chat
- JWT-based authentication with OTP

### 3. Agent Layer

#### Decision Orchestrator (MOST IMPORTANT)
- Central coordinator for all agents
- **Deterministic logic only** - no LLM inside
- Routes queries to appropriate agents
- Resolves conflicts and prioritizes advice
- Generates proactive alerts

#### Weather Intelligence Agent
- Integrates with Open-Meteo API (free, no key)
- Converts weather data to farming impact
- Outputs: rain risk, heat stress, spray safety

#### Crop Stage Prediction Agent
- Uses Growing Degree Days (GDD) calculation
- Determines current growth stage
- Based on crop phenology tables

#### Risk Assessment Agent
- Identifies upcoming threats
- Rules: flowering+heat, maturity+rain, etc.
- Deterministic rule engine

#### Context Agent
- Manages farmer profile and farm state
- Stores crop details and action history
- Long-term memory

#### Conversational LLM Agent
- Intent extraction from farmer queries
- Response generation (explains decisions)
- **DOES NOT** make farming decisions

### 4. Data Layer
- SQLite database (can upgrade to PostgreSQL)
- Crop knowledge base (JSON)
- Weather data (Open-Meteo)

## Data Flow

```
1. Farmer sends message
2. LLM Agent extracts intent
3. Context Agent loads farm state
4. Orchestrator selects relevant agents
5. Agents fetch data and reason
6. Orchestrator makes deterministic decision
7. LLM Agent explains result to farmer
8. Action stored in context memory
```

## Agent Communication Protocol

All agents return structured JSON:

```json
{
  "result": { /* agent-specific data */ },
  "confidence": 0.85,
  "reasoning": "Short explanation",
  "data_sources": ["open-meteo", "gdd_calculation"]
}
```

## Key Design Decisions

1. **No LLM in Decision Logic**: The Orchestrator uses rules, not AI
2. **Agent Isolation**: Agents never communicate directly
3. **Free APIs Only**: Open-Meteo, Ollama (local LLM)
4. **Deterministic First**: Prefer rules over ML
5. **Explainability**: Every decision has documented reasoning
