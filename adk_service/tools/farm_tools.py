import os
import json
import urllib.request
from datetime import datetime, timedelta

from google.adk.tools import ToolContext

from adk_service.tools.user_context import (
    NoUserContext,
    api_request,
    resolve_user_id,
)


def _acting_user(tool_context):
    """Returns (user_id, None) or (None, error_dict) for a tool to return as-is."""
    try:
        return resolve_user_id(tool_context), None
    except NoUserContext as e:
        return None, {"error": str(e), "success": False}


def _call(method: str, path: str, tool_context, payload: dict = None):
    """Runs an internal-API call for the acting farmer, converting failures into
    an error dict so the agent reports the failure instead of assuming success."""
    user_id, err = _acting_user(tool_context)
    if err:
        return err
    try:
        return api_request(method, path, user_id, payload)
    except Exception as e:
        return {"error": str(e), "success": False}


def get_all_zones(tool_context: ToolContext = None) -> dict:
    """Get all farm zones for this farmer with crop type, planting date, area, status and yield data."""
    return _call("GET", "zones", tool_context)


def get_zone_details(zone_id: int, tool_context: ToolContext = None) -> dict:
    """Get detailed information about one of this farmer's zones: crop type, planting date, area, status and yield.

    Args:
        zone_id: The numeric ID of the zone to look up.
    """
    return _call("GET", f"zones/{int(zone_id)}", tool_context)


def get_zone_tasks(zone_id: int, tool_context: ToolContext = None) -> dict:
    """Get all scheduled tasks for a specific zone, including irrigation, fertigation, and scouting tasks.

    Args:
        zone_id: The numeric ID of the zone.
    """
    return _call("GET", f"zones/{int(zone_id)}/tasks", tool_context)


def get_all_tasks(tool_context: ToolContext = None) -> dict:
    """Get all of this farmer's tasks across all zones, ordered by schedule time. Includes task type, status, and reasoning."""
    return _call("GET", "tasks", tool_context)


def get_pending_tasks(tool_context: ToolContext = None) -> dict:
    """Get only this farmer's pending (not yet completed) tasks across all zones."""
    return _call("GET", "tasks?status=Pending", tool_context)


def create_task(
    zone_id: int,
    task_type: str,
    scheduled_time: str,
    duration_minutes: int,
    reasoning: str,
    tool_context: ToolContext = None,
) -> dict:
    """Create a new farm task in the farmer's task list. The task appears in their app immediately.

    Only report the task as added if this returns success: true. If it returns an
    error, tell the farmer the task could not be saved and say why.

    Args:
        zone_id: The zone ID where the task should be performed. Must be one of this farmer's own zones — call get_all_zones first if unsure.
        task_type: Type of task - must be one of 'Irrigation', 'Fertigation', or 'Scouting'.
        scheduled_time: When to perform the task in ISO format (e.g. '2026-03-14T08:00:00').
        duration_minutes: Expected duration in minutes.
        reasoning: Why this task is needed.
    """
    valid_types = ('Irrigation', 'Fertigation', 'Scouting')
    if task_type not in valid_types:
        return {
            "success": False,
            "error": f"Invalid task_type '{task_type}'. Must be one of: {', '.join(valid_types)}",
        }

    result = _call("POST", "tasks", tool_context, {
        "zone_id": zone_id,
        "task_type": task_type,
        "scheduled_time": scheduled_time,
        "duration_minutes": duration_minutes,
        "reasoning": reasoning,
    })

    if result.get("success"):
        task = result.get("task", {})
        return {
            "success": True,
            "task_id": task.get("id"),
            "message": f"Task '{task_type}' saved to the farmer's task list for {task.get('zone_name', f'zone {zone_id}')}",
        }
    return result


def get_recent_logs(limit: int = 20, tool_context: ToolContext = None) -> dict:
    """Get this farmer's recent farm activity logs including alerts, irrigation events, and system messages.

    Args:
        limit: Maximum number of log entries to return (default 20).
    """
    return _call("GET", f"logs?limit={int(limit)}", tool_context)


def get_zone_logs(zone_id: int, tool_context: ToolContext = None) -> dict:
    """Get activity logs for a specific zone.

    Args:
        zone_id: The numeric ID of the zone.
    """
    return _call("GET", f"zones/{int(zone_id)}/logs", tool_context)


def get_farm_summary(tool_context: ToolContext = None) -> dict:
    """Get a complete summary of this farmer's farm: all zones, pending task count, recent alerts, and overall status."""
    return _call("GET", "summary", tool_context)


