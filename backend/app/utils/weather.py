"""
Weather service using Open-Meteo API.
Free, no API key required.
"""
import httpx
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class WeatherCondition(str, Enum):
    """Weather condition categories for farming."""
    CLEAR = "clear"
    PARTLY_CLOUDY = "partly_cloudy"
    CLOUDY = "cloudy"
    RAINY = "rainy"
    STORMY = "stormy"
    FOGGY = "foggy"


class CurrentWeather(BaseModel):
    """Current weather conditions."""
    temperature: float  # Celsius
    humidity: float  # Percentage
    precipitation: float  # mm
    wind_speed: float  # km/h
    condition: WeatherCondition
    cloud_cover: float  # Percentage
    is_day: bool


class DailyForecast(BaseModel):
    """Daily weather forecast."""
    date: date
    temp_max: float
    temp_min: float
    precipitation_sum: float
    precipitation_probability: float
    wind_speed_max: float
    condition: WeatherCondition


class WeatherData(BaseModel):
    """Complete weather data for a location."""
    latitude: float
    longitude: float
    current: CurrentWeather
    forecast_7day: list[DailyForecast]
    timezone: str


class FarmingImpact(BaseModel):
    """Weather impact assessment for farming."""
    rain_risk: float  # 0-1, probability of rain affecting work
    heat_stress_risk: float  # 0-1, risk of heat stress on crops
    cold_stress_risk: float  # 0-1, risk of cold stress on crops
    spray_safe: bool  # Is it safe to spray pesticides/fertilizer
    irrigation_needed: bool  # Based on recent precipitation
    field_work_safe: bool  # Is it safe for field operations
    reasoning: str  # Explanation of the assessment


# Open-Meteo API endpoints
OPEN_METEO_BASE = "https://api.open-meteo.com/v1"


def _wmo_to_condition(wmo_code: int) -> WeatherCondition:
    """Convert WMO weather code to our condition enum."""
    if wmo_code in [0]:
        return WeatherCondition.CLEAR
    elif wmo_code in [1, 2]:
        return WeatherCondition.PARTLY_CLOUDY
    elif wmo_code in [3]:
        return WeatherCondition.CLOUDY
    elif wmo_code in [45, 48]:
        return WeatherCondition.FOGGY
    elif wmo_code in [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]:
        return WeatherCondition.RAINY
    elif wmo_code in [71, 73, 75, 77, 85, 86]:
        return WeatherCondition.RAINY  # Snow treated as rainy for farming
    elif wmo_code in [95, 96, 99]:
        return WeatherCondition.STORMY
    return WeatherCondition.CLOUDY


async def fetch_weather(latitude: float, longitude: float) -> WeatherData:
    """
    Fetch current weather and 7-day forecast from Open-Meteo.
    No API key required.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "weather_code",
            "cloud_cover",
            "wind_speed_10m",
            "is_day"
        ],
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max"
        ],
        "timezone": "auto",
        "forecast_days": 7
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{OPEN_METEO_BASE}/forecast", params=params)
        response.raise_for_status()
        data = response.json()
    
    # Parse current weather
    current = data.get("current", {})
    current_weather = CurrentWeather(
        temperature=current.get("temperature_2m", 0),
        humidity=current.get("relative_humidity_2m", 0),
        precipitation=current.get("precipitation", 0),
        wind_speed=current.get("wind_speed_10m", 0),
        condition=_wmo_to_condition(current.get("weather_code", 0)),
        cloud_cover=current.get("cloud_cover", 0),
        is_day=bool(current.get("is_day", 1))
    )
    
    # Parse 7-day forecast
    daily = data.get("daily", {})
    forecast = []
    dates = daily.get("time", [])
    
    for i, date_str in enumerate(dates):
        forecast.append(DailyForecast(
            date=datetime.strptime(date_str, "%Y-%m-%d").date(),
            temp_max=daily.get("temperature_2m_max", [0])[i],
            temp_min=daily.get("temperature_2m_min", [0])[i],
            precipitation_sum=daily.get("precipitation_sum", [0])[i],
            precipitation_probability=daily.get("precipitation_probability_max", [0])[i],
            wind_speed_max=daily.get("wind_speed_10m_max", [0])[i],
            condition=_wmo_to_condition(daily.get("weather_code", [0])[i])
        ))
    
    return WeatherData(
        latitude=data.get("latitude", latitude),
        longitude=data.get("longitude", longitude),
        current=current_weather,
        forecast_7day=forecast,
        timezone=data.get("timezone", "UTC")
    )


async def fetch_historical_weather(
    latitude: float,
    longitude: float,
    start_date: date,
    end_date: date
) -> list[dict]:
    """
    Fetch historical weather data for GDD calculation.
    Uses Open-Meteo historical API.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
        "timezone": "auto"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{OPEN_METEO_BASE}/archive", params=params)
        response.raise_for_status()
        data = response.json()
    
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    result = []
    
    for i, date_str in enumerate(dates):
        result.append({
            "date": date_str,
            "temp_max": daily.get("temperature_2m_max", [0])[i],
            "temp_min": daily.get("temperature_2m_min", [0])[i],
            "precipitation": daily.get("precipitation_sum", [0])[i]
        })
    
    return result


