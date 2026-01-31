# API Endpoints

Base URL: `http://localhost:8000/api`

## Authentication

### POST /auth/request-otp
Request OTP for phone number.

**Request:**
```json
{
  "phone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "phone": "+919876543210",
  "dev_otp": "123456"  // Only in development
}
```

### POST /auth/verify-otp
Verify OTP and get JWT token.

**Request:**
```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "farmer_id": 1,
  "is_new_user": false
}
```

## Profile

### POST /profile/onboard
Complete farmer onboarding.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "phone": "+919876543210",
  "name": "Ramesh",
  "language": "en",
  "latitude": 17.385,
  "longitude": 78.486,
  "location_name": "Hyderabad",
  "land_size_acres": 5.0,
  "irrigation_type": "drip",
  "crop_type": "rice",
  "sowing_date": "2026-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "farmer_id": 1,
  "farm_id": 1,
  "crop_id": 1,
  "access_token": "eyJhbGciOi...",
  "message": "Onboarding complete!"
}
```

### GET /profile/me
Get current farmer profile.

**Headers:** `Authorization: Bearer <token>`

### GET /profile/farmer/{farmer_id}/crops
Get all crops for a farmer.

## Chat & Advisory

### POST /chat
Send a chat message and get AI response.

**Request:**
```json
{
  "content": "Should I water my rice today?",
  "farmer_id": 1
}
```

**Response:**
```json
{
  "response": "**Yes, irrigation is recommended...",
  "confidence": 0.85,
  "reasoning": "Intent: irrigation_query | Stage: vegetative | Risk: low",
  "data_sources": ["open-meteo", "gdd_calculation", "risk_rules"],
  "alerts": ["⚠️ Heat expected tomorrow"]
}
```

### WebSocket /ws/chat/{farmer_id}
Real-time chat connection.

### GET /weather/{farmer_id}
Get current weather and forecast for farmer's location.

**Response:**
```json
{
  "current": {
    "temperature": 32.5,
    "humidity": 65,
    "precipitation": 0,
    "condition": "partly_cloudy"
  },
  "forecast": [...],
  "farming_impact": {
    "rain_risk": 0.2,
    "heat_stress_risk": 0.3,
    "spray_safe": true,
    "irrigation_needed": true
  }
}
```

### GET /crop-status/{farmer_id}
Get current status of farmer's crops.

**Response:**
```json
{
  "crops": [
    {
      "id": 1,
      "crop_type": "rice",
      "sowing_date": "2026-01-15",
      "days_since_sowing": 16,
      "accumulated_gdd": 280,
      "stage": "seedling",
      "stage_progress": 0.65,
      "overall_progress": 0.18,
      "water_need": "high"
    }
  ]
}
```

## Error Responses

All errors follow this format:
```json
{
  "detail": "Error message here"
}
```

Common status codes:
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error