def get_pest_info(pest_name: str) -> dict:
    """Get information about a pest or disease affecting crops grown in Tanzania.

    Args:
        pest_name: Name of the pest or disease to look up (e.g. 'Tuta Absoluta', 'Fall Armyworm',
                   'Cassava Mosaic', 'Coffee Berry Borer', 'Rice Blast', 'Late Blight').
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
            "affects": "Tomatoes, Carrots, Lettuce, Okra, Cucumbers, Eggplant, Irish Potato, Banana",
            "symptoms": "Stunted growth, wilting, root galls/knots, yellowing leaves",
            "treatment": "Soil solarization, neem cake, crop rotation with non-host crops",
            "prevention": "Resistant varieties, rotate with maize/onion, organic matter amendments",
            "severity": "Medium-High"
        },
        "cassava mosaic": {
            "name": "Cassava Mosaic Disease (CMD, whitefly-transmitted virus)",
            "affects": "Cassava",
            "symptoms": "Yellow-green mosaic patterning on leaves, distorted and reduced leaf size, stunted plants, small roots",
            "treatment": "No cure once infected — rogue out and destroy affected plants, control whitefly vectors",
            "prevention": "Plant certified CMD-resistant varieties, use clean cuttings from healthy fields, never take cuttings from symptomatic plants",
            "severity": "Very High - the main cause of cassava yield loss in Tanzania"
        },
        "cassava brown streak": {
            "name": "Cassava Brown Streak Disease (CBSD)",
            "affects": "Cassava",
            "symptoms": "Yellow blotches between leaf veins, brown streaks on stems, dry brown necrotic rot inside the roots",
            "treatment": "No cure — harvest early where infection is found and destroy affected material",
            "prevention": "CBSD-tolerant varieties, clean planting material, whitefly control, avoid moving cuttings between areas",
            "severity": "Very High - roots can be unsaleable even when the plant looks healthy"
        },
        "banana weevil": {
            "name": "Banana Weevil (Cosmopolites sordidus)",
            "affects": "Banana",
            "symptoms": "Tunnels in the corm, plants topple in wind, reduced bunch size, gradual decline of the whole stand",
            "treatment": "Trap with split pseudostem traps, destroy infested corms, apply Beauveria bassiana where available",
            "prevention": "Pare and hot-water treat suckers before planting, remove crop residues, maintain field sanitation",
            "severity": "High - main cause of declining old banana stands in Kagera and Kilimanjaro"
        },
        "coffee berry borer": {
            "name": "Coffee Berry Borer (Hypothenemus hampei)",
            "affects": "Coffee",
            "symptoms": "Small entry hole at the tip of the berry, hollowed and blackened beans, premature berry drop",
            "treatment": "Strip and destroy all leftover berries after harvest, alcohol/methanol traps, Beauveria bassiana",
            "prevention": "Complete and timely harvesting, field sanitation, never leave dry berries on trees or ground",
            "severity": "High - directly downgrades your auction price"
        },
        "coffee leaf rust": {
            "name": "Coffee Leaf Rust (Hemileia vastatrix)",
            "affects": "Coffee",
            "symptoms": "Orange-yellow powdery spots on the underside of leaves, heavy leaf drop, dieback of bearing wood",
            "treatment": "Copper-based fungicides on a preventive schedule, prune to open the canopy",
            "prevention": "Resistant varieties, adequate shade and spacing, balanced nutrition, remove infected leaves",
            "severity": "High"
        },
        "rice blast": {
            "name": "Rice Blast (Magnaporthe oryzae)",
            "affects": "Rice",
            "symptoms": "Diamond-shaped grey lesions with brown borders on leaves, rotted neck below the panicle, empty grains",
            "treatment": "Tricyclazole or azoxystrobin at early symptom stage, drain and re-flood to reduce humidity",
            "prevention": "Resistant varieties, avoid excess nitrogen, wider spacing for airflow, clean seed",
            "severity": "High - neck blast can destroy an otherwise good crop"
        },
        "bean fly": {
            "name": "Bean Fly / Bean Stem Maggot (Ophiomyia spp.)",
            "affects": "Common Bean, Cowpea, Soybean",
            "symptoms": "Yellowing and wilting of young seedlings, swollen and cracked stem base, plants die 2-4 weeks after emergence",
            "treatment": "Seed dressing with systemic insecticide, earthing up around stems to encourage adventitious roots",
            "prevention": "Early planting, mulching, crop rotation, destroy infested residues",
            "severity": "High on late-planted crops"
        },
        "late blight": {
            "name": "Late Blight (Phytophthora infestans)",
            "affects": "Irish Potato, Tomato",
            "symptoms": "Water-soaked dark lesions on leaves with white mould underneath, rapid collapse of foliage, rotting tubers",
            "treatment": "Protectant then systemic fungicides (mancozeb, then metalaxyl-based) on a strict schedule during wet weather",
            "prevention": "Clean certified seed potatoes, resistant varieties, wide spacing, destroy volunteer plants and cull piles",
            "severity": "Very High in the Southern Highlands during the rains"
        }
    }
    key = pest_name.lower().strip()
    for k, v in pest_db.items():
        if k in key or key in k:
            return v
    return {
        "message": (
            f"No curated entry for '{pest_name}'. Diagnose it from the symptoms the farmer describes and your own "
            f"knowledge of Tanzanian pests and diseases — do not tell the farmer the pest is unsupported. Curated "
            f"entries cover: Tuta Absoluta, Thrips, Whitefly, Fall Armyworm, Armyworm, Stem Borer, Maize Streak Virus, "
            f"Aphids, Diamondback Moth, Fruit Fly, Powdery Mildew, Striga, Nematodes, Cassava Mosaic, Cassava Brown "
            f"Streak, Banana Weevil, Coffee Berry Borer, Coffee Leaf Rust, Rice Blast, Bean Fly and Late Blight."
        ),
        "available_pests": list(pest_db.keys())
    }


# ─── Crop catalogue ────────────────────────────────────────────────────────────
# Mirrors server/constants/crops.ts — the full set of crops a farmer can open a
# zone for. Keep the two in sync whenever a crop is added or removed.
CROP_CATALOGUE = {
    # Cereals
    "maize": "cereal", "rice": "cereal", "sorghum": "cereal", "millet": "cereal",
    "wheat": "cereal", "barley": "cereal",
    # Vegetables
    "tomato": "vegetable", "kale": "vegetable", "onion": "vegetable", "cabbage": "vegetable",
    "spinach": "vegetable", "amaranth": "vegetable", "sweet pepper": "vegetable",
    "pepper": "vegetable", "cucumber": "vegetable", "eggplant": "vegetable",
    "carrot": "vegetable", "watermelon": "vegetable", "pumpkin": "vegetable",
    "okra": "vegetable", "green bean": "vegetable", "garlic": "vegetable", "lettuce": "vegetable",
    # Legumes
    "common bean": "legume", "cowpea": "legume", "groundnut": "legume",
    "pigeon pea": "legume", "soybean": "legume", "chickpea": "legume",
    # Root crops
    "cassava": "root crop", "sweet potato": "root crop", "irish potato": "root crop", "yam": "root crop",
    # Fruits
    "banana": "fruit", "mango": "fruit", "avocado": "fruit", "coconut": "fruit",
    "papaya": "fruit", "pineapple": "fruit", "orange": "fruit", "passion fruit": "fruit",
    "guava": "fruit", "jackfruit": "fruit",
    # Cash crops
    "cashew": "cash crop", "coffee": "cash crop", "cotton": "cash crop", "sisal": "cash crop",
    "sunflower": "cash crop", "tea": "cash crop", "sugarcane": "cash crop", "tobacco": "cash crop",
    "sesame": "cash crop", "clove": "cash crop", "pyrethrum": "cash crop",
}

# Plurals, common spellings and Kiswahili names → canonical catalogue key.
CROP_ALIASES = {
    # plurals / variants
    "tomatoes": "tomato", "onions": "onion", "peppers": "pepper", "chilli": "pepper",
    "chili": "pepper", "hot pepper": "pepper", "bell pepper": "sweet pepper",
    "capsicum": "sweet pepper", "cucumbers": "cucumber", "carrots": "carrot",
    "eggplants": "eggplant", "aubergine": "eggplant", "brinjal": "eggplant",
    "green beans": "green bean", "french bean": "green bean", "french beans": "green bean",
    "beans": "common bean", "bean": "common bean", "kidney bean": "common bean",
    "groundnuts": "groundnut", "peanut": "groundnut", "peanuts": "groundnut",
    "soya": "soybean", "soya bean": "soybean", "pigeon peas": "pigeon pea",
    "chick pea": "chickpea", "cow pea": "cowpea", "potato": "irish potato",
    "potatoes": "irish potato", "sweet potatoes": "sweet potato", "bananas": "banana",
    "plantain": "banana", "mangoes": "mango", "avocados": "avocado", "pawpaw": "papaya",
    "oranges": "orange", "citrus": "orange", "passionfruit": "passion fruit",
    "cashew nut": "cashew", "cashewnut": "cashew", "cashew nuts": "cashew",
    "coffee beans": "coffee", "sunflower seed": "sunflower", "simsim": "sesame",
    "cloves": "clove", "sukuma wiki": "kale", "collard greens": "kale",
    "irish potatoes": "irish potato", "round potato": "irish potato",
    # Kiswahili (matches CROP_NAMES_SW in src/lib/i18n.ts)
    "mahindi": "maize", "mpunga": "rice", "mchele": "rice", "mtama": "sorghum",
    "uwele": "millet", "ngano": "wheat", "shayiri": "barley",
    "nyanya": "tomato", "vitunguu": "onion", "kabichi": "cabbage", "mchicha": "spinach",
    "mchicha wa miti": "amaranth", "pilipili hoho": "sweet pepper", "pilipili": "pepper",
    "tango": "cucumber", "biringanya": "eggplant", "karoti": "carrot",
    "tikitimaji": "watermelon", "boga": "pumpkin", "bamia": "okra",
    "maharagwe mabichi": "green bean", "vitunguu swaumu": "garlic", "saladi": "lettuce",
    "maharagwe": "common bean", "kunde": "cowpea", "karanga": "groundnut",
    "mbaazi": "pigeon pea", "dengu": "chickpea", "muhogo": "cassava",
    "viazi vitamu": "sweet potato", "viazi mviringo": "irish potato", "kiazi kikuu": "yam",
    "ndizi": "banana", "embe": "mango", "parachichi": "avocado", "nazi": "coconut",
    "papai": "papaya", "nanasi": "pineapple", "machungwa": "orange",
    "matunda ya passion": "passion fruit", "mapera": "guava", "fenesi": "jackfruit",
    "korosho": "cashew", "kahawa": "coffee", "pamba": "cotton", "katani": "sisal",
    "alizeti": "sunflower", "chai": "tea", "miwa": "sugarcane", "tumbaku": "tobacco",
    "ufuta": "sesame", "karafuu": "clove", "pareto": "pyrethrum",
}

# Group-level guidance used when a crop has no curated entry of its own.
_GROUP_MARKET_GUIDANCE = {
    "cereal": "Cereals are storable — prices are lowest at harvest and peak in the lean season (Jan-March). Dry to 13% moisture and store rather than selling into the harvest glut.",
    "vegetable": "Vegetables are perishable and prices swing weekly. Sell within 1-3 days of harvest, target urban markets (Kariakoo, Arusha, Mwanza) and avoid harvesting when everyone else in your area is harvesting.",
    "legume": "Pulses store well and have strong export demand (India, Kenya). Prices firm 2-3 months after harvest — hold if you can store dry and insect-free.",
    "root crop": "Roots and tubers are bulky and perishable once lifted. Cassava can be left in the ground as living storage; potatoes need a cool dark store. Sell near your market to keep transport costs down.",
    "fruit": "Fruit prices depend heavily on grade and timing. Sort by size and blemish, sell first grade to urban retail or hotels, and second grade to processors or local markets.",
    "cash crop": "Cash crops are usually sold through cooperatives, auctions or licensed buyers rather than open markets. Check the crop board or AMCOS indicative price before committing to a buyer.",
}

_GROUP_HARVEST_GUIDANCE = {
    "cereal": "Harvest when grain is hard and moisture is below about 20%, dry to 13% before storage, and store in airtight or hermetic bags to stop weevils.",
    "vegetable": "Harvest in the cool early morning, handle gently to avoid bruising, keep produce shaded and moving to market within 1-3 days.",
    "legume": "Harvest when pods are dry and rattle (grain types) or while pods still snap cleanly (fresh types). Dry thoroughly before bagging to prevent mould and bruchid damage.",
    "root crop": "Lift when foliage yellows and roots have sized up. Cure damaged skin in shade, and avoid bruising — damaged roots rot quickly.",
    "fruit": "Pick at the right maturity stage for your market: firmer fruit for distant markets, fuller ripeness for nearby sales. Cut rather than pull to protect the plant.",
    "cash crop": "Harvest timing and grading determine your price. Follow the buyer's or crop board's quality specification, and dry or cure to the required moisture before delivery.",
}


def _canonical_crop(crop_type: str) -> str:
    """Resolve a user-supplied crop name to a catalogue key ('' if unrecognised)."""
    if not crop_type:
        return ""
    key = " ".join(crop_type.lower().replace("_", " ").replace("-", " ").split())
    if key in CROP_CATALOGUE:
        return key
    if key in CROP_ALIASES:
        return CROP_ALIASES[key]
    # Longest match first so 'sweet pepper' never resolves to 'pepper'.
    for name in sorted(list(CROP_CATALOGUE) + list(CROP_ALIASES), key=len, reverse=True):
        if name in key:
            return CROP_ALIASES.get(name, name)
    return ""


# Indicative wholesale price ranges (TZS). Estimates for farmer guidance only —
# always confirm against a live source before making a selling decision.
CROP_PRICES = {
    # Cereals
    "maize": {"price_per_kg_tzs": "600 - 1,200 TZS", "price_per_bag_tzs": "60,000 - 120,000 TZS (per 100kg bag)", "trend": "Staple crop, prices rise during lean season", "best_selling_period": "February - May (lean season, highest prices)"},
    "rice": {"price_per_kg_tzs": "2,000 - 3,500 TZS (milled); 900 - 1,600 TZS (paddy)", "trend": "Strong and stable urban demand", "best_selling_period": "January - April (before the new harvest arrives)"},
    "sorghum": {"price_per_kg_tzs": "700 - 1,400 TZS", "trend": "Steady, brewery and food aid demand", "best_selling_period": "December - March"},
    "millet": {"price_per_kg_tzs": "800 - 1,600 TZS", "trend": "Niche but rising health-food demand", "best_selling_period": "December - March"},
    "wheat": {"price_per_kg_tzs": "900 - 1,800 TZS", "trend": "Tracks import prices, millers buy year-round", "best_selling_period": "Year-round via millers"},
    "barley": {"price_per_kg_tzs": "800 - 1,500 TZS", "trend": "Contract crop for breweries — price agreed in advance", "best_selling_period": "Under contract at harvest"},
    # Vegetables
    "tomato": {"price_per_kg_tzs": "1,500 - 3,000 TZS", "price_per_crate_tzs": "40,000 - 80,000 TZS (per 20kg crate)", "trend": "Stable, slightly rising due to dry season demand", "best_selling_period": "December - March (high demand)"},
    "kale": {"price_per_kg_tzs": "700 - 1,500 TZS", "trend": "Daily staple green, very consistent demand", "best_selling_period": "Year-round"},
    "onion": {"price_per_kg_tzs": "2,000 - 4,000 TZS", "price_per_bag_tzs": "80,000 - 150,000 TZS (per 50kg bag)", "trend": "Rising - imports from India reduced, local demand high", "best_selling_period": "Year-round, peak June-August"},
    "cabbage": {"price_per_kg_tzs": "500 - 1,500 TZS", "trend": "Seasonal, lower during peak harvest", "best_selling_period": "Dry season (June-October)"},
    "spinach": {"price_per_kg_tzs": "800 - 1,500 TZS", "trend": "Consistent demand", "best_selling_period": "Year-round"},
    "amaranth": {"price_per_kg_tzs": "700 - 1,500 TZS", "trend": "Steady local demand, very fast turnover", "best_selling_period": "Year-round"},
    "sweet pepper": {"price_per_kg_tzs": "3,000 - 6,000 TZS", "trend": "Premium prices from hotels and supermarkets", "best_selling_period": "Year-round, peak during dry season"},
    "pepper": {"price_per_kg_tzs": "3,000 - 6,000 TZS", "trend": "High demand, good margins", "best_selling_period": "Year-round, peak during dry season"},
    "cucumber": {"price_per_kg_tzs": "1,000 - 2,500 TZS", "trend": "Growing demand in urban areas", "best_selling_period": "Year-round"},
    "eggplant": {"price_per_kg_tzs": "1,500 - 3,000 TZS", "trend": "Stable demand", "best_selling_period": "Year-round"},
    "carrot": {"price_per_kg_tzs": "1,500 - 3,000 TZS", "trend": "Growing demand, good urban market", "best_selling_period": "Year-round"},
    "watermelon": {"price_per_kg_tzs": "500 - 1,500 TZS", "trend": "High demand in hot season", "best_selling_period": "October - March (hot season)"},
    "pumpkin": {"price_per_kg_tzs": "500 - 1,200 TZS", "trend": "Low value per kg but stores well and needs few inputs", "best_selling_period": "Year-round, stores for months"},
    "okra": {"price_per_kg_tzs": "1,500 - 3,000 TZS", "trend": "Steady local demand", "best_selling_period": "Year-round"},
    "green bean": {"price_per_kg_tzs": "2,000 - 4,000 TZS", "trend": "Export potential to Europe, strong local demand", "best_selling_period": "Year-round, export peak Nov-May"},
    "garlic": {"price_per_kg_tzs": "6,000 - 12,000 TZS", "trend": "High value, competes with Chinese imports", "best_selling_period": "Year-round — cures and stores well, so sell when prices peak"},
    "lettuce": {"price_per_kg_tzs": "2,000 - 4,000 TZS", "trend": "Premium prices in urban markets, hotels, restaurants", "best_selling_period": "Year-round"},
    # Legumes
    "common bean": {"price_per_kg_tzs": "2,000 - 3,500 TZS", "trend": "Staple protein, strong regional demand (Kenya)", "best_selling_period": "3-5 months after harvest, once the glut clears"},
    "cowpea": {"price_per_kg_tzs": "1,800 - 3,000 TZS", "trend": "Steady, leaves also sell as a vegetable", "best_selling_period": "Year-round"},
    "groundnut": {"price_per_kg_tzs": "2,500 - 4,500 TZS", "trend": "Strong — oil processors and snack market compete for supply", "best_selling_period": "Year-round if properly dried"},
    "pigeon pea": {"price_per_kg_tzs": "1,200 - 2,500 TZS", "trend": "Export-driven, swings with Indian import demand", "best_selling_period": "August - November (export buying season)"},
    "soybean": {"price_per_kg_tzs": "1,500 - 2,500 TZS", "trend": "Rising — animal feed industry demand growing fast", "best_selling_period": "Year-round via feed millers"},
    "chickpea": {"price_per_kg_tzs": "1,800 - 3,000 TZS", "trend": "Export demand from India and the Middle East", "best_selling_period": "Post-harvest, sold to export aggregators"},
    # Root crops
    "cassava": {"price_per_kg_tzs": "400 - 900 TZS (fresh roots); 700 - 1,400 TZS (dried chips)", "trend": "Rising — starch and flour processors expanding", "best_selling_period": "Year-round; leave in ground as living storage until a buyer is ready"},
    "sweet potato": {"price_per_kg_tzs": "500 - 1,200 TZS", "trend": "Steady, orange-fleshed varieties fetch a premium", "best_selling_period": "Harvest to order — does not store well"},
    "irish potato": {"price_per_kg_tzs": "800 - 1,800 TZS", "trend": "Prices spike between the highland harvests", "best_selling_period": "Off-season gaps (Feb-April, Sept-Oct)"},
    "yam": {"price_per_kg_tzs": "1,000 - 2,000 TZS", "trend": "Niche crop, good prices where it is known", "best_selling_period": "Year-round, stores well when cured"},
    # Fruits
    "banana": {"price_per_kg_tzs": "600 - 1,500 TZS", "price_per_bunch_tzs": "8,000 - 25,000 TZS (per bunch)", "trend": "Steady staple demand in Kagera, Kilimanjaro, Mbeya", "best_selling_period": "Year-round, prices best in the dry season"},
    "mango": {"price_per_kg_tzs": "800 - 2,000 TZS", "trend": "Glut prices in season — improved varieties sell far better", "best_selling_period": "Off-peak edges of the season (Oct-Nov, Feb-March)"},
    "avocado": {"price_per_kg_tzs": "1,000 - 2,500 TZS local; higher for export-grade Hass", "trend": "Strong growth — export packhouses buying in the Southern Highlands", "best_selling_period": "March - August (export window)"},
    "coconut": {"price_per_nut_tzs": "500 - 1,500 TZS per nut", "trend": "Steady coastal demand for nuts and oil", "best_selling_period": "Year-round"},
    "papaya": {"price_per_kg_tzs": "600 - 1,500 TZS", "trend": "Consistent urban demand", "best_selling_period": "Year-round"},
    "pineapple": {"price_per_fruit_tzs": "1,000 - 2,500 TZS per fruit", "trend": "Good demand, juice processors buy in bulk", "best_selling_period": "Year-round, peak December - March"},
    "orange": {"price_per_kg_tzs": "500 - 1,200 TZS", "trend": "Seasonal glut in Muheza/Tanga pushes prices down", "best_selling_period": "Outside the main June-September flush"},
    "passion fruit": {"price_per_kg_tzs": "2,000 - 4,000 TZS", "trend": "High value, juice processors and hotels buy steadily", "best_selling_period": "Year-round"},
    "guava": {"price_per_kg_tzs": "800 - 1,800 TZS", "trend": "Modest local demand, good for processing", "best_selling_period": "Year-round"},
    "jackfruit": {"price_per_fruit_tzs": "3,000 - 10,000 TZS per fruit", "trend": "Niche, sold whole or in segments at roadside and urban markets", "best_selling_period": "Main season December - May"},
    # Cash crops
    "cashew": {"price_per_kg_tzs": "1,800 - 3,000 TZS (raw nuts)", "trend": "Auction-driven — price set at the warehouse receipt system sale", "best_selling_period": "October - January (main auction season)"},
    "coffee": {"price_per_kg_tzs": "4,000 - 8,000 TZS (parchment/green)", "trend": "Tracks world prices; specialty lots earn far more", "best_selling_period": "Through your AMCOS at auction, or direct to specialty buyers"},
    "cotton": {"price_per_kg_tzs": "1,000 - 1,600 TZS (seed cotton)", "trend": "Indicative price announced each season by the Cotton Board", "best_selling_period": "June - September (buying season)"},
    "sisal": {"price_per_kg_tzs": "2,000 - 3,500 TZS (dry fibre)", "trend": "Firm — demand for natural fibre and cordage growing", "best_selling_period": "Year-round, cut on a rolling cycle"},
    "sunflower": {"price_per_kg_tzs": "900 - 1,800 TZS (seed)", "trend": "Strong — domestic edible oil demand far exceeds supply", "best_selling_period": "3-6 months after harvest, when oil millers restock"},
    "tea": {"price_per_kg_tzs": "300 - 600 TZS (green leaf)", "trend": "Factory-gate price, reviewed periodically", "best_selling_period": "Year-round plucking, peak during the rains"},
    "sugarcane": {"price_per_kg_tzs": "60 - 120 TZS", "price_per_tonne_tzs": "60,000 - 120,000 TZS per tonne", "trend": "Contract crop — millers set the price and cutting schedule", "best_selling_period": "During the mill's crushing season"},
    "tobacco": {"price_per_kg_tzs": "3,000 - 6,000 TZS (graded, cured leaf)", "trend": "Contract crop, price depends heavily on grade", "best_selling_period": "At the contracted buying period"},
    "sesame": {"price_per_kg_tzs": "2,500 - 4,500 TZS", "trend": "Export-driven, strong demand from Asia and the Middle East", "best_selling_period": "September - December (export buying)"},
    "clove": {"price_per_kg_tzs": "15,000 - 30,000 TZS (dried)", "trend": "High value, sold through ZSTC in Zanzibar", "best_selling_period": "Main harvest July - December"},
    "pyrethrum": {"price_per_kg_tzs": "3,000 - 6,000 TZS (dried flowers)", "trend": "Contract crop for the extraction factories", "best_selling_period": "Delivered on the buyer's schedule"},
}


def get_market_prices(crop_type: str = "") -> dict:
    """Get estimated market prices for crops grown in Tanzania (Dar es Salaam / regional wholesale).

    Args:
        crop_type: Optional crop to look up (e.g. 'tomato', 'cassava', 'coffee', 'muhogo').
                   Leave empty to get the full price list for every supported crop.
    """
    base = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "market": "Kariakoo / Dar es Salaam wholesale, with regional variation",
        "note": (
            "Indicative estimates only — prices vary by region, grade and week. Check Kariakoo or your "
            "nearest wholesale market, TAHA for horticulture, NFRA/Cereals Board for grain, and the "
            "relevant crop board or AMCOS for cash crops (cashew, coffee, cotton, tobacco, tea, cloves)."
        ),
    }

    if not crop_type:
        base["prices"] = CROP_PRICES
        return base

    key = _canonical_crop(crop_type)
    if key and key in CROP_PRICES:
        base["crop"] = key.title()
        base["prices"] = {key: CROP_PRICES[key]}
        return base

    # Unknown crop: give the group-level playbook rather than refusing.
    group = CROP_CATALOGUE.get(key, "")
    base["crop"] = crop_type
    base["prices"] = {}
    base["guidance"] = _GROUP_MARKET_GUIDANCE.get(
        group,
        "No price estimate on file for this crop. Advise from general Tanzanian market knowledge and "
        "tell the farmer to confirm at their nearest wholesale market.",
    )
    return base


# Curated harvest guidance. Every crop in CROP_CATALOGUE has an entry; anything
# else falls back to group-level guidance rather than an error.
HARVEST_RECOMMENDATIONS = {
    # ── Cereals ──
    "maize": {
        "crop": "Maize",
        "days_to_maturity": "90-120 days from planting (depends on variety)",
        "harvest_signs": [
            "Husks turn brown and dry",
            "Kernels hard and dent when pressed (for dry maize)",
            "Milk line has moved to base of kernel",
            "Moisture content below 20% ideal for storage",
        ],
        "post_harvest": [
            "Dry to 13% moisture before storage",
            "Shell and store in airtight containers or hermetic bags",
            "Treat with storage pesticide if needed",
            "Can sell as green maize (roasted) for higher prices at 70-80 days",
        ],
        "local_tips": "Plant at the start of long rains (March-April) or short rains (October-November). Watch for Fall Armyworm — scout weekly from germination.",
    },
    "rice": {
        "crop": "Rice",
        "days_to_maturity": "120-150 days from transplanting",
        "harvest_signs": ["80-85% of grains in the panicle are straw-coloured", "Grains hard when bitten, not milky", "Panicles bend over under grain weight", "Drain the field 7-10 days before cutting"],
        "post_harvest": ["Thresh promptly to avoid shattering losses", "Dry paddy to 13-14% moisture on a clean surface, not bare soil", "Store paddy and mill on demand — it keeps far better than milled rice"],
        "local_tips": "SRI methods (wider spacing, alternate wetting and drying) raise yields substantially in Morogoro, Mbeya and Shinyanga irrigation schemes.",
    },
    "sorghum": {
        "crop": "Sorghum",
        "days_to_maturity": "100-130 days from planting",
        "harvest_signs": ["Grain is hard and cannot be dented with a thumbnail", "A black layer forms at the base of the grain", "Heads droop and leaves have dried"],
        "post_harvest": ["Cut heads and dry in the sun for several days before threshing", "Dry to 12-13% moisture", "Store in hermetic bags — sorghum is very prone to weevils"],
        "local_tips": "Bird damage is the biggest loss in Dodoma and Singida — harvest promptly once mature and scare birds during grain filling.",
    },
    "millet": {
        "crop": "Millet",
        "days_to_maturity": "80-100 days from planting",
        "harvest_signs": ["Heads turn golden brown", "Grain hard when pressed", "Leaves have dried down"],
        "post_harvest": ["Sun-dry heads before threshing", "Winnow well — millet grain is small and holds chaff", "Store dry in sealed containers"],
        "local_tips": "A reliable drought crop for the central regions. Harvest quickly once mature — birds and shattering cause heavy losses.",
    },
    "wheat": {
        "crop": "Wheat",
        "days_to_maturity": "110-130 days from planting",
        "harvest_signs": ["Whole crop golden, stems dry", "Grain hard and cracks between the teeth", "Moisture around 14%"],
        "post_harvest": ["Thresh soon after cutting to avoid shattering", "Dry to 12-13% moisture", "Deliver to millers or store clean and dry"],
        "local_tips": "Grown mainly in the Arusha, Manyara and Iringa highlands. Millers buy year-round — quality and cleanliness determine the price.",
    },
    "barley": {
        "crop": "Barley",
        "days_to_maturity": "90-110 days from planting",
        "harvest_signs": ["Heads bend over and turn golden", "Grain hard, straw brittle", "Awns dry and brittle"],
        "post_harvest": ["Handle gently — malting barley must not have cracked grain", "Dry to 12-13% moisture", "Deliver to the contracting brewery to grade"],
        "local_tips": "Almost always grown on contract for maltsters in the northern highlands. Meet the contract's protein and germination spec to get the malting price rather than the feed price.",
    },
    # ── Vegetables ──
    "tomato": {
        "crop": "Tomato",
        "days_to_maturity": "60-85 days after transplanting",
        "harvest_signs": [
            "Fruit turns from green to light red/pink (breaker stage for transport)",
            "Fruit is firm but slightly soft when pressed gently",
            "Bottom of fruit shows color change first",
            "Morning harvest is best (cooler temperatures)",
        ],
        "post_harvest": [
            "Sort by ripeness and size",
            "Handle gently to avoid bruising",
            "Store in shade, ventilated area",
            "Transport to market within 2-3 days of harvest",
        ],
        "local_tips": "In Tanzania's warm climate, tomatoes ripen faster. Start checking at 55 days.",
    },
    "kale": {
        "crop": "Kale (Sukuma Wiki)",
        "days_to_maturity": "50-60 days, then cut repeatedly",
        "harvest_signs": ["Outer leaves are 25-30cm and dark green", "Pick outer leaves and leave the growing point", "Harvest every 7-10 days"],
        "post_harvest": ["Harvest early morning", "Keep bundles moist and shaded", "Sell the same day — leaves wilt fast"],
        "local_tips": "The most reliable cash-flow crop for a smallholder: one planting keeps cutting for 2-3 months if you feed and water it well.",
    },
    "onion": {
        "crop": "Onion",
        "days_to_maturity": "90-120 days from transplanting",
        "harvest_signs": [
            "Tops/leaves fall over naturally (50-80% fallen)",
            "Neck becomes soft and thin",
            "Outer skin becomes papery",
            "Bulb feels firm when squeezed",
        ],
        "post_harvest": [
            "Cure in sun for 3-5 days, then shade for 2 weeks",
            "Trim tops to 2cm above bulb",
            "Store in dry, ventilated area",
            "Can store 2-4 months if properly cured",
        ],
        "local_tips": "High humidity can cause rot during curing. Ensure good airflow and avoid curing during rain.",
    },
    "cabbage": {
        "crop": "Cabbage",
        "days_to_maturity": "70-90 days after transplanting",
        "harvest_signs": ["Head feels firm and solid when squeezed", "Head reaches expected size for variety", "Outer leaves may start yellowing"],
        "post_harvest": ["Remove loose outer leaves", "Store in cool shade", "Can keep 2-3 weeks in proper conditions"],
        "local_tips": "Harvest early morning to avoid heat wilting. Don't delay harvest as heads may split.",
    },
    "spinach": {
        "crop": "Spinach",
        "days_to_maturity": "35-45 days from planting",
        "harvest_signs": ["Leaves reach 15-20cm length", "Dark green color, tender leaves", "Before bolting (flowering)"],
        "post_harvest": ["Harvest early morning", "Keep moist and cool", "Sell same day for best price"],
        "local_tips": "Fast-growing crop in Tanzania's climate. Can get 3-4 harvests by cutting outer leaves.",
    },
    "amaranth": {
        "crop": "Amaranth (Mchicha)",
        "days_to_maturity": "30-45 days from sowing",
        "harvest_signs": ["Plants 20-30cm tall with tender leaves", "Harvest before flowering — leaves turn bitter after", "Cut whole plant or pick tips for repeat harvest"],
        "post_harvest": ["Harvest in the cool of the morning", "Sprinkle lightly with water and keep shaded", "Sell same day"],
        "local_tips": "The fastest crop in the catalogue — good for filling a gap in a rotation and for steady weekly income.",
    },
    "sweet pepper": {
        "crop": "Sweet Pepper",
        "days_to_maturity": "70-90 days after transplanting",
        "harvest_signs": ["Fruit full size, thick-walled and glossy", "Green stage for firmness, or leave to colour red/yellow for a premium", "Cut with a short stalk rather than pulling"],
        "post_harvest": ["Handle carefully — thin skin bruises easily", "Keep cool (7-10°C) and shaded", "Grade by size and colour for hotels and supermarkets"],
        "local_tips": "Coloured peppers fetch much more than green but occupy the plant longer — split your picking between both.",
    },
    "pepper": {
        "crop": "Pepper",
        "days_to_maturity": "60-90 days after transplanting",
        "harvest_signs": [
            "Fruit reaches full size and desired color (green, red, or yellow depending on variety)",
            "Firm fruit with glossy skin",
            "Easily snaps off the plant",
        ],
        "post_harvest": ["Handle carefully to avoid bruising", "Store at 7-10°C", "Sort by size and color"],
        "local_tips": "In Tanzania's heat, peppers color faster. Harvest in morning for best quality.",
    },
    "cucumber": {
        "crop": "Cucumber",
        "days_to_maturity": "50-60 days from planting",
        "harvest_signs": ["Fruit 15-20cm long, dark green", "Firm and crisp", "Don't let them turn yellow — overripe"],
        "post_harvest": ["Keep cool and moist", "Sell within 2-3 days", "Sort by size"],
        "local_tips": "In Tanzania's heat, check daily — cucumbers grow fast and can become oversized quickly.",
    },
    "eggplant": {
        "crop": "Eggplant",
        "days_to_maturity": "60-80 days after transplanting",
        "harvest_signs": ["Glossy skin (dull = overripe)", "Firm flesh that springs back", "Seeds still white (not brown)"],
        "post_harvest": ["Handle carefully", "Store at 10-12°C", "Best sold within a week"],
        "local_tips": "Harvest regularly to encourage more fruiting. Sell when skin is glossy and deep purple.",
    },
    "carrot": {
        "crop": "Carrot",
        "days_to_maturity": "70-80 days from direct seeding",
        "harvest_signs": ["Top of root visible at soil surface (2-3cm diameter)", "Bright orange color", "Shoulders about 2cm across"],
        "post_harvest": ["Remove tops immediately", "Wash gently", "Store in cool moist conditions"],
        "local_tips": "Sandy loam soils produce the straightest roots. Harvest before soil becomes waterlogged.",
    },
    "watermelon": {
        "crop": "Watermelon",
        "days_to_maturity": "70-85 days from planting",
        "harvest_signs": ["Ground spot turns cream/yellow", "Tendril near fruit dries up", "Hollow sound when tapped", "Skin resists scratching"],
        "post_harvest": ["Handle gently — bruising reduces shelf life", "Store in shade", "Can keep 2-3 weeks uncut"],
        "local_tips": "Reduce irrigation 7-10 days before harvest for sweeter fruit.",
    },
    "pumpkin": {
        "crop": "Pumpkin",
        "days_to_maturity": "90-110 days from planting",
        "harvest_signs": ["Rind is hard and cannot be dented with a thumbnail", "Stalk has dried and turned corky", "Deep, even skin colour"],
        "post_harvest": ["Cut with 5cm of stalk attached — pumpkins without a stalk rot", "Cure in the sun for a week to harden the skin", "Store in a dry airy place for up to 3 months"],
        "local_tips": "The leaves and shoots also sell as a vegetable — you can take a leaf income while the fruit matures.",
    },
    "okra": {
        "crop": "Okra",
        "days_to_maturity": "45-55 days from planting",
        "harvest_signs": ["Pods 7-10cm long", "Tender and snaps easily", "Harvest every 2 days in peak season"],
        "post_harvest": ["Handle gently", "Sort by size", "Sell fresh within 1-2 days"],
        "local_tips": "Okra thrives in Tanzania's warm climate. Harvest frequently to keep plants producing.",
    },
    "green bean": {
        "crop": "Green Bean",
        "days_to_maturity": "45-55 days from planting",
        "harvest_signs": ["Pods snap cleanly", "Seeds not yet bulging", "Bright green color"],
        "post_harvest": ["Keep cool", "Sort by size and straightness for export", "Sell within 2 days"],
        "local_tips": "Good export crop. French beans fetch premium prices in European markets — sort carefully for export grade.",
    },
    "garlic": {
        "crop": "Garlic",
        "days_to_maturity": "140-160 days from planting",
        "harvest_signs": ["Lower third of the leaves has yellowed and dried", "Bulb has divided into distinct cloves", "Skin is papery but still intact"],
        "post_harvest": ["Cure in a dry airy shade for 2-3 weeks", "Trim roots and tops once fully cured", "Store dry — well-cured garlic keeps 6+ months"],
        "local_tips": "One of the highest-value crops per acre in the catalogue, and it stores — you can hold the crop until prices peak.",
    },
    "lettuce": {
        "crop": "Lettuce",
        "days_to_maturity": "45-60 days from transplanting",
        "harvest_signs": ["Heads feel firm", "Full size for variety", "Before bolting in heat"],
        "post_harvest": ["Harvest early morning", "Keep moist and cool immediately", "Best sold same day"],
        "local_tips": "In hot regions, grow in partial shade to prevent bolting. Target hotels and restaurants for premium prices.",
    },
    # ── Legumes ──
    "common bean": {
        "crop": "Common Bean",
        "days_to_maturity": "80-100 days from planting (dry grain)",
        "harvest_signs": ["90% of pods are dry, brown and rattle when shaken", "Leaves have yellowed and dropped", "Grain hard and cannot be dented"],
        "post_harvest": ["Uproot or cut whole plants and dry on a tarpaulin", "Thresh gently to avoid splitting grain", "Dry to 13% and store with an approved grain protectant against bruchids"],
        "local_tips": "Bruchid (weevil) damage in storage costs more than most field pests. Store in hermetic bags and inspect monthly.",
    },
    "cowpea": {
        "crop": "Cowpea",
        "days_to_maturity": "70-90 days (grain); leaves from 30 days",
        "harvest_signs": ["Pods dry and brittle for grain", "Pick fresh pods while still green and tender for the vegetable market", "Harvest in 2-3 passes as pods mature unevenly"],
        "post_harvest": ["Sun-dry pods before threshing", "Dry grain to 12-13%", "Store in airtight containers — very prone to bruchids"],
        "local_tips": "A dual-purpose crop: sell leaves (kunde) weekly for cash flow and grain at the end for the bigger payment.",
    },
    "groundnut": {
        "crop": "Groundnut",
        "days_to_maturity": "100-120 days from planting",
        "harvest_signs": ["Inside of the shell shows dark veins and the seed coat has its varietal colour", "Leaves yellow and lower leaves drop", "Lift a test plant and check that 70-80% of pods are mature"],
        "post_harvest": ["Windrow with pods facing up and dry to 8-10% moisture", "Never dry on bare soil — this is how aflatoxin starts", "Store unshelled in a dry, ventilated place"],
        "local_tips": "Aflatoxin is the main barrier to good prices. Dry fast, keep pods off the ground, and discard shrivelled or mouldy nuts before selling.",
    },
    "pigeon pea": {
        "crop": "Pigeon Pea",
        "days_to_maturity": "150-200 days from planting",
        "harvest_signs": ["Pods dry and brown, grain rattles inside", "Harvest in 2-3 pickings as pods mature over several weeks", "Grain hard and cannot be dented"],
        "post_harvest": ["Sun-dry pods for 3-4 days before threshing", "Dry grain to 12%", "Store in hermetic bags to keep bruchids out"],
        "local_tips": "Mostly exported to India — check current export demand before pricing. Intercrops well with maize and improves the soil.",
    },
    "soybean": {
        "crop": "Soybean",
        "days_to_maturity": "90-110 days from planting",
        "harvest_signs": ["Pods brown and dry, leaves fallen", "Grain rattles inside the pod", "Moisture around 13-15% at cutting"],
        "post_harvest": ["Harvest promptly — pods shatter if left too long", "Thresh gently, soybean cracks easily", "Dry to 12-13% and store cool and dry"],
        "local_tips": "Feed millers and processors buy year-round. Inoculate seed with rhizobium — it costs little and lifts yield noticeably.",
    },
    "chickpea": {
        "crop": "Chickpea",
        "days_to_maturity": "90-110 days from planting",
        "harvest_signs": ["Plants yellow and pods dry and brown", "Grain hard and rattles", "Leaves dropping"],
        "post_harvest": ["Cut or uproot plants and dry for a few days", "Thresh and clean carefully", "Dry to 12% before bagging"],
        "local_tips": "Grown on residual moisture after rice in the highlands. Harvest before the pods shatter in the heat.",
    },
    # ── Root crops ──
    "cassava": {
        "crop": "Cassava",
        "days_to_maturity": "9-12 months (up to 18 for some varieties)",
        "harvest_signs": ["Lower leaves yellow and drop", "Test-lift one plant: roots should be thick and starchy", "Roots can stay in the ground for months as living storage"],
        "post_harvest": ["Roots spoil within 2-3 days of lifting — harvest to order", "Peel, chip and sun-dry within 24 hours if not selling fresh", "Dried chips store for months and sell to flour and starch processors"],
        "local_tips": "Use CMD/CBSD-resistant planting material. Harvest only what you can sell or dry the same day — this is the biggest loss point.",
    },
    "sweet potato": {
        "crop": "Sweet Potato",
        "days_to_maturity": "100-140 days from planting",
        "harvest_signs": ["Vines yellow and start dying back", "Test-dig one hill — roots should be well sized", "Skin does not slip when rubbed with a thumb"],
        "post_harvest": ["Lift carefully with a fork — cuts and bruises rot fast", "Cure at warm humid conditions for 5-7 days to heal the skin", "Store cured roots in a cool dry airy place"],
        "local_tips": "Orange-fleshed varieties are worth more (vitamin A) and are increasingly asked for in urban markets and by nutrition programmes.",
    },
    "irish potato": {
        "crop": "Irish Potato",
        "days_to_maturity": "90-120 days from planting",
        "harvest_signs": ["Haulms (tops) yellow and die back", "Skin is set and does not rub off with a thumb", "Cut the haulms 10-14 days before lifting to set the skin"],
        "post_harvest": ["Lift in dry weather and let tubers surface-dry in shade", "Grade out damaged and green tubers", "Store in the dark and cool — light turns tubers green and unsaleable"],
        "local_tips": "Late blight is the main risk in the Southern Highlands. Use clean seed potatoes and scout after every wet spell.",
    },
    "yam": {
        "crop": "Yam",
        "days_to_maturity": "8-10 months from planting",
        "harvest_signs": ["Vines and leaves yellow and dry", "Tuber skin firm and well formed", "Test-dig carefully at the edge of the mound"],
        "post_harvest": ["Dig carefully — a cut tuber will not store", "Cure for a week in a shaded airy place", "Store on racks in a cool dark barn; well-cured yam keeps 3-6 months"],
        "local_tips": "Handle as little as possible — nearly all yam storage loss starts as a harvest wound.",
    },
    # ── Fruits ──
    "banana": {
        "crop": "Banana",
        "days_to_maturity": "10-14 months to first bunch, then continuous suckers",
        "harvest_signs": ["Fingers are full and rounded, ridges have flattened", "Fruit colour lightens from dark to pale green", "Cut the bunch while still green for transport"],
        "post_harvest": ["Cushion bunches during transport — bruises turn black", "De-hand into cartons for distant markets", "Ripen in a closed shaded room; do not ripen in direct sun"],
        "local_tips": "Manage the banana weevil and nematodes with clean suckers and good sanitation — they are the main reason old stands decline in Kagera and Kilimanjaro.",
    },
    "mango": {
        "crop": "Mango",
        "days_to_maturity": "100-150 days from flowering",
        "harvest_signs": ["Shoulders fill out above the stem end", "Skin colour changes and flesh near the stone turns yellow in a test fruit", "Fruit floats in water when mature"],
        "post_harvest": ["Harvest with a short stem and let the sap drain away from the fruit", "Handle gently and keep out of direct sun", "Grade by size and blemish — first grade goes to urban retail"],
        "local_tips": "Fruit fly is the biggest quality problem. Bag fruit or use traps, and never leave fallen fruit under the tree.",
    },
    "avocado": {
        "crop": "Avocado",
        "days_to_maturity": "6-9 months from flowering (mature trees)",
        "harvest_signs": ["Skin dulls and, in Hass, darkens", "Dry-matter test: cut a sample fruit — 23%+ dry matter for Hass export maturity", "Fruit ripens only after picking, never on the tree"],
        "post_harvest": ["Clip with a short stem, never pull", "Keep cool and out of direct sun", "Pack in single layers for export-grade fruit"],
        "local_tips": "Export packhouses in Njombe and Mbeya pay well above the local market, but only for correctly sized, unblemished fruit picked at the right dry matter.",
    },
    "coconut": {
        "crop": "Coconut",
        "days_to_maturity": "12 months from flowering; trees bear year-round",
        "harvest_signs": ["Husk turns brown for mature nuts (copra/oil)", "Nuts sound hollow with water sloshing inside", "Pick green at 6-7 months for drinking nuts"],
        "post_harvest": ["Lower bunches with a rope rather than dropping them", "Store mature nuts in a dry shaded place — they keep for months", "Split and sun-dry for copra within a few days"],
        "local_tips": "Harvest on a 45-60 day cycle year-round. Watch for the coconut rhinoceros beetle in the crown.",
    },
    "papaya": {
        "crop": "Papaya",
        "days_to_maturity": "8-10 months from planting to first fruit",
        "harvest_signs": ["First yellow streak appears at the blossom end", "Fruit gives slightly under gentle pressure", "Latex runs watery rather than milky"],
        "post_harvest": ["Cut with a short stem and handle very gently", "Transport in padded crates in single layers", "Sells best within 3-4 days"],
        "local_tips": "Pick at the colour-break stage for market and slightly riper for local sale. Bruised papaya is unsellable, so packing matters more than picking speed.",
    },
    "pineapple": {
        "crop": "Pineapple",
        "days_to_maturity": "15-18 months from planting",
        "harvest_signs": ["Base of the fruit turns from green to yellow-orange", "Strong sweet aroma at the base", "Eyes flatten and broaden"],
        "post_harvest": ["Cut with a clean knife leaving a short stalk", "Keep the crown on for fresh market appeal", "Store cool and shaded; sells within a week"],
        "local_tips": "Pineapple does not sweeten after picking — never harvest early. Juice processors take second-grade fruit at a lower but reliable price.",
    },
    "orange": {
        "crop": "Orange",
        "days_to_maturity": "8-10 months from flowering",
        "harvest_signs": ["Full size with a slight colour change (Tanzanian oranges often stay green when ripe)", "Fruit feels heavy for its size", "Taste-test a sample — sugar does not increase after picking"],
        "post_harvest": ["Clip rather than pull to protect the button and the tree", "Keep out of the sun and pack in ventilated crates", "Store cool — oranges hold 2-4 weeks"],
        "local_tips": "The Muheza/Tanga flush floods the market from June. If you can hold or ripen outside that window your price roughly doubles.",
    },
    "passion fruit": {
        "crop": "Passion Fruit",
        "days_to_maturity": "70-80 days from flowering; vines bear from 8-12 months",
        "harvest_signs": ["Skin turns deep purple or yellow depending on variety", "Fruit drops naturally when fully ripe — collect daily", "Slight wrinkling means highest sugar but shorter shelf life"],
        "post_harvest": ["Collect fallen fruit daily and keep shaded", "Grade smooth fruit for fresh market, wrinkled for juice", "Keeps about a week in a cool place"],
        "local_tips": "Woodiness virus and brown spot shorten vine life. Replant on a 3-year cycle with clean seedlings and keep the vines well trellised.",
    },
    "guava": {
        "crop": "Guava",
        "days_to_maturity": "90-150 days from flowering",
        "harvest_signs": ["Skin turns from dark to light green or yellow", "Fruit gives slightly to gentle pressure", "Strong sweet aroma develops"],
        "post_harvest": ["Pick with a short stem", "Handle gently — guava bruises easily and ripens fast", "Sell within 2-3 days or process into juice and jam"],
        "local_tips": "Fruit fly is the main pest. Bagging fruit or field sanitation makes the difference between a saleable and a wasted crop.",
    },
    "jackfruit": {
        "crop": "Jackfruit",
        "days_to_maturity": "3-8 months from flowering",
        "harvest_signs": ["Spines flatten and spread apart", "Dull hollow sound when tapped", "Strong aroma and a yellowish tinge to the skin"],
        "post_harvest": ["Cut with a long stalk — heavy fruit must never be dropped", "Let latex drain before packing", "Sell whole or in cleaned segments; ripe fruit keeps only 3-5 days"],
        "local_tips": "Sells well whole at roadside and by the segment in urban markets. Unripe jackfruit also has a growing market as a vegetable.",
    },
    # ── Cash crops ──
    "cashew": {
        "crop": "Cashew",
        "days_to_maturity": "Nuts mature 6-8 weeks after flowering; main season Oct-Jan",
        "harvest_signs": ["Nut and apple drop naturally to the ground — do not pick from the tree", "Nut is grey-brown and hard", "Collect daily during peak drop"],
        "post_harvest": ["Separate the nut from the apple immediately", "Sun-dry nuts for 2-3 days to about 8% moisture", "Store in jute bags off the floor in a dry store; deliver to the warehouse receipt system"],
        "local_tips": "In Mtwara and Lindi, sulphur dusting against powdery mildew during flowering is what decides the crop. Grade and dry properly — the auction pays for quality.",
    },
    "coffee": {
        "crop": "Coffee",
        "days_to_maturity": "8-11 months from flowering",
        "harvest_signs": ["Cherries are deep red (or yellow for yellow varieties) and slightly soft", "Pick selectively — only ripe cherries, every 10-14 days", "Green or overripe cherries lower the whole lot's grade"],
        "post_harvest": ["Pulp within 12 hours of picking", "Ferment 12-36 hours, wash thoroughly, dry slowly on raised beds to 11% moisture", "Store as parchment and hull just before sale"],
        "local_tips": "Selective red-cherry picking is the single biggest lever on your price. Specialty buyers in Mbeya, Mbinga and Kilimanjaro pay far above the auction average for well-processed lots.",
    },
    "cotton": {
        "crop": "Cotton",
        "days_to_maturity": "150-180 days from planting",
        "harvest_signs": ["Bolls have split open and the lint is fluffy and dry", "Pick in 2-3 passes as bolls open", "Pick in dry conditions, never when damp"],
        "post_harvest": ["Keep seed cotton clean — leaf trash and soil cut the grade", "Store in clean bags away from moisture", "Deliver to the licensed ginnery buying post"],
        "local_tips": "Contamination is the main price killer. Use cotton (not synthetic) bags and keep the picking area clean.",
    },
    "sisal": {
        "crop": "Sisal",
        "days_to_maturity": "First cut at 2-2.5 years, then cut every 6-12 months for 7-10 years",
        "harvest_signs": ["Leaves are 1m+ long and the lower whorl is flattening out", "Cut only mature lower leaves, leaving at least 30 leaves on the plant", "Do not cut into the bole"],
        "post_harvest": ["Decorticate within 24 hours of cutting", "Wash and sun-dry fibre to a clean cream colour", "Brush, grade and bale by fibre length"],
        "local_tips": "Fibre colour and cleanliness set the grade. Delay between cutting and decortication darkens the fibre and costs you money.",
    },
    "sunflower": {
        "crop": "Sunflower",
        "days_to_maturity": "90-120 days from planting",
        "harvest_signs": ["Back of the head turns brown and the bracts dry", "Seeds are hard and the head droops", "Moisture around 12-15%"],
        "post_harvest": ["Cut heads and dry further in the sun", "Thresh and winnow, then dry seed to 9-10%", "Store cool and dry — high-oil seed goes rancid if stored damp"],
        "local_tips": "Birds attack drying heads in Singida and Dodoma — harvest as soon as the backs brown rather than leaving heads in the field.",
    },
    "tea": {
        "crop": "Tea",
        "days_to_maturity": "First plucking at 3-4 years, then every 7-14 days year-round",
        "harvest_signs": ["Two leaves and a bud have flushed above the plucking table", "Shoots are tender — hard, coarse shoots are rejected", "Pluck on a 7-14 day round depending on the season"],
        "post_harvest": ["Keep green leaf loose and shaded — never compress it in the sack", "Deliver to the factory within a few hours of plucking", "Leaf that heats in the bag loses grade immediately"],
        "local_tips": "Fine plucking (two leaves and a bud) is what earns the factory's top rate in Njombe, Mufindi and Rungwe.",
    },
    "sugarcane": {
        "crop": "Sugarcane",
        "days_to_maturity": "12-18 months for plant cane, 10-12 for ratoons",
        "harvest_signs": ["Lower leaves dry and cane sounds solid when tapped", "Brix test at the mill confirms maturity", "Cut on the mill's schedule, not before"],
        "post_harvest": ["Cut at ground level to protect the ratoon and get the sweetest section", "Deliver within 24-48 hours — sucrose falls fast after cutting", "Leave the field clean for the next ratoon"],
        "local_tips": "Sugar content falls every day between cutting and crushing, so coordinate cutting with your transport and the mill's window.",
    },
    "tobacco": {
        "crop": "Tobacco",
        "days_to_maturity": "Leaves ripen 70-120 days after transplanting, primed in stages",
        "harvest_signs": ["Leaves turn from green to yellow-green from the bottom of the plant upward", "Prime 2-4 leaves per plant per week, lowest first", "Leaf tips droop and the midrib whitens"],
        "post_harvest": ["Cure to the contracted schedule (flue or air curing)", "Grade by leaf position, colour and quality", "Bale and keep dry until the buying day"],
        "local_tips": "Grade discipline is everything — mixed grades in a bale drag the whole bale down to the lowest price.",
    },
    "sesame": {
        "crop": "Sesame",
        "days_to_maturity": "90-120 days from planting",
        "harvest_signs": ["Lower capsules turn yellow-brown and the leaves drop", "Harvest before the capsules split — shattering loss is severe", "Bottom capsules just beginning to open"],
        "post_harvest": ["Cut and stack plants upright to dry for 4-7 days", "Thresh onto a tarpaulin by shaking the stacks over it", "Clean and dry seed to 6-8% before bagging"],
        "local_tips": "Timing is the whole game — a few days late and the crop shatters onto the ground. Watch the lowest capsules daily as they turn.",
    },
    "clove": {
        "crop": "Clove",
        "days_to_maturity": "Trees bear from 6-8 years; buds ready 5-6 months after flowering",
        "harvest_signs": ["Buds are full and turning from green to pink, before the flower opens", "Pick the whole cluster by hand", "An opened flower has lost most of its oil value"],
        "post_harvest": ["Separate buds from stems", "Sun-dry 4-5 days until dark brown and brittle (about a third of fresh weight)", "Store dry in sacks away from moisture; sell through ZSTC"],
        "local_tips": "Picking before the buds open is the difference between top grade and low grade. Do not damage branches while climbing — it costs you the next crop.",
    },
    "pyrethrum": {
        "crop": "Pyrethrum",
        "days_to_maturity": "First flowers at 4-6 months, then picked every 2-3 weeks",
        "harvest_signs": ["Flowers fully open with 2-3 rows of disc florets showing", "Pick every 2-3 weeks through the flowering season", "Overmature flowers have much lower pyrethrin content"],
        "post_harvest": ["Dry in shade or a solar drier — direct strong sun degrades pyrethrins", "Dry to about 10-12% moisture", "Store in clean dry bags away from light until delivery"],
        "local_tips": "Payment is by pyrethrin content, not weight. Picking at the right stage and drying out of direct sun is what protects your price in the Iringa and Njombe highlands.",
    },
}


def get_harvest_recommendation(crop_type: str) -> dict:
    """Get harvest timing and post-harvest recommendations for a crop grown in Tanzania.

    Args:
        crop_type: The crop type, English or Kiswahili (e.g. 'tomato', 'cassava', 'coffee', 'muhogo').
    """
    key = _canonical_crop(crop_type)
    if key in HARVEST_RECOMMENDATIONS:
        return HARVEST_RECOMMENDATIONS[key]

    # No curated entry: hand back group-level guidance so the agent can still
    # answer from its own agronomy knowledge instead of refusing.
    group = CROP_CATALOGUE.get(key, "")
    return {
        "crop": crop_type,
        "curated_entry": False,
        "group": group or "unknown",
        "guidance": _GROUP_HARVEST_GUIDANCE.get(
            group,
            "No curated entry for this crop. Advise from general agronomy knowledge for Tanzanian "
            "conditions: maturity signs, best time of day to harvest, and post-harvest handling.",
        ),
        "note": "Answer the farmer using this guidance plus your own knowledge of the crop — do not tell them the crop is unsupported.",
    }


TANZANIA_CENTER_LAT = -6.1731
TANZANIA_CENTER_LON = 35.7395

# District-level coordinates for Tanzania (lat/lon of district centres)
DISTRICT_COORDS = {
    "Arusha": {"Arusha City": (-3.3869, 36.6827), "Arumeru": (-3.35, 36.9), "Karatu": (-3.35, 35.65), "Longido": (-2.75, 36.6833), "Monduli": (-3.3, 36.45), "Ngorongoro": (-3.2, 35.5)},
    "Dar es Salaam": {"Ilala": (-6.8235, 39.2695), "Kinondoni": (-6.77, 39.23), "Temeke": (-6.88, 39.26), "Ubungo": (-6.78, 39.21), "Kigamboni": (-6.9, 39.33)},
    "Dodoma": {"Dodoma City": (-6.1731, 35.7395), "Bahi": (-5.9667, 35.2), "Chamwino": (-6.25, 35.6), "Chemba": (-5.55, 35.75), "Kondoa": (-4.9, 35.7833), "Kongwa": (-6.2, 36.4167), "Mpwapwa": (-6.35, 36.4833)},
    "Geita": {"Geita": (-2.8667, 32.1667), "Bukombe": (-3.4, 32.25), "Chato": (-2.6167, 31.9833), "Mbogwe": (-3.2, 32.05), "Nyang'hwale": (-3.0, 32.5)},
    "Iringa": {"Iringa Urban": (-7.7701, 35.693), "Iringa Rural": (-7.85, 35.6), "Kilolo": (-7.7, 36.3), "Mufindi": (-8.5833, 35.3333)},
    "Kagera": {"Bukoba Urban": (-1.3319, 31.8196), "Bukoba Rural": (-1.4, 31.75), "Biharamulo": (-2.6333, 31.3), "Karagwe": (-1.5, 31.15), "Kyerwa": (-1.65, 30.9), "Misenyi": (-1.1, 31.7833), "Muleba": (-1.8333, 31.6667), "Ngara": (-2.5, 30.65)},
    "Katavi": {"Mpanda": (-6.3433, 31.0667), "Mlele": (-6.5, 31.5), "Nsimbo": (-6.8, 31.7)},
    "Kigoma": {"Kigoma Urban": (-4.8769, 29.6267), "Kigoma Rural": (-4.9, 29.7), "Buhigwe": (-4.2, 29.9), "Kakonko": (-3.2833, 30.95), "Kasulu": (-4.5667, 30.1), "Kibondo": (-3.9833, 30.7), "Uvinza": (-5.1, 30.3833)},
    "Kilimanjaro": {"Moshi Urban": (-3.35, 37.3333), "Moshi Rural": (-3.4, 37.25), "Hai": (-3.4667, 37.0667), "Mwanga": (-4.15, 37.3667), "Rombo": (-3.2333, 37.6), "Same": (-4.0667, 37.7333), "Siha": (-3.5667, 37.0)},
    "Lindi": {"Lindi Urban": (-9.9966, 39.7166), "Lindi Rural": (-10.05, 39.65), "Kilwa": (-8.9167, 39.5167), "Liwale": (-9.7667, 37.9333), "Nachingwea": (-10.35, 38.7667), "Ruangwa": (-10.4833, 38.9667)},
    "Manyara": {"Babati Urban": (-4.2167, 35.75), "Babati Rural": (-4.3, 35.7), "Hanang": (-4.45, 35.4), "Kiteto": (-5.8833, 36.7), "Mbulu": (-3.85, 35.5333), "Simanjiro": (-4.2, 36.85)},
    "Mara": {"Musoma Urban": (-1.5, 33.8), "Musoma Rural": (-1.55, 33.7), "Bunda": (-1.8667, 33.8667), "Butiama": (-1.7, 33.9667), "Rorya": (-1.4333, 34.15), "Serengeti": (-2.3333, 34.8333), "Tarime": (-1.35, 34.1667)},
    "Mbeya": {"Mbeya City": (-8.9, 33.45), "Mbeya Rural": (-8.95, 33.4), "Busokelo": (-9.0, 33.75), "Chunya": (-8.55, 33.4167), "Kyela": (-9.5833, 33.9167), "Mbarali": (-8.4, 34.25), "Momba": (-9.5, 32.75), "Rungwe": (-9.1833, 33.6)},
    "Morogoro": {"Morogoro Urban": (-6.8242, 37.6615), "Morogoro Rural": (-7.0, 37.5), "Gairo": (-6.1667, 36.7333), "Kilombero": (-8.4, 36.5333), "Kilosa": (-6.8333, 36.9833), "Mvomero": (-6.25, 37.65), "Ulanga": (-8.6667, 36.65)},
    "Mtwara": {"Mtwara Urban": (-10.264, 40.1833), "Mtwara Rural": (-10.3, 40.1), "Masasi": (-10.7333, 38.8), "Nanyumbu": (-11.0833, 39.05), "Newala": (-10.9833, 39.65), "Tandahimba": (-10.85, 39.6833)},
    "Mwanza": {"Ilemela": (-2.4833, 32.9167), "Nyamagana": (-2.5167, 32.9), "Kwimba": (-3.0833, 33.1), "Magu": (-2.8167, 33.4667), "Misungwi": (-2.85, 33.05), "Sengerema": (-2.6333, 32.5833), "Ukerewe": (-2.0833, 32.9167)},
    "Njombe": {"Njombe Urban": (-9.3333, 34.7667), "Njombe Rural": (-9.4, 34.7), "Ludewa": (-10.0, 34.6667), "Makete": (-9.0, 34.3333), "Wanging'ombe": (-9.1, 35.1667)},
    "Pwani": {"Bagamoyo": (-6.44, 38.91), "Kibaha Urban": (-6.7833, 38.9167), "Kibaha Rural": (-6.8, 38.85), "Kisarawe": (-6.9833, 39.0167), "Mafia": (-7.9167, 39.8333), "Mkuranga": (-7.1167, 39.2333), "Rufiji": (-7.8333, 39.2)},
    "Rukwa": {"Sumbawanga Urban": (-7.9667, 31.6167), "Sumbawanga Rural": (-8.05, 31.6), "Kalambo": (-8.5833, 31.2833), "Nkasi": (-7.25, 31.5)},
    "Ruvuma": {"Songea Urban": (-10.6833, 35.65), "Songea Rural": (-10.75, 35.55), "Mbinga": (-10.9167, 35.0), "Namtumbo": (-10.4167, 36.0333), "Nyasa": (-11.25, 34.75), "Tunduru": (-11.1, 37.35)},
    "Shinyanga": {"Shinyanga Urban": (-3.6635, 33.427), "Shinyanga Rural": (-3.7, 33.4), "Kahama": (-3.8333, 32.6), "Kishapu": (-3.5, 33.6833), "Msalala": (-3.3, 32.5167), "Ushetu": (-3.8833, 32.7667)},
    "Simiyu": {"Bariadi": (-2.8167, 34.0667), "Busega": (-2.5, 33.95), "Itilima": (-2.65, 34.35), "Maswa": (-2.9, 33.8), "Meatu": (-3.6667, 34.0333)},
    "Singida": {"Singida Urban": (-4.8158, 34.7469), "Singida Rural": (-4.9, 34.7), "Ikungi": (-5.5, 34.7), "Iramba": (-4.3333, 34.9167), "Manyoni": (-5.75, 34.85), "Mkalama": (-4.1667, 34.8833)},
    "Songwe": {"Ileje": (-9.3667, 33.2167), "Mbozi": (-9.0167, 32.9333), "Momba": (-9.5, 32.75), "Songwe": (-9.0, 33.1)},
    "Tabora": {"Tabora Urban": (-5.0167, 32.8), "Igunga": (-4.2833, 33.0167), "Kaliua": (-5.1667, 31.8333), "Nzega": (-4.2167, 33.1833), "Sikonge": (-5.6333, 32.7667), "Urambo": (-5.0667, 32.05), "Uyui": (-5.15, 32.7)},
    "Tanga": {"Tanga City": (-5.0694, 39.0994), "Handeni": (-5.4333, 38.0167), "Kilindi": (-5.2667, 38.4167), "Korogwe": (-5.15, 38.4833), "Lushoto": (-4.7833, 38.2833), "Mkinga": (-4.7333, 39.1833), "Muheza": (-5.1667, 38.7833), "Pangani": (-5.4333, 38.9667)},
    "Zanzibar North": {"Kaskazini A": (-5.7167, 39.2833), "Kaskazini B": (-5.75, 39.3)},
    "Zanzibar South": {"Kusini": (-6.25, 39.3667), "Kati": (-6.1, 39.3333)},
    "Zanzibar West": {"Mjini": (-6.1659, 39.2026), "Magharibi A": (-6.1333, 39.15), "Magharibi B": (-6.2, 39.1333)},
}

# Region-level fallback coordinates
REGION_COORDS = {
    "Arusha": (-3.3869, 36.6827), "Dar es Salaam": (-6.8235, 39.2695), "Dodoma": (-6.1731, 35.7395),
    "Geita": (-2.8667, 32.1667), "Iringa": (-7.7701, 35.693), "Kagera": (-1.3319, 31.8196),
    "Katavi": (-6.3433, 31.0667), "Kigoma": (-4.8769, 29.6267), "Kilimanjaro": (-3.35, 37.3333),
    "Lindi": (-9.9966, 39.7166), "Manyara": (-4.2167, 35.75), "Mara": (-1.5, 33.8),
    "Mbeya": (-8.9, 33.45), "Morogoro": (-6.8242, 37.6615), "Mtwara": (-10.264, 40.1833),
    "Mwanza": (-2.5167, 32.9), "Njombe": (-9.3333, 34.7667), "Pwani": (-6.44, 38.91),
    "Rukwa": (-7.9667, 31.6167), "Ruvuma": (-10.6833, 35.65), "Shinyanga": (-3.6635, 33.427),
    "Simiyu": (-2.8167, 34.0667), "Singida": (-4.8158, 34.7469), "Songwe": (-9.0, 33.1),
    "Tabora": (-5.0167, 32.8), "Tanga": (-5.0694, 39.0994),
}


def _resolve_coords(district: str = None, region: str = None):
    """Return (lat, lon, location_label) for the given district/region."""
    if district and region and region in DISTRICT_COORDS:
        districts = DISTRICT_COORDS[region]
        if district in districts:
            lat, lon = districts[district]
            return lat, lon, f"{district} District, {region} Region"
        # Fuzzy match: district name contains or is contained in key
        for key, coords in districts.items():
            if district.lower() in key.lower() or key.lower() in district.lower():
                return coords[0], coords[1], f"{key}, {region} Region"
    if region and region in REGION_COORDS:
        lat, lon = REGION_COORDS[region]
        return lat, lon, f"{region} Region"
    if region:
        # Try fuzzy region match
        for key, coords in REGION_COORDS.items():
            if region.lower() in key.lower() or key.lower() in region.lower():
                return coords[0], coords[1], f"{key} Region"
    return TANZANIA_CENTER_LAT, TANZANIA_CENTER_LON, "Tanzania"


_weather_cache: dict = {}  # key: (district, region) → {"data": ..., "fetched_at": ...}


def get_weather_forecast(district: str = None, region: str = None) -> dict:
    """Get the current weather and 7-day forecast for the farmer's specific location in Tanzania.
    Always pass the farmer's district and region from the Farm Context so the forecast is accurate for their area.

    Args:
        district: The farmer's district (e.g. "Karatu", "Moshi Urban", "Morogoro Urban"). From Farm Context.
        region: The farmer's region (e.g. "Arusha", "Kilimanjaro", "Morogoro"). From Farm Context.

    Returns daily temperature (min/max), precipitation, humidity, wind speed, rain probability, and fertigation advice."""
    cache_key = (district or "", region or "")
    now = datetime.now()
    cached = _weather_cache.get(cache_key)
    if cached and cached.get("fetched_at") and (now - cached["fetched_at"]).total_seconds() < 1800:
        return cached["data"]

    lat, lon, location_label = _resolve_coords(district, region)

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
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
            "location": location_label,
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

        _weather_cache[cache_key] = {"data": result, "fetched_at": now}
        return result

    except Exception as e:
        return {
            "error": f"Could not fetch weather data: {str(e)}",
            "fallback": {
                "location": location_label,
                "climate": "Tropical climate varies by region. Dry season typically June-October in most areas.",
                "fertigation_general": "Apply fertigation early morning on dry days with low wind. Avoid before expected rain."
            }
        }
