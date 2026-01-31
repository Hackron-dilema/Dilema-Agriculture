"""
LLM Service for Agricultural Decision Support System.

Handles all LLM interactions using Ollama (local, free) or Groq (cloud, free tier).
The LLM is used for:
1. Intent extraction from farmer queries
2. Entity extraction (crop names, dates, symptoms)
3. Response generation in farmer's language
4. Translation to regional languages

IMPORTANT: The LLM does NOT make farming decisions.
It only understands queries and explains decisions made by rule-based agents.
"""
import os
import json
import httpx
from typing import Optional
from pydantic import BaseModel


class IntentResult(BaseModel):
    """Result of intent extraction."""
    intent: str
    entities: dict
    confidence: float
    language_detected: str


class LLMService:
    """
    LLM service for natural language understanding and generation.
    Supports Ollama (local) and Groq (cloud) backends.
    """
    
    # Supported intents
    INTENTS = [
        "irrigation_query",      # Should I water? When to irrigate?
        "weather_query",         # Weather forecast, rain prediction
        "crop_status_query",     # How is my crop? Current stage?
        "harvest_query",         # When to harvest? Is it ready?
        "pest_disease_query",    # Pest/disease symptoms, treatment
        "fertilizer_query",      # Fertilizer timing, type, quantity
        "sowing_query",          # When to sow? Best time?
        "general_farming",       # General advice
        "greeting",              # Hello, hi, namaste
        "unclear"                # Cannot determine
    ]
    
    # Language codes and names
    LANGUAGES = {
        "en": "English",
        "hi": "Hindi",
        "te": "Telugu",
        "kn": "Kannada",
        "ta": "Tamil",
        "mr": "Marathi"
    }
    
    def __init__(self, provider: str = "ollama"):
        """
        Initialize LLM service.
        
        Args:
            provider: 'ollama' for local or 'groq' for cloud
        """
        self.provider = provider
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.groq_model = "llama-3.1-8b-instant"
    
    async def extract_intent(self, query: str, language: str = "en") -> IntentResult:
        """
        Extract intent and entities from a farmer's query using LLM.
        
        Args:
            query: The farmer's natural language query
            language: Expected language code
            
        Returns:
            IntentResult with intent, entities, and confidence
        """
        prompt = f"""You are an agricultural assistant. Analyze this farmer's query and extract the intent.

Query: "{query}"

Respond ONLY with valid JSON in this exact format:
{{
    "intent": "<one of: irrigation_query, weather_query, crop_status_query, harvest_query, pest_disease_query, fertilizer_query, sowing_query, general_farming, greeting, unclear>",
    "entities": {{
        "crop": "<crop name if mentioned, else null>",
        "symptom": "<symptom if mentioned, else null>",
        "date": "<date if mentioned, else null>"
    }},
    "confidence": <0.0 to 1.0>,
    "language_detected": "<en, hi, te, kn, ta, mr>"
}}

Examples:
- "Should I water today?" → intent: irrigation_query
- "मेरी फसल कैसी है?" → intent: crop_status_query, language: hi
- "వర్షం వస్తుందా?" → intent: weather_query, language: te
- "When to harvest rice?" → intent: harvest_query, entities.crop: rice

JSON response:"""

        try:
            response = await self._call_llm(prompt)
            # Parse JSON from response
            json_str = self._extract_json(response)
            data = json.loads(json_str)
            
            return IntentResult(
                intent=data.get("intent", "unclear"),
                entities=data.get("entities", {}),
                confidence=float(data.get("confidence", 0.7)),
                language_detected=data.get("language_detected", language)
            )
        except Exception as e:
            print(f"LLM intent extraction failed: {e}")
            # Fallback to keyword matching
            return self._fallback_intent_extraction(query)
    
    async def generate_response(
        self,
        decision_data: dict,
        language: str = "en",
        farmer_name: str = ""
    ) -> str:
        """
        Generate a natural language response in the farmer's language.
        
        Args:
            decision_data: Data from agents (weather, crop stage, risks, etc.)
            language: Target language code
            farmer_name: Farmer's name for personalization
            
        Returns:
            Natural language response in the target language
        """
        lang_name = self.LANGUAGES.get(language, "English")
        
        # Build context from decision data
        context_parts = []
        
        if "weather" in decision_data:
            weather = decision_data["weather"]
            if "error" in weather:
                context_parts.append(f"Weather info: Current temperature is unknown because the farmer's location is not set in their profile.")
            else:
                current = weather.get("current", {})
                temp = current.get("temperature")
                if temp is not None:
                    context_parts.append(f"Current weather: {temp}°C, {current.get('condition', 'unknown')}")
                else:
                    context_parts.append(f"Current weather: Unknown (location may not be set)")
            
            impact = weather.get("farming_impact", {})
            if impact:
                context_parts.append(f"Farming impact: spray_safe={impact.get('spray_safe')}, irrigation_needed={impact.get('irrigation_needed')}")
        
        if "crop_stage" in decision_data:
            stage = decision_data["crop_stage"]
            context_parts.append(f"Crop: {stage.get('crop_type', 'unknown')}, Stage: {stage.get('current_stage', 'unknown')}, Progress: {stage.get('overall_progress', 0)*100:.0f}%")
            context_parts.append(f"Water need: {stage.get('water_need', 'medium')}")
        
        if "risks" in decision_data:
            risks = decision_data["risks"]
            if risks.get("risks"):
                context_parts.append(f"Risks: {[r.get('type') for r in risks.get('risks', [])]}")
        
        if "recommendation" in decision_data:
            context_parts.append(f"Recommendation: {decision_data['recommendation']}")
        
        intent = decision_data.get("intent", "general_farming")
        context = "\n".join(context_parts)
        
        prompt = f"""You are a friendly, helpful agricultural expert talking 1-on-1 with a farmer. 

Farmer's name: {farmer_name or 'Friend'}
Query intent: {intent}

Information from our analysis:
{context}

Guidelines:
1. Speak naturally, like a person talking to a person.
2. ONLY answer what is necessary and important based on the query.
3. If weather data is missing, kindly remind the farmer to set their location in the profile.
4. Do NOT use formal headers like "Best, Advisory Agent" or "Data Analysis".
5. Keep it warm, concise (2-3 sentences), and practical.
6. Use emoji naturally (💧 🌾).

Your response in {lang_name}:"""

        try:
            response = await self._call_llm(prompt)
            return response.strip()
        except Exception as e:
            print(f"LLM response generation failed: {e}")
            # Fallback to English template
            return self._fallback_response(decision_data, farmer_name)
    
    async def translate(self, text: str, target_language: str) -> str:
        """
        Translate text to target language.
        
        Args:
            text: Text to translate
            target_language: Target language code (hi, te, kn, etc.)
            
        Returns:
            Translated text
        """
        if target_language == "en":
            return text
        
        lang_name = self.LANGUAGES.get(target_language, "Hindi")
        
        prompt = f"""Translate this agricultural advice to {lang_name}. 
Keep technical farming terms understandable.
Maintain the meaning exactly.

Text: {text}

Translation in {lang_name}:"""

        try:
            response = await self._call_llm(prompt)
            return response.strip()
        except Exception as e:
            print(f"Translation failed: {e}")
            return text  # Return original if translation fails
    
    async def _call_llm(self, prompt: str) -> str:
        """
        Call the LLM backend (Ollama or Groq).
        """
        if self.provider == "groq" and self.groq_api_key:
            return await self._call_groq(prompt)
        else:
            return await self._call_ollama(prompt)
    
    async def _call_ollama(self, prompt: str) -> str:
        """Call Ollama API."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 500
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
    
    async def _call_groq(self, prompt: str) -> str:
        """Call Groq API."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.groq_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 500
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    def _extract_json(self, text: str) -> str:
        """Extract JSON from LLM response."""
        # Try to find JSON in the response
        text = text.strip()
        
        # If it starts with {, assume it's JSON
        if text.startswith("{"):
            # Find the matching closing brace
            brace_count = 0
            for i, char in enumerate(text):
                if char == "{":
                    brace_count += 1
                elif char == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        return text[:i+1]
        
        # Try to extract JSON from markdown code block
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            if end > start:
                return text[start:end].strip()
        
        if "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end > start:
                return text[start:end].strip()
        
        return text
    
    def _fallback_intent_extraction(self, query: str) -> IntentResult:
        """Fallback keyword-based intent extraction when LLM fails."""
        query_lower = query.lower()
        
        # Detect language
        if any(c in query for c in "हिंदी मेरी फसल पानी"):
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
        elif any(w in query_lower for w in ["weather", "rain", "मौसम", "వర్షం", "ಮಳೆ"]):
            intent = "weather_query"
        elif any(w in query_lower for w in ["status", "how is", "कैसी", "ఎలా", "ಹೇಗೆ", "stage"]):
            intent = "crop_status_query"
        elif any(w in query_lower for w in ["harvest", "ready", "कटाई", "పంట కోత"]):
            intent = "harvest_query"
        elif any(w in query_lower for w in ["pest", "disease", "insect", "कीट", "పురుగు"]):
            intent = "pest_disease_query"
        elif any(w in query_lower for w in ["fertiliz", "खाद", "ఎరువు", "urea", "dap"]):
            intent = "fertilizer_query"
        elif any(w in query_lower for w in ["hello", "hi", "नमस्ते", "హలో"]):
            intent = "greeting"
        else:
            intent = "general_farming"
        
        return IntentResult(
            intent=intent,
            entities={},
            confidence=0.6,
            language_detected=lang
        )
    
    def _fallback_response(self, decision_data: dict, farmer_name: str) -> str:
        """Fallback response when LLM fails."""
        intent = decision_data.get("intent", "general_farming")
        recommendation = decision_data.get("recommendation", "")
        
        if farmer_name:
            response = f"Hello {farmer_name}! "
        else:
            response = ""
        
        if recommendation:
            response += recommendation
        else:
            response += "I'm here to help with your farming questions. Please ask about irrigation, weather, crop status, or any other farming topic."
        
        return response


# Singleton instance
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get or create the LLM service singleton."""
    global _llm_service
    if _llm_service is None:
        provider = os.getenv("LLM_PROVIDER", "ollama")
        _llm_service = LLMService(provider=provider)
    return _llm_service
