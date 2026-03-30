import sqlite3
import os
import json
import urllib.request
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "farm.db")


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_all_zones() -> dict:
    """Get all farm zones with their current status, crop type, irrigation status, and yield data.
    Returns a dictionary with zone information for the user's farm zones."""
    try:
        conn = _get_db()
        rows = conn.execute("SELECT * FROM zones").fetchall()
        conn.close()
        zones = [dict(r) for r in rows]
        return {"zones": zones, "count": len(zones)}
    except Exception as e:
        return {"error": str(e)}


def get_zone_details(zone_id: int) -> dict:
    """Get detailed information about a specific farm zone including crop type, planting date, area, status, yield, and irrigation status.

    Args:
        zone_id: The numeric ID of the zone to look up.
    """
    try:
        conn = _get_db()
        row = conn.execute("SELECT * FROM zones WHERE id = ?", (zone_id,)).fetchone()
        conn.close()
        if row:
            return dict(row)
        return {"error": f"Zone {zone_id} not found"}
    except Exception as e:
        return {"error": str(e)}


def get_zone_tasks(zone_id: int) -> dict:
    """Get all scheduled tasks for a specific zone, including irrigation, fertigation, and scouting tasks.

    Args:
        zone_id: The numeric ID of the zone.
    """
    try:
        conn = _get_db()
        rows = conn.execute(
            "SELECT * FROM tasks WHERE zone_id = ? ORDER BY scheduled_time ASC", (zone_id,)
        ).fetchall()
        conn.close()
        return {"tasks": [dict(r) for r in rows], "zone_id": zone_id}
    except Exception as e:
        return {"error": str(e)}


