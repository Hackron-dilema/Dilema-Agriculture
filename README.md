# AI-Driven Agricultural Decision Support System

A production-grade, open-source, multi-agent system that provides context-aware, data-backed farming advice to farmers through a chat-first interface.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.10+-blue)

## 🌾 Features

- **Multi-Agent System**: 6 specialized agents working together
  - Weather Intelligence Agent (Open-Meteo integration)
  - Crop Stage Prediction Agent (GDD-based)
  - Risk Assessment Agent (threat detection)
  - Context Agent (farm state memory)
  - Conversational LLM Agent (intent extraction)
  - Decision Orchestrator (deterministic routing)

- **Chat-First Interface**: Natural language interaction
- **No Paid APIs**: Uses Open-Meteo (free, no API key)
- **LLM Never Decides Alone**: All decisions are data-backed
- **Explainable Advice**: Every recommendation includes reasoning

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js (optional, for serving frontend)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

Open `frontend/index.html` in a browser, or serve with:

```bash
cd frontend
python -m http.server 3000
```

Then open http://localhost:3000

## 📱 User Flow

1. **Language Selection** - Choose preferred language
2. **Phone Login** - OTP-based authentication (use 123456 for demo)
3. **Location** - GPS or manual entry
4. **Farm Setup** - Land size, irrigation type, crop, sowing date
5. **Chat Interface** - Ask questions, get advice

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Interface                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Decision Orchestrator                    │  │
│  │         (Deterministic Routing & Logic)              │  │
│  └──────────────────────────────────────────────────────┘  │
│        │           │           │           │               │
│        ▼           ▼           ▼           ▼               │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│   │ Weather │ │  Crop   │ │  Risk   │ │ Context │         │
│   │  Agent  │ │  Stage  │ │  Agent  │ │  Agent  │         │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
└─────────────────────────────────────────────────────────────┘
        │                                     │
        ▼                                     ▼
┌──────────────┐                    ┌──────────────┐
│  Open-Meteo  │                    │   SQLite DB  │
│  Weather API │                    │              │
└──────────────┘                    └──────────────┘
```

## 📁 Project Structure

```
Dilema-Agriculture/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── agents.py         # 6 MVP agents
│   │   ├── models.py         # Database models
│   │   ├── database.py       # SQLite setup
│   │   ├── auth.py           # JWT + OTP auth
│   │   ├── routers/
│   │   │   ├── auth.py       # Auth endpoints
│   │   │   ├── profile.py    # Onboarding endpoints
│   │   │   └── interaction.py # Chat endpoints
│   │   └── utils/
│   │       ├── weather.py    # Open-Meteo integration
│   │       ├── gdd.py        # GDD calculator
│   │       └── crop_data.py  # Crop knowledge base
│   ├── data/
│   │   └── crops.json        # Crop stages & rules
│   └── requirements.txt
├── frontend/
│   ├── index.html            # Main app (onboarding + chat)
│   ├── css/style.css         # Mobile-first styling
│   └── js/app.js             # Frontend logic
└── docs/
    ├── architecture.md
    └── api_endpoints.md
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/request-otp` | Request OTP |
| POST | `/api/auth/verify-otp` | Verify OTP & get token |
| POST | `/api/profile/onboard` | Complete onboarding |
| GET | `/api/profile/me` | Get current farmer |
| POST | `/api/chat` | Send chat message |
| GET | `/api/weather/{farmer_id}` | Get weather data |
| GET | `/api/crop-status/{farmer_id}` | Get crop status |

## 🌱 Supported Crops

- Rice, Wheat, Maize/Corn
- Cotton
- Tomato, Onion

## 📋 Core Design Principles

1. **LLM Never Decides Alone** - All decisions are data-backed
2. **Deterministic Orchestration** - No LLM logic in decision making
3. **Agents Are Isolated** - Communication only via Orchestrator
4. **Structured Outputs** - All agents return JSON with confidence scores
5. **Explainable** - Every recommendation includes reasoning
6. **No Paid APIs** - Uses only free services

## 🧪 Testing

```bash
cd backend
python -m pytest tests/ -v
```

## 📄 License

MIT License - see LICENSE file

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md first.
