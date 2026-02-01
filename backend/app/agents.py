"""
Multi-Agent System for Agricultural Decision Support.

This module contains all 6 MVP agents:
1. Weather Intelligence Agent - Converts weather data to farming impact
2. Crop Stage Prediction Agent - GDD-based stage calculation
3. Risk Assessment Agent - Threat detection
4. Context Agent - Farm state memory
5. Conversational LLM Agent - Intent extraction + explanation
6. Decision Orchestrator - Deterministic routing + conflict resolution

IMPORTANT: Agents never talk to users or each other directly.
All communication goes through the Decision Orchestrator.
All agent outputs are structured JSON.
"""
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
import json

from .models import AgentResponse, ChatResponse, FarmerDB, FarmDB, CropDB
from .utils.weather import fetch_weather, assess_farming_impact, WeatherData, FarmingImpact
from .utils.gdd import estimate_gdd_from_average, GDDResult
from .utils.crop_data import (
    get_crop_info, get_current_stage, get_stage_progress,
    get_risk_rules, CropStageInfo
)

import logging

# Configure orchestrator logging
logger = logging.getLogger("orchestrator")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("[ORCHESTRATOR] %(message)s"))
if not logger.handlers:
    logger.addHandler(handler)


# ============== INTENT-TO-CONTEXT REQUIREMENTS ==============
# Defines what context fields are required for each intent

INTENT_REQUIREMENTS = {
    "crop_planning": ["crop_type", "previous_crop", "planned_sowing_date", "location"],
    "sowing_query": ["crop_type", "location"],
    "irrigation_query": ["crop_type", "sowing_date", "location"],
    "weather_query": ["location"],
    "crop_status_query": ["crop_type", "sowing_date"],
    "harvest_query": ["crop_type", "sowing_date"],
    "pest_disease_query": ["crop_type", "sowing_date", "symptom_description"],
    "fertilizer_query": ["crop_type", "sowing_date"],
    "greeting": [],
    "general_farming": [],
    "unclear": []
}


# ============== FIELD-TO-QUESTION MAPPING ==============
# Localized questions for each missing field

FIELD_QUESTIONS = {
    "crop_type": {
        "en": "What crop are you growing (or planning to grow)?",
        "hi": "आप कौन सी फसल उगा रहे हैं (या उगाने की योजना)?",
        "te": "మీరు ఏ పంట పండిస్తున్నారు?"
    },
    "previous_crop": {
        "en": "What crop was grown on this land last season?",
        "hi": "पिछले सीज़न में इस जमीन पर कौन सी फसल थी?",
        "te": "గత సీజన్‌లో ఈ భూమిలో ఏ పంట పండింది?"
    },
    "planned_sowing_date": {
        "en": "When do you plan to sow? (e.g., 'next week', 'February 10')",
        "hi": "आप कब बोने की योजना बना रहे हैं?",
        "te": "మీరు ఎప్పుడు నాటాలని ప్లాన్ చేస్తున్నారు?"
    },
    "sowing_date": {
        "en": "When did you plant your crop?",
        "hi": "आपने फसल कब बोई थी?",
        "te": "మీరు పంటను ఎప్పుడు నాటారు?"
    },
    "location": {
        "en": "Please update your location in your profile so I can check weather for your area.",
        "hi": "कृपया अपनी प्रोफ़ाइल में स्थान अपडेट करें।",
        "te": "దయచేసి మీ ప్రొఫైల్‌లో స్థానాన్ని అప్‌డేట్ చేయండి."
    },
    "symptom_description": {
        "en": "Can you describe the symptoms you're seeing? (e.g., yellow leaves, spots, wilting)",
        "hi": "आप जो लक्षण देख रहे हैं उनका वर्णन करें?",
        "te": "మీరు చూస్తున్న లక్షణాలను వివరించగలరా?"
    }
}


# ============== BASE AGENT ==============

class BaseAgent(ABC):
    """
    Base class for all agents.
    All agents return structured JSON via AgentResponse.
    """
    
    name: str = "BaseAgent"
    
    @abstractmethod
    async def execute(self, context: dict) -> AgentResponse:
        """
        Execute agent logic and return structured response.
        
        Args:
            context: Dict containing relevant context data
            
        Returns:
            AgentResponse with result, confidence, reasoning, data_sources
        """
        pass


# ============== WEATHER INTELLIGENCE AGENT ==============

class WeatherAgent(BaseAgent):
    """
    Fetches weather data and converts to farming impact.
    Uses Open-Meteo API (free, no API key).
    """
    
    name = "WeatherIntelligenceAgent"
    
    async def execute(self, context: dict) -> AgentResponse:
        """
        Fetch weather and assess farming impact.
        
        Context requires: latitude, longitude
        """
        lat = context.get("latitude")
        lon = context.get("longitude")
        
        if not lat or not lon:
            return AgentResponse(
                result={"error": "Location not set"},
                confidence=0.0,
                reasoning="Weather data is unavailable because your location is not set in your profile. Please update your location in the Profile settings.",
                data_sources=[]
            )
        
        try:
            weather = await fetch_weather(lat, lon)
            impact = assess_farming_impact(weather)
            
            return AgentResponse(
                result={
                    "current": {
                        "temperature": weather.current.temperature,
                        "humidity": weather.current.humidity,
                        "precipitation": weather.current.precipitation,
                        "condition": weather.current.condition.value,
                        "wind_speed": weather.current.wind_speed
                    },
                    "forecast_3day": [
                        {
                            "date": f.date.isoformat(),
                            "temp_max": f.temp_max,
                            "temp_min": f.temp_min,
                            "precipitation": f.precipitation_sum,
                            "rain_probability": f.precipitation_probability
                        }
                        for f in weather.forecast_7day[:3]
                    ],
                    "farming_impact": {
                        "rain_risk": impact.rain_risk,
                        "heat_stress_risk": impact.heat_stress_risk,
                        "cold_stress_risk": impact.cold_stress_risk,
                        "spray_safe": impact.spray_safe,
                        "irrigation_needed": impact.irrigation_needed,
                        "field_work_safe": impact.field_work_safe
                    }
                },
                confidence=0.9,
                reasoning=impact.reasoning,
                data_sources=["open-meteo"]
            )
        except Exception as e:
            return AgentResponse(
                result={"error": str(e)},
                confidence=0.0,
                reasoning=f"Weather fetch failed: {str(e)}",
                data_sources=[]
            )


# ============== CROP STAGE PREDICTION AGENT ==============