def get_all_tasks() -> dict:
    """Get all farm tasks across all zones, ordered by schedule time. Includes task type, status, and reasoning."""
    try:
        conn = _get_db()
        rows = conn.execute(
            "SELECT t.*, z.name as zone_name, z.crop_type FROM tasks t LEFT JOIN zones z ON t.zone_id = z.id ORDER BY t.scheduled_time ASC"
        ).fetchall()
        conn.close()
        return {"tasks": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


def get_pending_tasks() -> dict:
    """Get only pending (not yet completed) tasks across all zones."""
    try:
        conn = _get_db()
        rows = conn.execute(
            "SELECT t.*, z.name as zone_name, z.crop_type FROM tasks t LEFT JOIN zones z ON t.zone_id = z.id WHERE t.status = 'Pending' ORDER BY t.scheduled_time ASC"
        ).fetchall()
        conn.close()
        return {"tasks": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


def create_task(zone_id: int, task_type: str, scheduled_time: str, duration_minutes: int, reasoning: str) -> dict:
    """Create a new farm task for a specific zone.

    Args:
        zone_id: The zone ID where the task should be performed.
        task_type: Type of task - must be one of 'Irrigation', 'Fertigation', or 'Scouting'.
        scheduled_time: When to perform the task in ISO format (e.g. '2026-03-14T08:00:00').
        duration_minutes: Expected duration in minutes.
        reasoning: Why this task is needed.
    """
    valid_types = ('Irrigation', 'Fertigation', 'Scouting')
    if task_type not in valid_types:
        return {"error": f"Invalid task_type '{task_type}'. Must be one of: {', '.join(valid_types)}"}
    try:
        conn = _get_db()
        conn.execute(
            "INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, status, reasoning) VALUES (?, ?, ?, ?, 'Pending', ?)",
            (zone_id, task_type, scheduled_time, duration_minutes, reasoning)
        )
        conn.commit()
        task_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        return {"success": True, "task_id": task_id, "message": f"Task '{task_type}' created for zone {zone_id}"}
    except Exception as e:
        return {"error": str(e)}


def get_recent_logs(limit: int = 20) -> dict:
    """Get recent farm activity logs including alerts, irrigation events, and system messages.

    Args:
        limit: Maximum number of log entries to return (default 20).
    """
    try:
        conn = _get_db()
        rows = conn.execute(
            "SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id ORDER BY l.timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()
        conn.close()
        return {"logs": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


def get_zone_logs(zone_id: int) -> dict:
    """Get activity logs for a specific zone.

    Args:
        zone_id: The numeric ID of the zone.
    """
    try:
        conn = _get_db()
        rows = conn.execute(
            "SELECT * FROM logs WHERE zone_id = ? ORDER BY timestamp DESC LIMIT 20", (zone_id,)
        ).fetchall()
        conn.close()
        return {"logs": [dict(r) for r in rows], "zone_id": zone_id}
    except Exception as e:
        return {"error": str(e)}


def update_zone_irrigation(zone_id: int, status: str) -> dict:
    """Update the irrigation status of a zone.

    Args:
        zone_id: The zone ID to update.
        status: New irrigation status - must be either 'Off' or 'Running'.
    """
    if status not in ('Off', 'Running'):
        return {"error": f"Invalid status '{status}'. Must be 'Off' or 'Running'."}

    try:
        conn = _get_db()
        conn.execute("UPDATE zones SET irrigation_status = ? WHERE id = ?", (status, zone_id))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Zone {zone_id} irrigation updated to '{status}'"}
    except Exception as e:
        return {"error": str(e)}


def get_farm_summary() -> dict:
    """Get a complete summary of the farm: all zones, pending tasks count, recent alerts, and overall status."""
    try:
        conn = _get_db()
        zones = [dict(r) for r in conn.execute("SELECT * FROM zones").fetchall()]
        pending = conn.execute("SELECT COUNT(*) as count FROM tasks WHERE status = 'Pending'").fetchone()[0]
        alerts = [dict(r) for r in conn.execute(
            "SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id WHERE l.severity IN ('warning', 'error') ORDER BY l.timestamp DESC LIMIT 5"
        ).fetchall()]
        conn.close()
        total_area = sum(z.get("area_size", 0) for z in zones)
        return {
            "farm_name": "My Farm",
            "location": "Tanzania",
            "total_area": f"{total_area} acres",
            "zones": zones,
            "pending_tasks": pending,
            "recent_alerts": alerts,
            "date": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}


def get_pest_info(pest_name: str) -> dict:
    """Get information about a specific pest common to horticulture and maize farming in Tanzania.

    Args:
        pest_name: Name of the pest to look up (e.g. 'Tuta Absoluta', 'Thrips', 'Whitefly', 'Fall Armyworm', 'Stem Borer').
    """
    pest_db = {
        "tuta absoluta": {
            "name": "Tuta Absoluta (Tomato Leaf Miner)",
            "affects": "Tomatoes, Eggplant, Peppers",
            "symptoms": "Irregular mines on leaves, fruit boring, wilting foliage",
            "treatment": "Pheromone traps, Bacillus thuringiensis (Bt), neem-based pesticides, remove affected leaves",
            "prevention": "Crop rotation, resistant varieties, yellow sticky traps, proper spacing",
            "severity": "High - can cause 80-100% crop loss if untreated"
        },
        "thrips": {
            "name": "Thrips (Onion Thrips - Thrips tabaci)",
            "affects": "Onions, Tomatoes, Peppers, Cabbage",
            "symptoms": "Silver/white streaks on leaves, curling, stunted growth",
            "treatment": "Spinosad, neem oil, insecticidal soap, overhead irrigation to wash off",
            "prevention": "Remove crop residues, avoid planting near garlic/leek fields, blue sticky traps",
            "severity": "Medium-High"
        },
        "whitefly": {
            "name": "Whitefly (Bemisia tabaci)",
            "affects": "Tomatoes, Peppers, Eggplant, Cucumbers, Watermelon",
            "symptoms": "Yellowing leaves, honeydew on leaves, sooty mold, virus transmission (TYLCV)",
            "treatment": "Yellow sticky traps, neem oil, insecticidal soap, remove heavily infested plants",
            "prevention": "Reflective mulches, resistant varieties, biological control with Encarsia formosa",
            "severity": "High - also transmits Tomato Yellow Leaf Curl Virus"
        },
        "fall armyworm": {
            "name": "Fall Armyworm (Spodoptera frugiperda)",
            "affects": "Maize (primary), Tomatoes, Onions, Cabbage, Peppers",
            "symptoms": "Ragged holes in leaves, frass on plants, larvae visible at night, windowing on maize leaves, bore into maize cobs",
            "treatment": "Bt spray, hand picking, pyrethroid sprays as last resort, biological control with Trichogramma",
            "prevention": "Early planting, intercropping with repellent plants (desmodium push-pull for maize), pheromone traps, destroy crop residues",
            "severity": "Very High for maize - can destroy entire field if untreated"
        },
        "armyworm": {
            "name": "Fall Armyworm (Spodoptera frugiperda)",
            "affects": "Maize (primary), Tomatoes, Onions, Cabbage",
            "symptoms": "Ragged holes in leaves, frass on plants, larvae visible at night",
            "treatment": "Bt spray, hand picking, pyrethroid sprays as last resort",
            "prevention": "Early planting, intercropping with repellent plants, pheromone traps",
            "severity": "Very High for maize"
        },
        "stem borer": {
            "name": "Maize Stem Borer (Busseola fusca / Chilo partellus)",
            "affects": "Maize",
            "symptoms": "Dead heart in young plants, stem tunneling, broken tassels, poor grain fill",
            "treatment": "Apply granular insecticide in leaf whorl, remove and destroy infested stems",
            "prevention": "Push-pull technology (Desmodium + Napier grass), early planting, crop rotation, destroy stalks after harvest",
            "severity": "High - can reduce maize yield by 30-50%"
        },
        "maize streak virus": {
            "name": "Maize Streak Virus (MSV)",
            "affects": "Maize",
            "symptoms": "Yellow streaks along leaf veins, stunted growth, poor cob development",
            "treatment": "No cure - remove infected plants, control leafhopper vectors with insecticides",
            "prevention": "Plant MSV-resistant varieties, control leafhoppers, avoid late planting",
            "severity": "High - can cause 100% loss in susceptible varieties"
        },
        "aphids": {
            "name": "Aphids (Myzus persicae / Aphis gossypii)",
            "affects": "Tomatoes, Onions, Peppers, Cabbage, Lettuce, Cucumbers, Okra",
            "symptoms": "Curled leaves, sticky honeydew, stunted growth, virus transmission",
            "treatment": "Strong water spray, neem oil, ladybug release, insecticidal soap",
            "prevention": "Companion planting with marigolds, avoid excessive nitrogen fertilizer",
            "severity": "Medium"
        },
        "diamondback moth": {
            "name": "Diamondback Moth (Plutella xylostella)",
            "affects": "Cabbage, Spinach, other brassicas",
            "symptoms": "Small holes in leaves, 'windowpane' damage, small green caterpillars on undersides",
            "treatment": "Bt spray, spinosad, neem oil, hand picking",
            "prevention": "Intercrop with tomatoes or onions, use pheromone traps, remove crop residues",
            "severity": "High for cabbage"
        },
        "fruit fly": {
            "name": "Fruit Fly (Bactrocera spp.)",
            "affects": "Cucumbers, Watermelon, Tomatoes, Peppers",
            "symptoms": "Puncture marks on fruit, larvae inside fruit, premature fruit drop",
            "treatment": "Protein bait traps, harvest early, destroy fallen fruit",
            "prevention": "Pheromone traps, sanitation, early harvest at breaker stage",
            "severity": "Medium-High"
        },
        "powdery mildew": {
            "name": "Powdery Mildew",
            "affects": "Cucumbers, Watermelon, Okra, Peppers, Eggplant",
            "symptoms": "White powdery spots on leaves and stems, yellowing, leaf drop",
            "treatment": "Sulfur-based fungicide, potassium bicarbonate, neem oil, remove affected leaves",
            "prevention": "Good air circulation, avoid overhead irrigation, resistant varieties, proper spacing",
            "severity": "Medium"
        },
        "striga": {
            "name": "Striga (Witchweed - Striga hermonthica)",
            "affects": "Maize",
            "symptoms": "Stunted growth, wilting despite adequate water, purple/pink parasitic flowers near maize base",
            "treatment": "Hand pulling before flowering, imazapyr-resistant (IR) maize varieties, push-pull technology",
            "prevention": "Crop rotation with legumes, use Striga-resistant varieties, improve soil fertility",
            "severity": "Very High in infested fields - can cause total crop failure"
        },
        "nematodes": {
            "name": "Root-knot Nematodes (Meloidogyne spp.)",
            "affects": "Tomatoes, Carrots, Lettuce, Okra, Cucumbers, Eggplant",
            "symptoms": "Stunted growth, wilting, root galls/knots, yellowing leaves",
            "treatment": "Soil solarization, neem cake, crop rotation with non-host crops",
            "prevention": "Resistant varieties, rotate with maize/onion, organic matter amendments",
            "severity": "Medium-High"
        }
    }
    key = pest_name.lower().strip()
    for k, v in pest_db.items():
        if k in key or key in k:
            return v
    return {
        "message": f"No specific data for '{pest_name}'. Common pests on this farm include: Tuta Absoluta (tomatoes), Thrips (onions), Fall Armyworm (maize), Diamondback Moth (cabbage), Aphids, Whitefly, Fruit Fly, Powdery Mildew, Stem Borer, Striga. Ask about any of these.",
        "available_pests": list(pest_db.keys())
    }


def get_market_prices() -> dict:
    """Get current estimated market prices for horticulture crops and maize in Tanzania (Dar es Salaam markets)."""
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "market": "Kariakoo / Dar es Salaam wholesale",
        "prices": {
            "tomatoes": {
                "price_per_kg_tzs": "1,500 - 3,000 TZS",
                "price_per_crate_tzs": "40,000 - 80,000 TZS (per 20kg crate)",
                "trend": "Stable, slightly rising due to dry season demand",
                "best_selling_period": "December - March (high demand)"
            },
            "onions": {
                "price_per_kg_tzs": "2,000 - 4,000 TZS",
                "price_per_bag_tzs": "80,000 - 150,000 TZS (per 50kg bag)",
                "trend": "Rising - imports from India reduced, local demand high",
                "best_selling_period": "Year-round, peak June-August"
            },
            "peppers": {
                "price_per_kg_tzs": "3,000 - 6,000 TZS",
                "trend": "High demand, good margins",
                "best_selling_period": "Year-round, peak during dry season"
            },
            "cabbage": {
                "price_per_kg_tzs": "500 - 1,500 TZS",
                "trend": "Seasonal, lower during peak harvest",
                "best_selling_period": "Dry season (June-October)"
            },
            "spinach": {
                "price_per_kg_tzs": "800 - 1,500 TZS",
                "trend": "Consistent demand",
                "best_selling_period": "Year-round"
            },
            "cucumbers": {
                "price_per_kg_tzs": "1,000 - 2,500 TZS",
                "trend": "Growing demand in urban areas",
                "best_selling_period": "Year-round"
            },
            "watermelon": {
                "price_per_kg_tzs": "500 - 1,500 TZS",
                "trend": "High demand in hot season",
                "best_selling_period": "October - March (hot season)"
            },
            "eggplant": {
                "price_per_kg_tzs": "1,500 - 3,000 TZS",
                "trend": "Stable demand",
                "best_selling_period": "Year-round"
            },
            "carrots": {
                "price_per_kg_tzs": "1,500 - 3,000 TZS",
                "trend": "Growing demand, good urban market",
                "best_selling_period": "Year-round"
            },
            "lettuce": {
                "price_per_kg_tzs": "2,000 - 4,000 TZS",
                "trend": "Premium prices in urban markets, hotels, restaurants",
                "best_selling_period": "Year-round"
            },
            "okra": {
                "price_per_kg_tzs": "1,500 - 3,000 TZS",
                "trend": "Steady local demand",
                "best_selling_period": "Year-round"
            },
            "green_beans": {
                "price_per_kg_tzs": "2,000 - 4,000 TZS",
                "trend": "Export potential to Europe, strong local demand",
                "best_selling_period": "Year-round, export peak Nov-May"
            },
            "maize": {
                "price_per_kg_tzs": "600 - 1,200 TZS",
                "price_per_bag_tzs": "60,000 - 120,000 TZS (per 100kg bag)",
                "trend": "Staple crop, prices rise during lean season",
                "best_selling_period": "February - May (lean season, highest prices)"
            }
        },
        "note": "Prices fluctuate. Check Kariakoo market or contact TAHA (Tanzania Horticultural Association) for daily rates. For maize, check NFRA (National Food Reserve Agency) reference prices."
    }


def get_harvest_recommendation(crop_type: str) -> dict:
    """Get harvest timing recommendations for a specific crop grown in Tanzania.

    Args:
        crop_type: The crop type (e.g. 'tomato', 'onion', 'maize', 'pepper', 'cabbage', etc.).
    """
    recommendations = {
        "tomato": {
            "crop": "Tomato",
            "days_to_maturity": "60-85 days after transplanting",
            "harvest_signs": [
                "Fruit turns from green to light red/pink (breaker stage for transport)",
                "Fruit is firm but slightly soft when pressed gently",
                "Bottom of fruit shows color change first",
                "Morning harvest is best (cooler temperatures)"
            ],
            "post_harvest": [
                "Sort by ripeness and size",
                "Handle gently to avoid bruising",
                "Store in shade, ventilated area",
                "Transport to market within 2-3 days of harvest"
            ],
            "local_tips": "In Tanzania's warm climate, tomatoes ripen faster. Start checking at 55 days."
        },
        "onion": {
            "crop": "Onion",
            "days_to_maturity": "90-120 days from transplanting",
            "harvest_signs": [
                "Tops/leaves fall over naturally (50-80% fallen)",
                "Neck becomes soft and thin",
                "Outer skin becomes papery",
                "Bulb feels firm when squeezed"
            ],
            "post_harvest": [
                "Cure in sun for 3-5 days, then shade for 2 weeks",
                "Trim tops to 2cm above bulb",
                "Store in dry, ventilated area",
                "Can store 2-4 months if properly cured"
            ],
            "local_tips": "High humidity can cause rot during curing. Ensure good airflow and avoid curing during rain."
        },
        "pepper": {
            "crop": "Pepper",
            "days_to_maturity": "60-90 days after transplanting",
            "harvest_signs": [
                "Fruit reaches full size and desired color (green, red, or yellow depending on variety)",
                "Firm fruit with glossy skin",
                "Easily snaps off the plant"
            ],
            "post_harvest": ["Handle carefully to avoid bruising", "Store at 7-10°C", "Sort by size and color"],
            "local_tips": "In Tanzania's heat, peppers color faster. Harvest in morning for best quality."
        },
        "cabbage": {
            "crop": "Cabbage",
            "days_to_maturity": "70-90 days after transplanting",
            "harvest_signs": ["Head feels firm and solid when squeezed", "Head reaches expected size for variety", "Outer leaves may start yellowing"],
            "post_harvest": ["Remove loose outer leaves", "Store in cool shade", "Can keep 2-3 weeks in proper conditions"],
            "local_tips": "Harvest early morning to avoid heat wilting. Don't delay harvest as heads may split."
        },
        "spinach": {
            "crop": "Spinach",
            "days_to_maturity": "35-45 days from planting",
            "harvest_signs": ["Leaves reach 15-20cm length", "Dark green color, tender leaves", "Before bolting (flowering)"],
            "post_harvest": ["Harvest early morning", "Keep moist and cool", "Sell same day for best price"],
            "local_tips": "Fast-growing crop in Tanzania's climate. Can get 3-4 harvests by cutting outer leaves."
        },
        "cucumber": {
            "crop": "Cucumber",
            "days_to_maturity": "50-60 days from planting",
            "harvest_signs": ["Fruit 15-20cm long, dark green", "Firm and crisp", "Don't let them turn yellow — overripe"],
            "post_harvest": ["Keep cool and moist", "Sell within 2-3 days", "Sort by size"],
            "local_tips": "In Tanzania's heat, check daily — cucumbers grow fast and can become oversized quickly."
        },
        "watermelon": {
            "crop": "Watermelon",
            "days_to_maturity": "70-85 days from planting",
            "harvest_signs": ["Ground spot turns cream/yellow", "Tendril near fruit dries up", "Hollow sound when tapped", "Skin resists scratching"],
            "post_harvest": ["Handle gently — bruising reduces shelf life", "Store in shade", "Can keep 2-3 weeks uncut"],
            "local_tips": "Reduce irrigation 7-10 days before harvest for sweeter fruit."
        },
        "eggplant": {
            "crop": "Eggplant",
            "days_to_maturity": "60-80 days after transplanting",
            "harvest_signs": ["Glossy skin (dull = overripe)", "Firm flesh that springs back", "Seeds still white (not brown)"],
            "post_harvest": ["Handle carefully", "Store at 10-12°C", "Best sold within a week"],
            "local_tips": "Harvest regularly to encourage more fruiting. Sell when skin is glossy and deep purple."
        },
        "carrot": {
            "crop": "Carrot",
            "days_to_maturity": "70-80 days from direct seeding",
            "harvest_signs": ["Top of root visible at soil surface (2-3cm diameter)", "Bright orange color", "Shoulders about 2cm across"],
            "post_harvest": ["Remove tops immediately", "Wash gently", "Store in cool moist conditions"],
            "local_tips": "Sandy loam soils produce the straightest roots. Harvest before soil becomes waterlogged."
        },
        "lettuce": {
            "crop": "Lettuce",
            "days_to_maturity": "45-60 days from transplanting",
            "harvest_signs": ["Heads feel firm", "Full size for variety", "Before bolting in heat"],
            "post_harvest": ["Harvest early morning", "Keep moist and cool immediately", "Best sold same day"],
            "local_tips": "In hot regions, grow in partial shade to prevent bolting. Target hotels and restaurants for premium prices."
        },
        "okra": {
            "crop": "Okra",
            "days_to_maturity": "45-55 days from planting",
            "harvest_signs": ["Pods 7-10cm long", "Tender and snaps easily", "Harvest every 2 days in peak season"],
            "post_harvest": ["Handle gently", "Sort by size", "Sell fresh within 1-2 days"],
            "local_tips": "Okra thrives in Tanzania's warm climate. Harvest frequently to keep plants producing."
        },
        "green bean": {
            "crop": "Green Bean",
            "days_to_maturity": "45-55 days from planting",
            "harvest_signs": ["Pods snap cleanly", "Seeds not yet bulging", "Bright green color"],
            "post_harvest": ["Keep cool", "Sort by size and straightness for export", "Sell within 2 days"],
            "local_tips": "Good export crop. French beans fetch premium prices in European markets — sort carefully for export grade."
        },
        "maize": {
            "crop": "Maize",
            "days_to_maturity": "90-120 days from planting (depends on variety)",
            "harvest_signs": [
                "Husks turn brown and dry",
                "Kernels hard and dent when pressed (for dry maize)",
                "Milk line has moved to base of kernel",
                "Moisture content below 20% ideal for storage"
            ],
            "post_harvest": [
                "Dry to 13% moisture before storage",
                "Shell and store in airtight containers or hermetic bags",
                "Treat with storage pesticide if needed",
                "Can sell as green maize (roasted) for higher prices at 70-80 days"
            ],
            "local_tips": "Plant at the start of long rains (March-April) or short rains (October-November). Watch for Fall Armyworm — scout weekly from germination."
        }
    }
    key = crop_type.lower().strip()
    for k, v in recommendations.items():
        if k in key or key in k:
            return v
    return {"error": f"Unknown crop '{crop_type}'. Available crops: " + ", ".join(recommendations.keys())}


TANZANIA_CENTER_LAT = -6.1731
TANZANIA_CENTER_LON = 35.7395

_weather_cache = {"data": None, "fetched_at": None}


def get_weather_forecast() -> dict:
    """Get the current weather and 7-day forecast for the farmer's region in Tanzania.
    Returns daily temperature (min/max), precipitation, humidity, wind speed, and rain probability.
    Use this to advise on fertigation timing, irrigation scheduling, and weather-sensitive farm operations."""
    now = datetime.now()
    if _weather_cache["data"] and _weather_cache["fetched_at"] and (now - _weather_cache["fetched_at"]).total_seconds() < 1800:
        return _weather_cache["data"]

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={TANZANIA_CENTER_LAT}&longitude={TANZANIA_CENTER_LON}"
            f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code"
            f"&timezone=Africa%2FDar_es_Salaam"
            f"&forecast_days=7"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "BwanaShamba/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        wmo_codes = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
            80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
            95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm"
        }

        current = data.get("current", {})
        daily = data.get("daily", {})

        result = {
            "location": "Tanzania",
            "current": {
                "temp": current.get("temperature_2m"),
                "humidity": current.get("relative_humidity_2m"),
                "wind": current.get("wind_speed_10m"),
                "condition": wmo_codes.get(current.get("weather_code", 0), "Unknown"),
            },
            "forecast": [],
            "fertigation_advice": [],
        }

        dates = daily.get("time", [])
        temp_max = daily.get("temperature_2m_max", [])
        temp_min = daily.get("temperature_2m_min", [])
        precip = daily.get("precipitation_sum", [])
        rain_prob = daily.get("precipitation_probability_max", [])
        wind_max = daily.get("wind_speed_10m_max", [])
        codes = daily.get("weather_code", [])

        good_fertigation_days = []

        for i in range(len(dates)):
            day_data = {
                "date": dates[i],
                "day_name": (datetime.strptime(dates[i], "%Y-%m-%d")).strftime("%A"),
                "high": temp_max[i] if i < len(temp_max) else None,
                "low": temp_min[i] if i < len(temp_min) else None,
                "precipitation_mm": precip[i] if i < len(precip) else 0,
                "rain_probability": rain_prob[i] if i < len(rain_prob) else 0,
                "wind_max": wind_max[i] if i < len(wind_max) else None,
                "condition": wmo_codes.get(codes[i] if i < len(codes) else 0, "Unknown"),
            }
            result["forecast"].append(day_data)

            p = precip[i] if i < len(precip) else 0
            rp = rain_prob[i] if i < len(rain_prob) else 0
            w = wind_max[i] if i < len(wind_max) else 0
            th = temp_max[i] if i < len(temp_max) else 30

            is_good = p < 2 and rp < 30 and w < 25 and th < 38
            if is_good and i > 0:
                reasons = []
                if p < 1:
                    reasons.append("no rain expected")
                if rp < 20:
                    reasons.append(f"low rain chance ({rp}%)")
                if w < 15:
                    reasons.append("calm winds")
                if 25 <= th <= 33:
                    reasons.append("optimal temperature range")
                good_fertigation_days.append({
                    "date": dates[i],
                    "day_name": day_data["day_name"],
                    "score": "excellent" if (p < 1 and rp < 15 and w < 15) else "good",
                    "reasons": reasons,
                    "best_time": "Early morning (5:30-7:00 AM) before heat builds up"
                })

        result["fertigation_advice"] = {
            "recommended_days": good_fertigation_days[:3],
            "general_rules": [
                "Apply fertigation when no rain is expected for 24-48 hours (prevents nutrient wash-off)",
                "Avoid fertigation on windy days (>25 km/h) to prevent uneven distribution",
                "Best time: early morning (5:30-7:00 AM) when soil absorption is highest",
                "Avoid fertigation when temperatures exceed 38°C (nutrient burn risk)",
                "After heavy rain (>10mm), wait 1-2 days before fertigation to avoid waterlogging",
                "For tomatoes in flowering stage: prioritize calcium + potassium fertigation on calm, dry days",
                "For onions in bulbing stage: apply sulfur-based fertilizer during dry spells"
            ]
        }

        _weather_cache["data"] = result
        _weather_cache["fetched_at"] = now
        return result

    except Exception as e:
        return {
            "error": f"Could not fetch weather data: {str(e)}",
            "fallback": {
                "location": "Tanzania",
                "climate": "Tropical climate varies by region. Dry season typically June-October in most areas.",
                "fertigation_general": "Apply fertigation early morning on dry days with low wind. Avoid before expected rain."
            }
        }
