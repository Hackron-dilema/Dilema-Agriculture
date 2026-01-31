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
                result={"error": "Location not available"},
                confidence=0.0,
                reasoning="Cannot fetch weather without location",
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
                data_sources=["gdd_calculation"]
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
            data_sources=["gdd_calculation", "crop_knowledge_base"]
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
        if any(w in query_lower for w in ["water", "irrigat", "पानी", "నీరు", "ನೀರು"]):
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
        db: Any
    ) -> ChatResponse:
        """
        Process a farmer query through the multi-agent system.
        
        Flow:
        1. LLM extracts intent
        2. Context Agent loads farm state
        3. Orchestrator selects relevant agents
        4. Agents execute and return data
        5. Orchestrator makes deterministic decision
        6. LLM explains result to farmer
        """
        
        # Get farmer's preferred language
        farmer_language = farmer.language if farmer.language else "en"
        
        # Step 1: Extract intent (using LLM)
        intent_response = await self.llm_agent.execute({
            "query": query,
            "mode": "extract_intent",
            "language": farmer_language
        })
        intent_data = intent_response.result
        intent = intent_data.get("intent", "general_farming")
        detected_language = intent_data.get("language_detected", farmer_language)
        
        # Step 2: Load context
        context_response = await self.context_agent.execute({
            "farmer": farmer,
            "farm": farm,
            "crops": crops
        })
        context_data = context_response.result
        
        # Get primary crop
        primary_crop = context_data.get("primary_crop")
        
        # Collect all data sources
        all_sources = ["intent_extraction"]
        all_alerts = []
        
        # Step 3: Call relevant agents based on intent
        weather_data = {}
        crop_stage_data = {}
        risk_data = {}
        
        # Weather is almost always needed
        if context_data.get("has_location"):
            weather_response = await self.weather_agent.execute({
                "latitude": farmer.latitude,
                "longitude": farmer.longitude
            })
            weather_data = weather_response.result
            all_sources.extend(weather_response.data_sources)
        
        # Crop stage if we have a crop
        if primary_crop:
            crop_stage_response = await self.crop_stage_agent.execute({
                "crop_type": primary_crop.get("crop_type"),
                "sowing_date": primary_crop.get("sowing_date"),
                "weather_data": weather_data
            })
            crop_stage_data = crop_stage_response.result
            all_sources.extend(crop_stage_response.data_sources)
            
            # Risk assessment
            risk_response = await self.risk_agent.execute({
                "crop_stage_data": crop_stage_data,
                "weather_data": weather_data,
                "irrigation_type": farm.irrigation_type if farm else "rainfed"
            })
            risk_data = risk_response.result
            all_sources.extend(risk_response.data_sources)
            all_alerts.extend(risk_data.get("alerts", []))
        
        # Step 4: Make deterministic decision
        recommendation = self._make_decision(
            intent=intent,
            weather=weather_data,
            crop_stage=crop_stage_data,
            risks=risk_data,
            context=context_data
        )
        
        # Step 5: Generate human-friendly response in farmer's language
        response_context = {
            "decision_data": {
                "intent": intent,
                "weather": weather_data,
                "crop_stage": crop_stage_data,
                "risks": risk_data,
                "recommendation": recommendation,
                "alerts": all_alerts
            },
            "farmer_name": farmer.name,
            "language": farmer_language,  # Response in farmer's language
            "mode": "generate_response"
        }
        
        llm_response = await self.llm_agent.execute(response_context)
        final_response = llm_response.result.get("response", recommendation)
        
        # Calculate overall confidence
        confidences = [
            intent_response.confidence,
            context_response.confidence
        ]
        if weather_data and "error" not in weather_data:
            confidences.append(0.9)
        if crop_stage_data and "error" not in crop_stage_data:
            confidences.append(0.85)
        
        avg_confidence = sum(confidences) / len(confidences)
        
        return ChatResponse(
            response=final_response,
            confidence=avg_confidence,
            reasoning=f"Intent: {intent} | Stage: {crop_stage_data.get('current_stage', 'N/A')} | Risk: {risk_data.get('overall_risk', 'N/A')}",
            data_sources=list(set(all_sources)),
            alerts=all_alerts if all_alerts else None
        )
    
    def _make_decision(
        self,
        intent: str,
        weather: dict,
        crop_stage: dict,
        risks: dict,
        context: dict
    ) -> str:
        """
        Make deterministic decision based on agent data.
        NO LLM LOGIC HERE - purely rule-based.
        """
        impact = weather.get("farming_impact", {})
        stage = crop_stage.get("current_stage", "")
        water_need = crop_stage.get("water_need", "medium")
        risk_level = risks.get("overall_risk", "low")
        
        if intent == "irrigation_query":
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