class CropStageAgent(BaseAgent):
    """
    Determines current crop growth stage using GDD calculation.
    Purely deterministic - no LLM involved.
    """
    
    name = "CropStagePredictionAgent"
    
    async def execute(self, context: dict) -> AgentResponse:
        """
        Calculate crop stage based on GDD.
        
        Context requires: crop_type, sowing_date, weather_data (or avg temps)
        """
        crop_type = context.get("crop_type")
        sowing_date = context.get("sowing_date")
        weather = context.get("weather_data")
        
        if not crop_type or not sowing_date:
            return AgentResponse(
                result={"error": "Crop type and sowing date required"},
                confidence=0.0,
                reasoning="Missing required crop information",
                data_sources=[]
            )
        
        # Convert sowing_date if string
        if isinstance(sowing_date, str):
            sowing_date = date.fromisoformat(sowing_date)
        
        # Estimate GDD using weather data or averages
        if weather and "forecast_3day" in weather:
            forecasts = weather["forecast_3day"]
            avg_max = sum(f["temp_max"] for f in forecasts) / len(forecasts)
            avg_min = sum(f["temp_min"] for f in forecasts) / len(forecasts)
        else:
            # Use reasonable defaults for tropical climate
            avg_max = 32.0
            avg_min = 22.0
        
        gdd_result = estimate_gdd_from_average(
            sowing_date, avg_max, avg_min, crop_type
        )
        
        # Get stage information
        progress = get_stage_progress(crop_type, gdd_result.accumulated_gdd)
        crop_info = get_crop_info(crop_type)
        
        if not progress:
            return AgentResponse(
                result={"error": f"Unknown crop type: {crop_type}"},
                confidence=0.5,
                reasoning=f"Crop '{crop_type}' not in knowledge base, using defaults",
                data_sources=["crop_stage_agent"]
            )
        
        days_since_sowing = (date.today() - sowing_date).days
        
        return AgentResponse(
            result={
                "crop_type": crop_type,
                "sowing_date": sowing_date.isoformat(),
                "days_since_sowing": days_since_sowing,
                "accumulated_gdd": gdd_result.accumulated_gdd,
                "current_stage": progress.get("current_stage"),
                "stage_description": progress.get("stage_description"),
                "stage_progress": progress.get("stage_progress"),
                "overall_progress": progress.get("overall_progress"),
                "water_need": progress.get("water_need"),
                "nutrient_need": progress.get("nutrient_need"),
                "heat_sensitive": progress.get("heat_sensitive", False),
                "critical_temp_max": progress.get("critical_temp_max"),
                "gdd_to_next_stage": progress.get("gdd_to_next_stage")
            },
            confidence=0.85,
            reasoning=f"Stage calculated using {gdd_result.accumulated_gdd:.0f} GDD over {days_since_sowing} days",
            data_sources=["crop_stage_agent", "crop_knowledge_base"]
        )


# ============== RISK ASSESSMENT AGENT ==============

class RiskAssessmentAgent(BaseAgent):
    """
    Identifies upcoming threats based on crop stage + weather.
    Uses deterministic rules from knowledge base.
    """
    
    name = "CropRiskAssessmentAgent"
    
    async def execute(self, context: dict) -> AgentResponse:
        """
        Assess risks for the crop based on stage and weather.
        
        Context requires: crop_stage_data, weather_data
        """
        crop_stage = context.get("crop_stage_data", {})
        weather = context.get("weather_data", {})
        irrigation_type = context.get("irrigation_type", "rainfed")
        
        risks = []
        alerts = []
        
        current_stage = crop_stage.get("current_stage", "")
        heat_sensitive = crop_stage.get("heat_sensitive", False)
        critical_temp = crop_stage.get("critical_temp_max")
        
        # Weather conditions
        current = weather.get("current", {})
        temp = current.get("temperature", 25)
        forecast = weather.get("forecast_3day", [])
        farming_impact = weather.get("farming_impact", {})
        
        # Rule 1: Flowering + Heat
        if current_stage in ["flowering", "silking", "tasseling"]:
            if heat_sensitive and critical_temp:
                if temp > critical_temp:
                    risks.append({
                        "type": "heat_stress",
                        "severity": "high",
                        "message": f"Critical heat stress! Temperature ({temp}°C) exceeds safe limit ({critical_temp}°C) during {current_stage}",
                        "action": "Irrigate during hottest hours for cooling effect. Avoid field work 11am-3pm."
                    })
                    alerts.append(f"⚠️ Heat Alert: {temp}°C dangerous for {current_stage}")
                elif any(f.get("temp_max", 0) > critical_temp for f in forecast):
                    risks.append({
                        "type": "heat_forecast",
                        "severity": "medium",
                        "message": f"Heat stress expected in coming days during critical {current_stage} stage",
                        "action": "Prepare for irrigation. Monitor temperatures closely."
                    })
        
        # Rule 2: Flowering + Rain
        if current_stage in ["flowering", "silking", "pollination"]:
            rain_prob = max((f.get("rain_probability", 0) for f in forecast), default=0)
            if rain_prob > 70:
                risks.append({
                    "type": "rain_during_flowering",
                    "severity": "medium",
                    "message": f"Rain expected ({rain_prob}% probability) during flowering may affect pollination",
                    "action": "Monitor for disease after rain. Flowering timing may affect yield."
                })
        
        # Rule 3: Maturity + Rain
        if current_stage in ["maturity", "grain_filling", "boll_opening"]:
            total_rain = sum(f.get("precipitation", 0) for f in forecast)
            if total_rain > 20:
                risks.append({
                    "type": "rain_during_maturity",
                    "severity": "high",
                    "message": f"Heavy rain ({total_rain:.0f}mm) expected during {current_stage}. Risk of grain damage.",
                    "action": "Consider early harvest if crop is ready. Inspect for fungal issues after rain."
                })
                alerts.append(f"🌧️ Rain Alert: {total_rain:.0f}mm expected - protect mature crop")
        
        # Rule 4: Seedling + Cold
        if current_stage in ["germination", "seedling"]:
            if any(f.get("temp_min", 10) < 10 for f in forecast):
                risks.append({
                    "type": "cold_stress_seedling",
                    "severity": "medium",
                    "message": "Cold temperatures may slow seedling growth",
                    "action": "Provide mulch or protective covering if possible."
                })
        
        # Rule 5: Vegetative drought (rainfed)
        if current_stage == "vegetative" and irrigation_type == "rainfed":
            if farming_impact.get("irrigation_needed", False) and not any(f.get("rain_probability", 0) > 50 for f in forecast):
                risks.append({
                    "type": "drought_stress",
                    "severity": "medium",
                    "message": "Drought conditions during vegetative growth may limit yield potential",
                    "action": "Irrigate if possible. Consider foliar spray to reduce water stress."
                })
        
        # Determine overall risk level
        if any(r["severity"] == "high" for r in risks):
            overall_risk = "high"
        elif any(r["severity"] == "medium" for r in risks):
            overall_risk = "medium"
        else:
            overall_risk = "low"
        
        return AgentResponse(
            result={
                "overall_risk": overall_risk,
                "risks": risks,
                "alerts": alerts,
                "crop_stage": current_stage,
                "conditions_checked": [
                    "flowering_heat", "flowering_rain", "maturity_rain",
                    "seedling_cold", "vegetative_drought"
                ]
            },
            confidence=0.8 if risks else 0.9,
            reasoning=f"Assessed {len(risks)} risk(s) for {current_stage} stage" if risks else "No significant risks detected",
            data_sources=["risk_rules", "weather_data", "crop_stage"]
        )


# ============== CONTEXT AGENT ==============

