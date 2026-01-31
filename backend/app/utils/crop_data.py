"""
Crop data loader and knowledge base access.
Provides crop stage definitions, risk rules, and advisory thresholds.
"""
import json
from pathlib import Path
from typing import Optional
from functools import lru_cache
from pydantic import BaseModel
from datetime import date

from .gdd import get_base_temperature


# Path to crop data JSON
DATA_DIR = Path(__file__).parent.parent.parent / "data"
CROPS_FILE = DATA_DIR / "crops.json"


class CropStageInfo(BaseModel):
    """Information about a crop growth stage."""
    name: str
    gdd_start: float
    gdd_end: float
    description: str
    critical_factors: list[str]
    water_need: str
    nutrient_need: str
    heat_sensitive: bool = False
    critical_temp_max: Optional[float] = None


class CropInfo(BaseModel):
    """Complete information about a crop type."""
    name: str
    category: str
    base_temperature: float
    growing_season_days: tuple[int, int]
    water_requirement: str
    stages: dict[str, CropStageInfo]
    common_pests: list[str]
    common_diseases: list[str]


class RiskRule(BaseModel):
    """Risk assessment rule."""
    id: str
    condition: str
    severity: str
    message: str
    action: str


@lru_cache(maxsize=1)
def load_crop_data() -> dict:
    """Load crop data from JSON file. Cached for performance."""
    if not CROPS_FILE.exists():
        raise FileNotFoundError(f"Crop data file not found: {CROPS_FILE}")
    
    with open(CROPS_FILE, "r") as f:
        return json.load(f)


def get_crop_info(crop_type: str) -> Optional[CropInfo]:
    """Get information about a specific crop type."""
    data = load_crop_data()
    crop_key = crop_type.lower().replace(" ", "_").replace("-", "_")
    
    crop_data = data.get("crops", {}).get(crop_key)
    if not crop_data:
        return None
    
    # Parse stages
    stages = {}
    for stage_name, stage_data in crop_data.get("stages", {}).items():
        stages[stage_name] = CropStageInfo(
            name=stage_name,
            **stage_data
        )
    
    return CropInfo(
        name=crop_data["name"],
        category=crop_data["category"],
        base_temperature=crop_data["base_temperature"],
        growing_season_days=tuple(crop_data["growing_season_days"]),
        water_requirement=crop_data["water_requirement"],
        stages=stages,
        common_pests=crop_data.get("common_pests", []),
        common_diseases=crop_data.get("common_diseases", [])
    )


def get_current_stage(crop_type: str, accumulated_gdd: float) -> Optional[CropStageInfo]:
    """Determine current growth stage based on accumulated GDD."""
    crop_info = get_crop_info(crop_type)
    if not crop_info:
        return None
    
    current_stage = None
    for stage_name, stage_info in crop_info.stages.items():
        if stage_info.gdd_start <= accumulated_gdd < stage_info.gdd_end:
            current_stage = stage_info
            break
    
    # If past all defined stages, return the last one (harvest)
    if current_stage is None and accumulated_gdd > 0:
        stages = list(crop_info.stages.values())
        if stages:
            current_stage = stages[-1]
    
    return current_stage


def get_stage_progress(crop_type: str, accumulated_gdd: float) -> dict:
    """
    Get progress through current stage and overall crop lifecycle.
    
    Returns:
        dict with current_stage, stage_progress (0-1), overall_progress (0-1),
        days_to_next_stage estimate
    """
    crop_info = get_crop_info(crop_type)
    if not crop_info:
        return {}
    
    current_stage = get_current_stage(crop_type, accumulated_gdd)
    if not current_stage:
        return {}
    
    # Calculate stage progress
    stage_total = current_stage.gdd_end - current_stage.gdd_start
    stage_current = accumulated_gdd - current_stage.gdd_start
    stage_progress = min(1.0, max(0.0, stage_current / stage_total)) if stage_total > 0 else 1.0
    
    # Calculate overall progress (up to maturity)
    maturity_gdd = 0
    for stage_name, stage_info in crop_info.stages.items():
        if stage_name == "harvest":
            maturity_gdd = stage_info.gdd_start
            break
    
    overall_progress = min(1.0, accumulated_gdd / maturity_gdd) if maturity_gdd > 0 else 0.0
    
    return {
        "current_stage": current_stage.name,
        "stage_description": current_stage.description,
        "stage_progress": round(stage_progress, 2),
        "overall_progress": round(overall_progress, 2),
        "gdd_to_next_stage": max(0, current_stage.gdd_end - accumulated_gdd),
        "water_need": current_stage.water_need,
        "nutrient_need": current_stage.nutrient_need,
        "heat_sensitive": current_stage.heat_sensitive,
        "critical_temp_max": current_stage.critical_temp_max
    }


def get_risk_rules() -> list[RiskRule]:
    """Get all risk assessment rules."""
    data = load_crop_data()
    return [RiskRule(**rule) for rule in data.get("risk_rules", [])]


def get_spray_conditions() -> dict:
    """Get optimal conditions for spraying."""
    data = load_crop_data()
    return data.get("general_advisories", {}).get("spray_conditions", {})


def get_irrigation_triggers() -> dict:
    """Get irrigation trigger thresholds."""
    data = load_crop_data()
    return data.get("general_advisories", {}).get("irrigation_triggers", {})


def get_available_crops() -> list[str]:
    """Get list of all crops in the knowledge base."""
    data = load_crop_data()
    return list(data.get("crops", {}).keys())