def assess_farming_impact(weather: WeatherData) -> FarmingImpact:
    """
    Convert weather data to actionable farming impact assessment.
    Deterministic logic - no LLM involved.
    """
    current = weather.current
    today_forecast = weather.forecast_7day[0] if weather.forecast_7day else None
    
    # Calculate risks
    rain_risk = 0.0
    if current.precipitation > 0:
        rain_risk = 0.9
    elif today_forecast and today_forecast.precipitation_probability > 50:
        rain_risk = today_forecast.precipitation_probability / 100
    elif current.condition in [WeatherCondition.RAINY, WeatherCondition.STORMY]:
        rain_risk = 0.8
    
    # Heat stress (>35°C is critical for most crops)
    heat_stress = 0.0
    if current.temperature > 40:
        heat_stress = 1.0
    elif current.temperature > 35:
        heat_stress = (current.temperature - 35) / 5
    elif current.temperature > 32:
        heat_stress = 0.2
    
    # Cold stress (<10°C can damage tropical crops)
    cold_stress = 0.0
    if current.temperature < 5:
        cold_stress = 1.0
    elif current.temperature < 10:
        cold_stress = (10 - current.temperature) / 5
    elif current.temperature < 15:
        cold_stress = 0.2
    
    # Spray safety: No rain, wind <15 km/h, not too hot
    spray_safe = (
        rain_risk < 0.3 and
        current.wind_speed < 15 and
        current.temperature < 35 and
        current.temperature > 10
    )
    
    # Irrigation needed if no significant rain in past 3 days and hot
    # (simplified - would need historical data for accurate assessment)
    irrigation_needed = (
        current.precipitation < 5 and
        rain_risk < 0.3 and
        current.temperature > 25
    )
    
    # Field work safe if not raining, not stormy, not too windy
    field_work_safe = (
        current.precipitation < 1 and
        current.condition != WeatherCondition.STORMY and
        current.wind_speed < 30
    )
    
    # Generate reasoning
    reasons = []
    if rain_risk > 0.5:
        reasons.append(f"High rain probability ({rain_risk*100:.0f}%)")
    if heat_stress > 0.3:
        reasons.append(f"Heat stress risk at {current.temperature}°C")
    if cold_stress > 0.3:
        reasons.append(f"Cold stress risk at {current.temperature}°C")
    if not spray_safe:
        if current.wind_speed >= 15:
            reasons.append(f"Wind too strong for spraying ({current.wind_speed} km/h)")
    if reasons:
        reasoning = "; ".join(reasons)
    else:
        reasoning = "Weather conditions are favorable for farming activities"
    
    return FarmingImpact(
        rain_risk=min(rain_risk, 1.0),
        heat_stress_risk=min(heat_stress, 1.0),
        cold_stress_risk=min(cold_stress, 1.0),
        spray_safe=spray_safe,
        irrigation_needed=irrigation_needed,
        field_work_safe=field_work_safe,
        reasoning=reasoning
    )