class ContextAgent(BaseAgent):
    """
    Manages farm state and context.
    Retrieves farmer profile, crops, and history.
    Also manages conversation state for guided questioning.
    """
    
    name = "ContextFarmStateAgent"
    
    async def execute(self, context: dict) -> AgentResponse:
        """
        Load complete farm context.
        
        Context requires: farmer (FarmerDB), farm (FarmDB), crops (list[CropDB])
        """
        farmer = context.get("farmer")
        farm = context.get("farm")
        crops = context.get("crops", [])
        
        if not farmer:
            return AgentResponse(
                result={"error": "Farmer not found"},
                confidence=0.0,
                reasoning="No farmer context available",
                data_sources=[]
            )
        
        # Build context
        farmer_context = {
            "farmer_id": farmer.id,
            "name": farmer.name,
            "language": farmer.language,
            "location": {
                "latitude": farmer.latitude,
                "longitude": farmer.longitude,
                "name": farmer.location_name
            }
        }
        
        farm_context = None
        if farm:
            farm_context = {
                "farm_id": farm.id,
                "land_size_acres": farm.land_size_acres,
                "irrigation_type": farm.irrigation_type
            }
        
        crops_context = []
        primary_crop = None
        for crop in crops:
            crop_data = {
                "crop_id": crop.id,
                "crop_type": crop.crop_type,
                "variety": crop.variety,
                "sowing_date": crop.sowing_date.isoformat() if crop.sowing_date else None,
                "current_stage": crop.current_stage,
                "is_active": crop.is_active
            }
            crops_context.append(crop_data)
            if crop.is_active and not primary_crop:
                primary_crop = crop_data
        
        return AgentResponse(
            result={
                "farmer": farmer_context,
                "farm": farm_context,
                "crops": crops_context,
                "primary_crop": primary_crop,
                "has_location": bool(farmer.latitude and farmer.longitude),
                "has_active_crop": bool(primary_crop)
            },
            confidence=1.0,
            reasoning="Farm context loaded successfully",
            data_sources=["database"]
        )
    
    def get_missing_fields(
        self,
        required_fields: list[str],
        current_context: dict,
        collected_context: dict = None
    ) -> list[str]:
        """
        Check which required fields are missing from current context.
        
        Args:
            required_fields: List of field names needed for intent
            current_context: Context from execute() result
            collected_context: Previously collected answers
            
        Returns:
            List of missing field names
        """
        collected = collected_context or {}
        missing = []
        
        for field in required_fields:
            # Check if already collected
            if field in collected and collected[field]:
                continue
            
            # Check specific field sources
            if field == "crop_type":
                primary = current_context.get("primary_crop")
                if primary and primary.get("crop_type"):
                    continue
                if collected.get("crop_type"):
                    continue
                    
            elif field == "sowing_date":
                primary = current_context.get("primary_crop")
                if primary and primary.get("sowing_date"):
                    continue
                if collected.get("sowing_date"):
                    continue
                    
            elif field == "location":
                if current_context.get("has_location"):
                    continue
                    
            elif field == "previous_crop":
                # This would need history data - for now always ask
                if not collected.get("previous_crop"):
                    missing.append(field)
                continue
                
            elif field == "planned_sowing_date":
                if not collected.get("planned_sowing_date"):
                    missing.append(field)
                continue
                
            elif field == "symptom_description":
                if not collected.get("symptom_description"):
                    missing.append(field)
                continue
            
            else:
                # Unknown field - assume missing
                if not collected.get(field):
                    missing.append(field)
                continue
            
            missing.append(field)
        
        return missing
    
    async def get_conversation_state(self, farmer_id: int, db: Any) -> dict:
        """
        Retrieve active conversation state for a farmer.
        
        Returns:
            Dict with pending_intent, collected_context, missing_fields, current_question_field
            or None if no active state
        """
        from sqlalchemy import select
        from .models import ConversationStateDB
        
        result = await db.execute(
            select(ConversationStateDB).where(ConversationStateDB.farmer_id == farmer_id)
        )
        state = result.scalar_one_or_none()
        
        if not state:
            return None
        
        # Check if state is stale (> 1 hour old)
        from datetime import datetime, timedelta
        if datetime.utcnow() - state.updated_at > timedelta(hours=1):
            await self.clear_conversation_state(farmer_id, db)
            return None
        
        return {
            "pending_intent": state.pending_intent,
            "collected_context": json.loads(state.collected_context),
            "missing_fields": json.loads(state.missing_fields),
            "current_question_field": state.current_question_field
        }
    
    async def save_conversation_state(
        self,
        farmer_id: int,
        pending_intent: str,
        collected_context: dict,
        missing_fields: list[str],
        current_question_field: str,
        db: Any
    ) -> None:
        """
        Save or update conversation state.
        """
        from sqlalchemy import select
        from .models import ConversationStateDB
        
        result = await db.execute(
            select(ConversationStateDB).where(ConversationStateDB.farmer_id == farmer_id)
        )
        state = result.scalar_one_or_none()
        
        if state:
            state.pending_intent = pending_intent
            state.collected_context = json.dumps(collected_context)
            state.missing_fields = json.dumps(missing_fields)
            state.current_question_field = current_question_field
        else:
            state = ConversationStateDB(
                farmer_id=farmer_id,
                pending_intent=pending_intent,
                collected_context=json.dumps(collected_context),
                missing_fields=json.dumps(missing_fields),
                current_question_field=current_question_field
            )
            db.add(state)
        
        await db.flush()
    
    async def clear_conversation_state(self, farmer_id: int, db: Any) -> None:
        """
        Clear conversation state after context is complete.
        """
        from sqlalchemy import delete
        from .models import ConversationStateDB
        
        await db.execute(
            delete(ConversationStateDB).where(ConversationStateDB.farmer_id == farmer_id)
        )
        await db.flush()


# ============== CONVERSATIONAL LLM AGENT ==============

