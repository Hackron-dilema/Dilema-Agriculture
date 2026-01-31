"""
Growing Degree Days (GDD) Calculator.
Used for determining crop growth stages based on accumulated heat units.
"""
from datetime import date, datetime
from typing import Optional, Tuple
from pydantic import BaseModel


class GDDResult(BaseModel):
    """Result of GDD calculation."""
    accumulated_gdd: float
    days_since_sowing: int
    daily_gdd: float  # Today's contribution
    average_daily_gdd: float


# Base temperatures for common crops (Celsius)
# GDD = max(0, (Tmax + Tmin)/2 - Tbase)
CROP_BASE_TEMPS = {
    # Cereals
    "rice": 10.0,
    "wheat": 4.5,
    "maize": 10.0,
    "corn": 10.0,
    "sorghum": 10.0,
    "barley": 5.0,
    "millet": 10.0,
    
    # Pulses
    "chickpea": 5.0,
    "lentil": 5.0,
    "pigeon_pea": 10.0,
    "green_gram": 10.0,
    "black_gram": 10.0,
    
    # Oilseeds
    "groundnut": 13.0,
    "soybean": 10.0,
    "sunflower": 6.0,
    "mustard": 5.0,
    "sesame": 15.0,
    
    # Cash crops
    "cotton": 15.5,
    "sugarcane": 12.0,
    "tobacco": 13.0,
    
    # Vegetables
    "tomato": 10.0,
    "onion": 5.0,
    "potato": 7.0,
    "chili": 15.0,
    "brinjal": 15.0,
    "okra": 18.0,
    "cabbage": 4.5,
    "cauliflower": 4.5,
    "carrot": 7.0,
    "spinach": 2.0,
    
    # Fruits
    "banana": 14.0,
    "mango": 15.0,
    "papaya": 15.0,
    "watermelon": 18.0,
    
    # Default
    "default": 10.0
}


def get_base_temperature(crop_type: str) -> float:
    """Get base temperature for a crop type."""
    crop_lower = crop_type.lower().replace(" ", "_").replace("-", "_")
    return CROP_BASE_TEMPS.get(crop_lower, CROP_BASE_TEMPS["default"])


def calculate_daily_gdd(
    temp_max: float,
    temp_min: float,
    base_temp: float,
    upper_threshold: float = 35.0
) -> float:
    """
    Calculate Growing Degree Days for a single day.
    
    Uses modified averaging method with upper threshold.
    GDD = max(0, (Tmax + Tmin)/2 - Tbase)
    
    Args:
        temp_max: Maximum temperature (Celsius)
        temp_min: Minimum temperature (Celsius)
        base_temp: Base temperature for the crop
        upper_threshold: Upper temperature limit (growth stops above this)
    
    Returns:
        GDD for the day (always >= 0)
    """
    # Cap temperatures
    temp_max = min(temp_max, upper_threshold)
    temp_min = max(temp_min, base_temp)  # Can't be below base
    
    # Average method
    avg_temp = (temp_max + temp_min) / 2
    gdd = max(0, avg_temp - base_temp)
    
    return round(gdd, 2)


def calculate_accumulated_gdd(
    sowing_date: date,
    daily_temps: list[Tuple[float, float]],
    crop_type: str
) -> GDDResult:
    """
    Calculate accumulated GDD from sowing date to present.
    
    Args:
        sowing_date: Date crop was sown
        daily_temps: List of (temp_max, temp_min) tuples from sowing to now
        crop_type: Type of crop for base temperature
    
    Returns:
        GDDResult with accumulated values
    """
    base_temp = get_base_temperature(crop_type)
    accumulated = 0.0
    
    for temp_max, temp_min in daily_temps:
        accumulated += calculate_daily_gdd(temp_max, temp_min, base_temp)
    
    days = len(daily_temps)
    today_gdd = calculate_daily_gdd(
        daily_temps[-1][0],
        daily_temps[-1][1],
        base_temp
    ) if daily_temps else 0.0
    
    return GDDResult(
        accumulated_gdd=round(accumulated, 2),
        days_since_sowing=days,
        daily_gdd=today_gdd,
        average_daily_gdd=round(accumulated / max(days, 1), 2)
    )


def estimate_gdd_from_average(
    sowing_date: date,
    avg_temp_max: float,
    avg_temp_min: float,
    crop_type: str,
    current_date: Optional[date] = None
) -> GDDResult:
    """
    Estimate accumulated GDD using average temperatures.
    Used when historical data is not available.
    
    Args:
        sowing_date: Date crop was sown
        avg_temp_max: Average maximum temperature for the region
        avg_temp_min: Average minimum temperature for the region
        crop_type: Type of crop
        current_date: Current date (defaults to today)
    
    Returns:
        Estimated GDDResult
    """
    current_date = current_date or date.today()
    days = (current_date - sowing_date).days
    
    if days < 0:
        return GDDResult(
            accumulated_gdd=0,
            days_since_sowing=0,
            daily_gdd=0,
            average_daily_gdd=0
        )
    
    base_temp = get_base_temperature(crop_type)
    daily_gdd = calculate_daily_gdd(avg_temp_max, avg_temp_min, base_temp)
    accumulated = daily_gdd * days
    
    return GDDResult(
        accumulated_gdd=round(accumulated, 2),
        days_since_sowing=days,
        daily_gdd=daily_gdd,
        average_daily_gdd=daily_gdd
    )


def days_to_target_gdd(
    current_gdd: float,
    target_gdd: float,
    avg_daily_gdd: float
) -> int:
    """
    Estimate days to reach target GDD.
    
    Args:
        current_gdd: Current accumulated GDD
        target_gdd: Target GDD to reach
        avg_daily_gdd: Average daily GDD accumulation
    
    Returns:
        Estimated days to reach target (0 if already reached)
    """
    if current_gdd >= target_gdd:
        return 0
    
    if avg_daily_gdd <= 0:
        return 999  # Cannot estimate
    
    remaining = target_gdd - current_gdd
    return int(remaining / avg_daily_gdd) + 1