class ConversationalLLMAgent(BaseAgent):
    """
    Uses LLM for intent extraction and response generation.
    
    IMPORTANT: This agent ONLY:
    1. Extracts intent from farmer queries (using AI)
    2. Explains final decisions in natural language (in farmer's language)
    
    It does NOT make any decisions about farming actions.
    """
    
    name = "ConversationalLLMAgent"
    
    # Intent categories
    INTENTS = [
        "crop_planning",         # Planning to plant a new crop
        "sowing_query",          # When/how to sow
        "irrigation_query",      # Should I water?
        "pest_disease_query",    # Pest/disease symptoms
        "fertilizer_query",      # Fertilizer timing
        "harvest_query",         # When to harvest?
        "weather_query",         # What's the weather?
        "crop_status_query",     # How is my crop doing?
        "general_farming",       # General advice
        "greeting",              # Hello, hi
        "unclear"                # Cannot determine
    ]
    
    def __init__(self):
        """Initialize with LLM service."""
        from .llm_service import get_llm_service
        self.llm_service = get_llm_service()
    
    async def execute(self, context: dict) -> AgentResponse:
        """
        Extract intent and/or generate response using LLM.
        
        Context requires: 
            - query (for intent extraction)
            - language (farmer's preferred language)
            - decision_data (for response generation)
        """
        query = context.get("query")
        decision_data = context.get("decision_data")
        mode = context.get("mode", "extract_intent")
        language = context.get("language", "en")
        
        if mode == "extract_intent" and query:
            return await self._extract_intent(query, language)
        elif mode == "generate_response" and decision_data:
            return await self._generate_response(decision_data, context)
        else:
            return AgentResponse(
                result={"error": "Invalid mode or missing data"},
                confidence=0.0,
                reasoning="Need query for intent extraction or decision_data for response",
                data_sources=[]
            )
    
    async def _extract_intent(self, query: str, language: str = "en") -> AgentResponse:
        """Extract intent from natural language query using LLM."""
        try:
            # Use LLM service for intent extraction
            intent_result = await self.llm_service.extract_intent(query, language)
            
            return AgentResponse(
                result={
                    "intent": intent_result.intent,
                    "entities": intent_result.entities,
                    "original_query": query,
                    "language_detected": intent_result.language_detected
                },
                confidence=intent_result.confidence,
                reasoning=f"AI detected intent: {intent_result.intent} (lang: {intent_result.language_detected})",
                data_sources=["llm_intent_extraction"]
            )
        except Exception as e:
            # Fallback to keyword matching if LLM fails
            print(f"LLM intent extraction failed, using fallback: {e}")
            return await self._fallback_intent(query)
    
    async def _generate_response(self, decision_data: dict, context: dict) -> AgentResponse:
        """Generate human-friendly response from decision data using LLM."""
        farmer_name = context.get("farmer_name", "")
        language = context.get("language", "en")
        
        try:
            # Use LLM service for response generation in farmer's language
            response_text = await self.llm_service.generate_response(
                decision_data=decision_data,
                language=language,
                farmer_name=farmer_name
            )
            
            return AgentResponse(
                result={
                    "response": response_text,
                    "intent": decision_data.get("intent", "general_farming"),
                    "language": language
                },
                confidence=0.85,
                reasoning=f"LLM generated response in {language}",
                data_sources=["llm_response_generation"] + list(decision_data.keys())
            )
        except Exception as e:
            print(f"LLM response generation failed, using fallback: {e}")
            # Fallback to template-based response
            return await self._fallback_response(decision_data, context)
    
    async def _fallback_intent(self, query: str) -> AgentResponse:
        """Fallback keyword-based intent extraction when LLM fails."""
        query_lower = query.lower()
        
        # Detect language from script
        if any(c in query for c in "हिंदी मेरी फसल पानी खाद"):
            lang = "hi"
        elif any(c in query for c in "తెలుగు నా పంట నీరు"):
            lang = "te"
        elif any(c in query for c in "ಕನ್ನಡ ನನ್ನ ಬೆಳೆ ನೀರು"):
            lang = "kn"
        else:
            lang = "en"
        
        # Keyword matching
        if any(w in query_lower for w in ["plan", "planning", "want to plant", "want to grow", "should i plant", "what to plant"]):
            intent = "crop_planning"
        elif any(w in query_lower for w in ["sow", "sowing", "when to plant", "planting", "seed"]):
            intent = "sowing_query"
        elif any(w in query_lower for w in ["water", "irrigat", "पानी", "నీరు", "ನೀರು"]):
            intent = "irrigation_query"
        elif any(w in query_lower for w in ["weather", "rain", "मौसम", "వర్షం", "ಮಳೆ", "forecast"]):
            intent = "weather_query"
        elif any(w in query_lower for w in ["status", "how is", "कैसी", "ఎలా", "ಹೇಗೆ", "stage", "condition"]):
            intent = "crop_status_query"
        elif any(w in query_lower for w in ["harvest", "ready", "कटाई", "పంట కోత"]):
            intent = "harvest_query"
        elif any(w in query_lower for w in ["pest", "disease", "insect", "कीट", "పురుగు", "bug"]):
            intent = "pest_disease_query"
        elif any(w in query_lower for w in ["fertiliz", "खाद", "ఎరువు", "urea", "dap", "nutrient"]):
            intent = "fertilizer_query"
        elif any(w in query_lower for w in ["hello", "hi", "नमस्ते", "హలో", "help"]):
            intent = "greeting"
        else:
            intent = "general_farming"
        
        return AgentResponse(
            result={
                "intent": intent,
                "entities": {},
                "original_query": query,
                "language_detected": lang
            },
            confidence=0.6,
            reasoning=f"Fallback keyword matching: {intent}",
            data_sources=["keyword_matching"]
        )
    
    async def _fallback_response(self, decision_data: dict, context: dict) -> AgentResponse:
        """Fallback template-based response when LLM fails."""
        intent = decision_data.get("intent", "general_farming")
        weather = decision_data.get("weather", {})
        crop_stage = decision_data.get("crop_stage", {})
        risks = decision_data.get("risks", {})
        recommendation = decision_data.get("recommendation", "")
        alerts = decision_data.get("alerts", [])
        farmer_name = context.get("farmer_name", "")
        
        response_parts = []
        
        if farmer_name:
            response_parts.append(f"Hello {farmer_name}!")
        
        if intent == "irrigation_query":
            response_parts.append(self._format_irrigation_response(weather, crop_stage, recommendation))
        elif intent == "weather_query":
            response_parts.append(self._format_weather_response(weather))
        elif intent == "crop_status_query":
            response_parts.append(self._format_crop_status_response(crop_stage))
        elif intent == "harvest_query":
            response_parts.append(self._format_harvest_response(crop_stage))
        elif intent == "greeting":
            response_parts.append("How can I help you with your farming today?")
        else:
            response_parts.append(recommendation or "I'm here to help with your farming questions.")
        
        if alerts:
            response_parts.append("\n\n⚠️ **Alerts:**")
            for alert in alerts:
                response_parts.append(f"• {alert}")
        
        risk_list = risks.get("risks", [])
        if risk_list:
            response_parts.append("\n\n📋 **Things to watch:**")
            for risk in risk_list[:2]:
                response_parts.append(f"• {risk.get('message', '')}")
        
        final_response = "\n".join(response_parts)
        
        return AgentResponse(
            result={
                "response": final_response,
                "intent": intent
            },
            confidence=0.75,
            reasoning="Fallback template response",
            data_sources=list(decision_data.keys())
        )
    
    def _format_irrigation_response(self, weather: dict, crop_stage: dict, recommendation: str) -> str:
        """Format irrigation-specific response."""
        impact = weather.get("farming_impact", {})
        stage = crop_stage.get("current_stage", "")
        water_need = crop_stage.get("water_need", "medium")
        
        if impact.get("irrigation_needed"):
            if water_need == "critical":
                return f"**Yes, irrigate today.** Your crop is in {stage} stage which needs critical water. Current conditions are dry with no rain expected."
            else:
                return f"**Yes, irrigation recommended.** Your crop is in {stage} stage. No significant rain is expected in the next few days."
        elif impact.get("rain_risk", 0) > 0.5:
            return f"**Hold irrigation.** There's a {impact.get('rain_risk')*100:.0f}% chance of rain. Wait and check tomorrow."
        else:
            if water_need == "low" or water_need == "none":
                return f"**No irrigation needed.** Your crop is in {stage} stage with low water requirement."
            else:
                return f"Irrigation is optional today. Your crop is in {stage} stage with {water_need} water needs. Monitor soil moisture."
    
    def _format_weather_response(self, weather: dict) -> str:
        """Format weather information response."""
        current = weather.get("current", {})
        forecast = weather.get("forecast_3day", [])
        impact = weather.get("farming_impact", {})
        
        response = f"**Current Weather:** {current.get('temperature', '--')}°C, {current.get('condition', 'unknown')}"
        
        if forecast:
            response += "\n\n**3-Day Forecast:**"
            for f in forecast[:3]:
                response += f"\n• {f.get('date', '')}: {f.get('temp_min')}-{f.get('temp_max')}°C"
                if f.get('rain_probability', 0) > 30:
                    response += f" (Rain: {f.get('rain_probability')}%)"
        
        response += f"\n\n**For farming:** "
        if impact.get("spray_safe"):
            response += "✅ Safe for spraying. "
        else:
            response += "❌ Not ideal for spraying. "
        
        if impact.get("field_work_safe"):
            response += "✅ Field work OK."
        else:
            response += "⚠️ Avoid heavy field work."
        
        return response
    
    def _format_crop_status_response(self, crop_stage: dict) -> str:
        """Format crop status response."""
        stage = crop_stage.get("current_stage", "unknown")
        progress = crop_stage.get("overall_progress", 0)
        days = crop_stage.get("days_since_sowing", 0)
        water_need = crop_stage.get("water_need", "medium")
        nutrient_need = crop_stage.get("nutrient_need", "medium")
        
        response = f"**Your crop is in {stage.replace('_', ' ')} stage** ({progress*100:.0f}% complete)\n"
        response += f"• Days since sowing: {days}\n"
        response += f"• Water requirement: {water_need}\n"
        response += f"• Nutrient requirement: {nutrient_need}"
        
        if crop_stage.get("heat_sensitive"):
            response += f"\n\n⚠️ This stage is sensitive to heat. Critical temp: {crop_stage.get('critical_temp_max')}°C"
        
        return response
    
    def _format_harvest_response(self, crop_stage: dict) -> str:
        """Format harvest timing response."""
        stage = crop_stage.get("current_stage", "")
        progress = crop_stage.get("overall_progress", 0)
        
        if stage == "harvest":
            return "**Your crop is ready for harvest!** Check weather for dry conditions before harvesting."
        elif stage == "maturity":
            return f"**Almost there!** Your crop is in maturity stage ({progress*100:.0f}% complete). Harvest in about 1-2 weeks depending on conditions."
        else:
            remaining = (1 - progress) * 100
            return f"**Not yet ready for harvest.** Your crop is {progress*100:.0f}% through its lifecycle. Still {remaining:.0f}% to go in {stage} stage."


# ============== DECISION ORCHESTRATOR ==============

class DecisionOrchestrator:
    """
    Central coordinator for all agents.
    
    IMPORTANT:
    - All agent communication goes through this orchestrator
    - Uses deterministic logic for decisions
    - No LLM logic inside the orchestrator
    - Agents never talk to each other directly
    """
    
    def __init__(self):
        self.weather_agent = WeatherAgent()
        self.crop_stage_agent = CropStageAgent()
        self.risk_agent = RiskAssessmentAgent()
        self.context_agent = ContextAgent()
        self.llm_agent = ConversationalLLMAgent()
    
    async def process_query(
        self,
        farmer: FarmerDB,
        farm: Optional[FarmDB],
        crops: list[CropDB],
        query: str,
        db: Any,
        image: Optional[str] = None,
        language_override: Optional[str] = None
    ) -> ChatResponse:
        """
        Process a farmer query through the multi-agent system.
        
        NEW FLOW (Orchestrator-controlled):
        1. Check for pending conversation state (resume if exists)
        2. LLM extracts intent (only for new queries)
        3. Get required context for intent
        4. Check missing fields
        5. IF missing: ask ONE question, store state, return
        6. IF complete: call agents in order, make decision, respond
        7. Clear conversation state after completion
        """
        
        # Get farmer's preferred language (Prioritize message language > DB language > Default 'en')
        farmer_language = language_override if language_override else (farmer.language if farmer.language else "en")
        
        logger.info(f"Processing query for farmer {farmer.id}: '{query[:50]}...'")
        
        # 0. Handle Image Analysis if present
        if image:
            logger.info("Image detected - analyzing...")
            try:
                analysis = await self.llm_agent.llm_service.analyze_image(image)
                logger.info(f"Image analysis result: {analysis[:100]}...")
                query += f"\n\n[Analyzed Image Context]: {analysis}"
            except Exception as e:
                logger.error(f"Image analysis failed: {e}")
        
        # Step 1: Check for pending conversation state
        conversation_state = await self.context_agent.get_conversation_state(farmer.id, db)
        
        if conversation_state:
            logger.info(f"Resuming conversation: pending_intent={conversation_state['pending_intent']}")
            # We have a pending conversation - try to extract answer from user's message
            return await self._handle_pending_conversation(
                farmer=farmer,
                farm=farm,
                crops=crops,
                query=query,
                conversation_state=conversation_state,
                language=farmer_language,
                db=db
            )
        
        # Step 2: Extract intent (using LLM) - NEW QUERY
        intent_response = await self.llm_agent.execute({
            "query": query,
            "mode": "extract_intent",
            "language": farmer_language
        })
        intent_data = intent_response.result
        intent = intent_data.get("intent", "general_farming")
        detected_language = intent_data.get("language_detected", farmer_language)
        
        logger.info(f"Intent detected: {intent} (confidence: {intent_response.confidence})")
        
        # Step 3: Load current context
        context_response = await self.context_agent.execute({
            "farmer": farmer,
            "farm": farm,
            "crops": crops
        })
        context_data = context_response.result
        
        logger.info(f"Context loaded: has_location={context_data.get('has_location')}, has_crop={context_data.get('has_active_crop')}")
        
        # Step 4: Get required fields for this intent
        required_fields = INTENT_REQUIREMENTS.get(intent, [])
        
        # Also check if any entities were extracted from the query
        entities = intent_data.get("entities", {})
        collected_from_query = {}
        if entities.get("crop"):
            collected_from_query["crop_type"] = entities["crop"]
        if entities.get("symptom"):
            collected_from_query["symptom_description"] = entities["symptom"]
        
        # Step 5: Check missing fields
        missing_fields = self.context_agent.get_missing_fields(
            required_fields=required_fields,
            current_context=context_data,
            collected_context=collected_from_query
        )
        
        logger.info(f"Required: {required_fields} | Missing: {missing_fields}")
        
        # Step 6: If fields are missing, ask questions (ONE AT A TIME)
        if missing_fields:
            first_missing = missing_fields[0]
            
            # Save conversation state
            await self.context_agent.save_conversation_state(
                farmer_id=farmer.id,
                pending_intent=intent,
                collected_context=collected_from_query,
                missing_fields=missing_fields,
                current_question_field=first_missing,
                db=db
            )
            
            # Get localized question
            question = self._get_question_for_field(first_missing, farmer_language)
            
            logger.info(f"Asking question for field: {first_missing}")
            
            return ChatResponse(
                response=question,
                confidence=0.95,
                reasoning=f"Missing context: {first_missing} | Intent: {intent}",
                data_sources=["orchestrator"],
                alerts=None
            )
        
        # Step 7: Context is complete - call agents in order
        logger.info("Context complete - calling agents in order")
        
        return await self._execute_agents_and_decide(
            intent=intent,
            farmer=farmer,
            farm=farm,
            crops=crops,
            context_data=context_data,
            collected_context=collected_from_query,
            language=farmer_language,
            db=db
        )
    
    async def _handle_pending_conversation(
        self,
        farmer: FarmerDB,
        farm: Optional[FarmDB],
        crops: list[CropDB],
        query: str,
        conversation_state: dict,
        language: str,
        db: Any
    ) -> ChatResponse:
        """
        Handle user response to a pending question.
        Extract the answer, update collected context, check if more questions needed.
        """
        pending_intent = conversation_state["pending_intent"]
        collected_context = conversation_state["collected_context"]
        missing_fields = conversation_state["missing_fields"]
        current_field = conversation_state["current_question_field"]
        
        logger.info(f"Extracting answer for field: {current_field}")
        
        # Extract answer from user's message
        extracted_value = await self._extract_field_value(
            field=current_field,
            message=query,
            language=language
        )
        
        if extracted_value:
            # Store the extracted value
            collected_context[current_field] = extracted_value
            # Remove from missing
            if current_field in missing_fields:
                missing_fields.remove(current_field)
            
            logger.info(f"Extracted {current_field}={extracted_value}")
        else:
            # Couldn't extract - ask again with clarification
            logger.info(f"Could not extract value for {current_field}, asking again")
            question = self._get_question_for_field(current_field, language)
            clarification = self._get_clarification(current_field, language)
            
            return ChatResponse(
                response=f"{clarification}\n\n{question}",
                confidence=0.85,
                reasoning=f"Could not extract: {current_field}",
                data_sources=["orchestrator"],
                alerts=None
            )
        
        # Check if more fields are missing
        if missing_fields:
            next_field = missing_fields[0]
            
            # Update state
            await self.context_agent.save_conversation_state(
                farmer_id=farmer.id,
                pending_intent=pending_intent,
                collected_context=collected_context,
                missing_fields=missing_fields,
                current_question_field=next_field,
                db=db
            )
            
            question = self._get_question_for_field(next_field, language)
            
            logger.info(f"Next question for field: {next_field}")
            
            # Acknowledge previous answer and ask next question
            ack = self._get_acknowledgment(current_field, extracted_value, language)
            
            return ChatResponse(
                response=f"{ack}\n\n{question}",
                confidence=0.9,
                reasoning=f"Collected: {current_field}={extracted_value} | Next: {next_field}",
                data_sources=["orchestrator"],
                alerts=None
            )
        
        # All fields collected! Auto-save crop if applicable
        if not crops and "crop_type" in collected_context and "sowing_date" in collected_context:
            logger.info("Auto-registering new crop from collected context")
            await self._save_new_crop(farmer, collected_context, db)
            extracted_value += " (Crop Saved)"
            
        # All fields collected! Now execute agents
        logger.info("All fields collected - executing agents")
        
        # Clear conversation state
        await self.context_agent.clear_conversation_state(farmer.id, db)
        
        # Reload context (which might now include the new crop)
        context_response = await self.context_agent.execute({
            "farmer": farmer,
            "farm": farm,
            "crops": await self._reload_crops(farmer.id, db) if not crops else crops
        })
        context_data = context_response.result
        
        return await self._execute_agents_and_decide(
            intent=pending_intent,
            farmer=farmer,
            farm=farm,
            crops=crops,
            context_data=context_data,
            collected_context=collected_context,
            language=language,
            db=db
        )
    
    async def _execute_agents_and_decide(
        self,
        intent: str,
        farmer: FarmerDB,
        farm: Optional[FarmDB],
        crops: list[CropDB],
        context_data: dict,
        collected_context: dict,
        language: str,
        db: Any
    ) -> ChatResponse:
        """
        Execute agents in strict order and make deterministic decision.
        
        Order:
        1. Weather Agent
        2. Crop Stage Agent
        3. Risk Agent
        4. Decision Engine (deterministic rules)
        5. LLM explains decision
        """
        all_sources = ["orchestrator"]
        all_alerts = []
        
        # Get crop info from context or collected data
        primary_crop = context_data.get("primary_crop")
        crop_type = primary_crop.get("crop_type") if primary_crop else collected_context.get("crop_type")
        sowing_date = primary_crop.get("sowing_date") if primary_crop else collected_context.get("sowing_date")
        
        # Agent 1: Weather Agent
        logger.info("Calling Weather Agent...")
        weather_data = {}
        if context_data.get("has_location"):
            weather_response = await self.weather_agent.execute({
                "latitude": farmer.latitude,
                "longitude": farmer.longitude
            })
            weather_data = weather_response.result
            all_sources.extend(weather_response.data_sources)
            logger.info(f"Weather Agent returned: temp={weather_data.get('current', {}).get('temperature')}°C")
        else:
            logger.info("Weather Agent skipped - no location")
        
        # Agent 2: Crop Stage Agent
        logger.info("Calling Crop Stage Agent...")
        crop_stage_data = {}
        if crop_type and sowing_date:
            crop_stage_response = await self.crop_stage_agent.execute({
                "crop_type": crop_type,
                "sowing_date": sowing_date,
                "weather_data": weather_data
            })
            crop_stage_data = crop_stage_response.result
            all_sources.extend(crop_stage_response.data_sources)
            logger.info(f"Crop Stage Agent returned: stage={crop_stage_data.get('current_stage')}")
        else:
            logger.info("Crop Stage Agent skipped - no crop data")
        
        # Agent 3: Risk Agent
        logger.info("Calling Risk Agent...")
        risk_data = {}
        if crop_stage_data:
            risk_response = await self.risk_agent.execute({
                "crop_stage_data": crop_stage_data,
                "weather_data": weather_data,
                "irrigation_type": farm.irrigation_type if farm else "rainfed"
            })
            risk_data = risk_response.result
            all_sources.extend(risk_response.data_sources)
            all_alerts.extend(risk_data.get("alerts", []))
            logger.info(f"Risk Agent returned: risk_level={risk_data.get('overall_risk')}")
        else:
            logger.info("Risk Agent skipped - no crop stage data")
        
        # Decision Engine: Apply deterministic rules
        logger.info("Applying deterministic decision rules...")
        recommendation = self._make_decision(
            intent=intent,
            weather=weather_data,
            crop_stage=crop_stage_data,
            risks=risk_data,
            context=context_data,
            collected_context=collected_context
        )
        
        logger.info(f"Decision made: {recommendation[:100]}...")
        
        # LLM: Generate human-friendly response
        response_context = {
            "decision_data": {
                "intent": intent,
                "weather": weather_data,
                "crop_stage": crop_stage_data,
                "risks": risk_data,
                "recommendation": recommendation,
                "alerts": all_alerts,
                "collected_context": collected_context
            },
            "farmer_name": farmer.name,
            "language": language,
            "mode": "generate_response"
        }
        
        llm_response = await self.llm_agent.execute(response_context)
        final_response = llm_response.result.get("response")
        
        # Fallback if LLM fails
        if not final_response:
            final_response = recommendation
            if farmer.name:
                final_response = f"{farmer.name}! {recommendation}"
        
        logger.info("Response generated successfully")
        
        # Calculate overall confidence
        confidences = [0.9]  # Base confidence
        if weather_data and "error" not in weather_data:
            confidences.append(0.9)
        if crop_stage_data and "error" not in crop_stage_data:
            confidences.append(0.85)
        
        avg_confidence = sum(confidences) / len(confidences)
        
        return ChatResponse(
            response=final_response,
            confidence=avg_confidence,
            reasoning=f"Intent: {intent} | Stage: {crop_stage_data.get('current_stage', 'N/A')} | Risk: {risk_data.get('overall_risk', 'low')}",
            data_sources=list(set(all_sources)),
            alerts=all_alerts if all_alerts else None
        )
    
    def _get_question_for_field(self, field: str, language: str) -> str:
        """Get localized question for a missing field."""
        questions = FIELD_QUESTIONS.get(field, {})
        return questions.get(language, questions.get("en", f"Please provide: {field}"))
    
    def _get_clarification(self, field: str, language: str) -> str:
        """Get clarification message when extraction failed."""
        clarifications = {
            "en": "I didn't quite catch that.",
            "hi": "मुझे समझ नहीं आया।",
            "te": "నాకు అర్థం కాలేదు."
        }
        return clarifications.get(language, clarifications["en"])
    
    def _get_acknowledgment(self, field: str, value: str, language: str) -> str:
        """Get acknowledgment for collected field."""
        acks = {
            "en": f"Got it! ({value})",
            "hi": f"समझ गया! ({value})",
            "te": f"అర్థమైంది! ({value})"
        }
        return acks.get(language, acks["en"])
    
    async def _extract_field_value(self, field: str, message: str, language: str) -> Optional[str]:
        """
        Extract field value from user's message using LLM.
        """
        from .llm_service import get_llm_service
        
        llm = get_llm_service()
        
        # Try to extract the value
        if field == "crop_type":
            info = await llm.extract_crop_info(message, language)
            return info.get("crop_type")
        
        elif field == "previous_crop":
            # Use LLM to extract crop name
            prompt = f"""Extract the crop name from this message: "{message}"
Return ONLY the crop name (e.g., rice, wheat, corn) or null if not mentioned.
Response (just the crop name):"""
            response = await llm._call_llm(prompt)
            crop = response.strip().lower()
            if crop and crop != "null" and len(crop) < 50:
                return crop
            return None
        
        elif field == "planned_sowing_date" or field == "sowing_date":
            # Parse dates using LLM
            from datetime import date, timedelta
            
            message_lower = message.lower()
            today = date.today()
            
            # Quick keyword matching first
            if "next week" in message_lower:
                return (today + timedelta(days=7)).isoformat()
            elif "tomorrow" in message_lower:
                return (today + timedelta(days=1)).isoformat()
            elif "today" in message_lower:
                return today.isoformat()
            elif "yesterday" in message_lower:
                return (today - timedelta(days=1)).isoformat()
            elif "last week" in message_lower:
                return (today - timedelta(days=7)).isoformat()
            
            # Try to parse with LLM
            prompt = f"""Today is {today.isoformat()}. Extract the date from: "{message}"
Return ONLY the date in YYYY-MM-DD format or null if not mentioned.
Response:"""
            response = await llm._call_llm(prompt)
            date_str = response.strip()
            if date_str and date_str != "null" and "-" in date_str:
                try:
                    date.fromisoformat(date_str)
                    return date_str
                except:
                    pass
            return None
        
        elif field == "symptom_description":
            # Just take the message as the symptom description
            if len(message) > 5:
                return message
            return None
        
        else:
            # Generic extraction
            if len(message) > 2:
                return message
            return None

    async def _save_new_crop(self, farmer: FarmerDB, collected_context: dict, db: Any) -> None:
        """Save a new crop to the database from collected context."""
        try:
            crop_type = collected_context.get("crop_type")
            sowing_date_str = collected_context.get("sowing_date") or collected_context.get("planned_sowing_date")
            
            if not crop_type or not sowing_date_str:
                logger.warning("Cannot save crop: missing type or sowing date")
                return
            
            # Get farm ID
            from sqlalchemy import select
            from .models import FarmDB
            result = await db.execute(select(FarmDB).where(FarmDB.farmer_id == farmer.id))
            farm = result.scalar_one_or_none()
            
            if not farm:
                # Create default farm if missing
                farm = FarmDB(
                    farmer_id=farmer.id,
                    land_size_acres=5.0,  # Default
                    irrigation_type="rainfed"
                )
                db.add(farm)
                await db.flush()
            
            # Deactivate existing crops
            from sqlalchemy import update
            await db.execute(
                update(CropDB)
                .where(CropDB.farm_id == farm.id)
                .values(is_active=False)
            )
            
            # Create new crop
            new_crop = CropDB(
                farm_id=farm.id,  # Use farm_id
                crop_type=crop_type,
                sowing_date=date.fromisoformat(sowing_date_str),
                is_active=True,
                current_stage="germination"  # Default
            )
            db.add(new_crop)
            await db.commit()
            logger.info(f"Saved new crop: {crop_type} planted on {sowing_date_str}")
            
        except Exception as e:
            logger.error(f"Failed to save crop: {e}")
            await db.rollback()

    async def _reload_crops(self, farmer_id: int, db: Any) -> list[CropDB]:
        """Reload updated crop list from database."""
        from sqlalchemy import select
        # Need to join with FarmDB to filter by farmer_id
        from .models import FarmDB
        result = await db.execute(
            select(CropDB)
            .join(FarmDB)
            .where(FarmDB.farmer_id == farmer_id)
            .where(CropDB.is_active == True)
        )
        return list(result.scalars().all())
    
    def _make_decision(
        self,
        intent: str,
        weather: dict,
        crop_stage: dict,
        risks: dict,
        context: dict,
        collected_context: dict = None
    ) -> str:
        """
        Make deterministic decision based on agent data.
        NO LLM LOGIC HERE - purely rule-based.
        """
        collected = collected_context or {}
        impact = weather.get("farming_impact", {})
        stage = crop_stage.get("current_stage", "")
        water_need = crop_stage.get("water_need", "medium")
        risk_level = risks.get("overall_risk", "low")
        
        # Crop planning decision rules
        if intent == "crop_planning":
            crop_type = collected.get("crop_type", "the crop")
            previous_crop = collected.get("previous_crop", "unknown")
            
            recommendations = []
            
            # Check rain forecast
            if impact.get("rain_risk", 0) > 0.5:
                recommendations.append(f"Heavy rain expected - consider delaying sowing by 5-7 days for better germination.")
            elif impact.get("rain_risk", 0) < 0.2:
                recommendations.append(f"Dry conditions expected - ensure you have irrigation ready after sowing.")
            else:
                recommendations.append(f"Weather looks favorable for sowing {crop_type}.")
            
            # Crop rotation advice
            if previous_crop.lower() in ["rice", "paddy"]:
                if crop_type.lower() in ["corn", "maize", "wheat"]:
                    recommendations.append(f"Good rotation: {crop_type} after {previous_crop} helps break pest cycles and adds nitrogen.")
                else:
                    recommendations.append(f"After {previous_crop}, consider ensuring proper land preparation.")
            
            return " ".join(recommendations)
        
        elif intent == "sowing_query":
            primary_crop = context.get("primary_crop")
            crop_type = collected.get("crop_type") or (primary_crop.get("crop_type") if primary_crop else None) or "the crop"
            
            if impact.get("rain_risk", 0) > 0.6:
                return f"Wait for rain to pass before sowing {crop_type}. Heavy rain can wash away seeds."
            elif impact.get("rain_risk", 0) > 0.3:
                return f"Light rain expected - good time to sow {crop_type} if soil is prepared."
            else:
                return f"Dry conditions - sow {crop_type} and irrigate immediately after."
        
        elif intent == "irrigation_query":
            # Irrigation decision rules
            if impact.get("rain_risk", 0) > 0.6:
                return "Do not irrigate today - rain is expected."
            elif impact.get("irrigation_needed") and water_need in ["high", "critical"]:
                return "Irrigation recommended today."
            elif water_need == "low" or water_need == "none":
                return f"Irrigation not necessary - {stage} stage has low water needs."
            else:
                return "Optional irrigation - monitor soil moisture."
        
        elif intent == "harvest_query":
            if stage == "harvest":
                if impact.get("rain_risk", 0) < 0.3:
                    return "Your crop is ready for harvest. Weather looks good."
                else:
                    return "Crop ready but rain expected. Harvest quickly or wait for dry spell."
            elif stage == "maturity":
                return "Crop nearly ready. Prepare for harvest in 1-2 weeks."
            else:
                return f"Crop not ready - currently in {stage} stage."
        
        elif intent == "weather_query":
            if impact.get("spray_safe"):
                return "Good conditions for field work and spraying."
            else:
                return "Weather may affect field activities. Check before spraying."
        
        elif intent == "pest_disease_query":
            return "For pest/disease issues, describe symptoms or upload a photo. Common issues for this stage are being assessed."
        
        else:
            if risk_level == "high":
                return f"Alert: High risk detected for your {stage} stage crop. Take precautions."
            else:
                return "Your crop is progressing well. Keep monitoring."
    
    async def _generate_crop_inquiry(
        self,
        farmer_name: str,
        language: str,
        user_query: str
    ) -> str:
        """
        Generate a conversational prompt to ask the farmer about their crops.
        Called when farmer has no active crops registered.
        """
        # Localized prompts for asking about crops
        prompts = {
            "en": {
                "greeting": f"Hello{' ' + farmer_name if farmer_name else ''}! 👋 I'm your farming assistant.",
                "ask_crop": "I can help you with crop advice, weather updates, and problem solving.\n\n"
                           "**Tell me about your situation:**\n"
                           "• 🌱 What crop are you growing or planning to grow?\n"
                           "• 🆘 Having any problems with your current crop?\n\n"
                           "_Example: \"I'm growing corn\" or \"My rice has yellow leaves\"_",
                "help": ""
            },
            "hi": {
                "greeting": f"नमस्ते{' ' + farmer_name if farmer_name else ''}! 👋 मैं आपका खेती सहायक हूं।",
                "ask_crop": "मैं फसल सलाह, मौसम अपडेट और समस्या समाधान में मदद कर सकता हूं।\n\n"
                           "**अपनी स्थिति बताएं:**\n"
                           "• 🌱 आप कौन सी फसल उगा रहे हैं?\n"
                           "• 🆘 कोई समस्या है?\n\n"
                           "_उदाहरण: \"मक्का उगा रहा हूं\" या \"धान में पीले पत्ते\"_",
                "help": ""
            },
            "te": {
                "greeting": f"నమస్కారం{' ' + farmer_name if farmer_name else ''}! 👋 నేను మీ వ్యవసాయ సహాయకుడిని.",
                "ask_crop": "నేను పంట సలహా, వాతావరణం మరియు సమస్య పరిష్కారంలో సహాయం చేయగలను.\n\n"
                           "**మీ పరిస్థితి చెప్పండి:**\n"
                           "• 🌱 మీరు ఏ పంట పండిస్తున్నారు?\n"
                           "• 🆘 ఏదైనా సమస్య ఉందా?",
                "help": ""
            }
        }
        
        # Get prompts for the language, fallback to English
        lang_prompts = prompts.get(language, prompts["en"])
        
        # Check if user is asking about something specific
        query_lower = user_query.lower()
        if any(word in query_lower for word in ["problem", "issue", "disease", "pest", "help", "समस्या", "రోగం"]):
            # User mentioned a problem - still ask for crop context
            return (
                lang_prompts["greeting"] + "\n\n"
                "I understand you may have a problem with your crop. "
                "To help you better, please first tell me:\n\n"
                "• **What crop is it?**\n"
                "• **How old is the crop?** (days since planting)\n"
                "• **Describe the problem** (yellowing leaves, spots, insects, etc.)\n\n"
                "I'll provide targeted advice once I know more!"
            )
        
        return lang_prompts["greeting"] + "\n\n" + lang_prompts["ask_crop"] + lang_prompts["help"]
    
    async def _try_extract_and_save_crop(
        self,
        query: str,
        farmer: FarmerDB,
        farm: Optional[FarmDB],
        language: str,
        db: Any
    ) -> dict:
        """
        Try to extract crop information from user's message and save to database.
        
        Returns dict with:
            - saved: True if crop was saved
            - crop_type: The crop type if extracted
            - is_planning: True if user is planning (not yet planted)
            - problem: Any problem mentioned
            - understood: True if message was understood
        """
        from .llm_service import get_llm_service
        from datetime import date, timedelta
        from sqlalchemy import select
        
        llm = get_llm_service()
        
        # Extract crop info from message
        crop_info = await llm.extract_crop_info(query, language)
        
        if not crop_info.get("crop_type"):
            # Couldn't extract crop type
            return {"saved": False, "understood": crop_info.get("understood", False)}
        
        # Calculate sowing date
        sowing_date = None
        if crop_info.get("is_planning"):
            # User is planning - set tentative date as today (they can update later)
            sowing_date = date.today()
        elif crop_info.get("days_since_sowing"):
            sowing_date = date.today() - timedelta(days=crop_info["days_since_sowing"])
        elif crop_info.get("sowing_date") == "recent":
            sowing_date = date.today() - timedelta(days=7)  # Assume a week ago
        else:
            sowing_date = date.today()  # Default to today
        
        # Ensure we have a farm to associate the crop with
        if not farm:
            # Create a default farm
            from .models import FarmDB as FarmModel
            farm = FarmModel(
                farmer_id=farmer.id,
                name="My Farm",
                land_size_acres=1.0,
                irrigation_type="rainfed"
            )
            db.add(farm)
            await db.flush()
        
        # Check if crop already exists
        from .models import CropDB as CropModel
        result = await db.execute(
            select(CropModel).where(
                CropModel.farm_id == farm.id,
                CropModel.is_active == True
            )
        )
        existing_crop = result.scalar_one_or_none()
        
        if existing_crop:
            # Update existing crop
            existing_crop.crop_type = crop_info["crop_type"]
            existing_crop.sowing_date = sowing_date
        else:
            # Create new crop
            new_crop = CropModel(
                farm_id=farm.id,
                crop_type=crop_info["crop_type"],
                sowing_date=sowing_date,
                is_active=True
            )
            db.add(new_crop)
        
        await db.commit()
        
        return {
            "saved": True,
            "crop_type": crop_info["crop_type"],
            "sowing_date": sowing_date.isoformat() if sowing_date else None,
            "is_planning": crop_info.get("is_planning", False),
            "problem": crop_info.get("problem"),
            "understood": True
        }
    
    async def _generate_crop_saved_response(
        self,
        crop_info: dict,
        farmer_name: str,
        language: str
    ) -> str:
        """
        Generate a helpful response after saving crop information.
        """
        crop_type = crop_info.get("crop_type", "your crop")
        is_planning = crop_info.get("is_planning", False)
        problem = crop_info.get("problem")
        
        # Personalization
        name_part = f" {farmer_name}" if farmer_name else ""
        
        if is_planning and problem:
            # Planning + Problem (e.g., "Corn, no rain, should I plant?")
            if "rain" in (problem or "").lower() or "drought" in (problem or "").lower():
                return (
                    f"Got it{name_part}! 🌽 You're planning to grow **{crop_type}** and worried about rain.\n\n"
                    f"Let me check the weather for your area...\n\n"
                    f"**My advice:** Before planting, ensure you have access to irrigation (tubewell/canal). "
                    f"For {crop_type}, the first 2-3 weeks need consistent moisture for germination. "
                    f"If rain is uncertain, consider:\n"
                    f"• 💧 Pre-irrigation before sowing\n"
                    f"• 🌱 Seed treatment for drought resistance\n"
                    f"• 📅 Wait for monsoon forecast if possible\n\n"
                    f"What's your water source for irrigation?"
                )
            else:
                return (
                    f"Got it{name_part}! 🌱 You're planning to grow **{crop_type}**.\n\n"
                    f"I've saved this to your profile. You mentioned: *{problem}*\n\n"
                    f"Can you tell me more about this issue? I'll provide specific guidance."
                )
        elif is_planning:
            # Just planning
            return (
                f"Great{name_part}! 🌾 I've noted that you're planning to grow **{crop_type}**.\n\n"
                f"Here's what you should know for {crop_type}:\n"
                f"• 🌡️ Best sowing time depends on your region\n"
                f"• 💧 Prepare soil with adequate moisture\n"
                f"• 🧪 Soil testing recommended before sowing\n\n"
                f"Let me know when you plant, or ask me anything about {crop_type} cultivation!"
            )
        elif problem:
            # Existing crop with problem
            return (
                f"Noted{name_part}! 🌿 You have **{crop_type}** and you mentioned: *{problem}*\n\n"
                f"I've saved your crop to your profile. Let me help with this issue.\n\n"
                f"Can you describe the problem in more detail? For example:\n"
                f"• Which part of the plant is affected?\n"
                f"• When did you first notice it?\n"
                f"• How many plants are affected?\n\n"
                f"A photo would help too if you can share one!"
            )
        else:
            # Just told us crop
            return (
                f"Perfect{name_part}! ✅ I've saved **{crop_type}** to your profile.\n\n"
                f"Now I can give you personalized advice for your {crop_type} crop! 🌾\n\n"
                f"You can ask me about:\n"
                f"• 💧 When to irrigate\n"
                f"• 🌤️ Weather impact on your crop\n"
                f"• 🐛 Pest and disease management\n"
                f"• 📈 Current growth stage\n\n"
                f"What would you like to know?"
            )

