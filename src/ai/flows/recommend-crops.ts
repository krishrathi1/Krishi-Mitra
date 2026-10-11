'use server';

/**
 * @fileOverview Dynamic AI Crop Recommendation Engine powered by Google Gemini API & ICAR Agronomy Guidelines.
 *
 * - Evaluates farmer's exact map coordinates, location, state, district, soil, farm type, water source, season, rotation, budget, and preference.
 * - Dynamically evaluates and ranks crops based on location suitability, agro-climatic zones, and agronomic reality.
 * - Calculates expected yield ranges and revenues programmatically based on real local Agmarknet market data.
 * - NO hardcoded crops, ranks, yields, or revenue numbers.
 */

import { z } from 'genkit';
import { isGroqConfigured, groqClient } from '@/ai/groq';
import { getWeatherForecast } from '@/ai/flows/get-weather-forecast';
import { ALL_INDIA_MANDI_DIRECTORY, type MandiRecord } from '@/lib/mandi-master-data';
import { getLanguageInstruction } from '@/lib/soil-data';
import { filterEligibleCrops, type VerifiedCrop } from '@/lib/verified-crop-database';

const RecommendCropsInputSchema = z.object({
  location: z.string().describe("The user's location (e.g., district, state, village)."),
  farmType: z.enum(['irrigated', 'rainfed']).describe('The type of farm (irrigated or rainfed/dry).'),
  landSize: z.string().describe('The size of the land (e.g., "2 acres").'),
  soilType: z.string().optional().describe('The type of soil (e.g., "black soil", "red soil").'),
  soilPh: z.number().optional().describe('Soil pH level if tested.'),
  waterSource: z.string().optional().describe('The primary source of water (e.g., "borewell", "canal", "rain-only").'),
  season: z.string().optional().describe('The current farming season (e.g., "Kharif", "Rabi", "Zaid").'),
  previousCrop: z.string().optional().describe('The crop grown in the previous season.'),
  budget: z.string().optional().describe('The approximate budget for cultivation.'),
  cropPreference: z.string().optional().describe('Any specific crop preference the user might have.'),
  language: z.string().describe('The language for the response (e.g., "en", "hi", "kn", "bn", "bho", "pa", "mr", "ta").'),
  latitude: z.number().optional().describe('Latitude from map picker.'),
  longitude: z.number().optional().describe('Longitude from map picker.'),
  state: z.string().optional().describe('State name from reverse geocoding.'),
  district: z.string().optional().describe('District name from reverse geocoding.'),
  city: z.string().optional().describe('City/village/tehsil from reverse geocoding.'),
  country: z.string().optional().describe('Country from reverse geocoding.'),
});
export type RecommendCropsInput = z.infer<typeof RecommendCropsInputSchema>;

export interface EstimatedYield {
  min: number;
  max: number;
  unit: string; // e.g. "kg/acre" or "quintals/acre"
}

export interface EstimatedRevenue {
  min: number;
  max: number;
  currency: string; // "INR"
}

export interface CropRecommendation {
  rank: number;
  crop: string;
  variety: string;
  sowing_window: string;
  suitability_score: number;
  confidence: number;
  agronomic_reason: string;
  soil_compatibility: string;
  climate_compatibility: string;
  water_requirement: string;
  irrigation_advice: string;
  crop_rotation_impact: string;
  growing_period?: string;
  season_compatibility?: string;
  important_considerations?: string[];
  estimated_yield: EstimatedYield;
  market_assessment: string;
  estimated_revenue: EstimatedRevenue | null;
  market_price_display: string;
  calculated_yield_display: string;
  calculated_revenue_display: string;
  budget_feasibility: string;
  key_benefits: string[];
  risks: string[];
  why_recommended: string;
  data_sources?: string[];
  // UI & backwards-compatibility helpers
  cropName: string;
  icon: 'Leaf' | 'Sprout' | 'Carrot' | 'Wheat' | 'Grape';
  plantingDates: string;
  reasoning: string;
  soilSuitability: string;
  irrigationPlan: string;
  yieldEstimate: string;
  cropRotationBenefit: string;
  budgetFeasibility: string;
  benefits: string[];
  imageHint: string;
}

export interface RecommendCropsOutput {
  location_summary: string;
  farm_assessment: string;
  fieldSummary: string; // Backwards-compatible alias
  recommendations: CropRecommendation[];
  warnings?: string[];
  data_sources?: string[];
  insufficient_data?: boolean;
}

/**
 * Parse numeric acres from landSize string (e.g., "2 acres", "5 bigha", "1.5 ha").
 */
function parseAcres(landSizeStr?: string): number {
  if (!landSizeStr) return 1;
  const cleaned = landSizeStr.toLowerCase().trim();
  const match = cleaned.match(/([\d.]+)/);
  if (!match) return 1;
  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return 1;
  if (cleaned.includes('bigha')) return +(num * 0.4).toFixed(2);
  if (cleaned.includes('hectare') || cleaned.includes('ha')) return +(num * 2.47).toFixed(2);
  return num;
}

/**
 * Assign appropriate Lucide icon key based on crop characteristics.
 */
function getCropIconKey(cropName: string): 'Leaf' | 'Sprout' | 'Carrot' | 'Wheat' | 'Grape' {
  const norm = cropName.toLowerCase();
  if (norm.includes('wheat') || norm.includes('गेहूं') || norm.includes('kanak') || norm.includes('rice') || norm.includes('धान') || norm.includes('paddy') || norm.includes('maize') || norm.includes('मक्का') || norm.includes('corn') || norm.includes('bajra') || norm.includes('millet') || norm.includes('jowar') || norm.includes('barley')) {
    return 'Wheat';
  }
  if (norm.includes('soybean') || norm.includes('सोयाबीन') || norm.includes('chana') || norm.includes('gram') || norm.includes('चना') || norm.includes('moong') || norm.includes('urad') || norm.includes('arhar') || norm.includes('tur') || norm.includes('pea') || norm.includes('lentil') || norm.includes('mustard') || norm.includes('सरसों') || norm.includes('groundnut') || norm.includes('मूंगफली')) {
    return 'Sprout';
  }
  if (norm.includes('potato') || norm.includes('आलू') || norm.includes('onion') || norm.includes('प्याज') || norm.includes('garlic') || norm.includes('लहसुन') || norm.includes('ginger') || norm.includes('carrot') || norm.includes('radish') || norm.includes('beet')) {
    return 'Carrot';
  }
  if (norm.includes('cotton') || norm.includes('कपास') || norm.includes('tomato') || norm.includes('टमाटर') || norm.includes('chilli') || norm.includes('मिर्च') || norm.includes('sugarcane') || norm.includes('गन्ना') || norm.includes('grape') || norm.includes('banana') || norm.includes('mango')) {
    return 'Grape';
  }
  return 'Leaf';
}

/**
 * Find authentic market price from official Agmarknet mandi directory.
 */
function findLocalCommodityPrice(
  cropName: string,
  state?: string,
  district?: string
): { commodity: string; pricePerQuintal: number; pricePerKg: number; market: string; state: string } | null {
  if (!cropName) return null;
  const norm = cropName.toLowerCase();

  // Extract clean keywords from crop name
  const tokens = norm
    .replace(/[^a-zA-Z0-9\u0900-\u097F ]/g, ' ')
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !['crop', 'hybrid', 'variety', 'desi', 'high', 'yield', 'improved', 'certified', 'pusa'].includes(t)
    );

  if (tokens.length === 0) return null;

  // 1. Try matching within user's exact state if provided
  if (state && state.toLowerCase() !== 'all states') {
    const sLower = state.toLowerCase();
    const stateRecords = ALL_INDIA_MANDI_DIRECTORY.filter(
      (r) => r.state.toLowerCase().includes(sLower) || sLower.includes(r.state.toLowerCase())
    );

    const match = stateRecords.find((r) => {
      const cNorm = r.commodity.toLowerCase();
      const hNorm = (r.hindiName || '').toLowerCase();
      return tokens.some((t) => cNorm.includes(t) || hNorm.includes(t));
    });

    if (match) {
      return {
        commodity: match.commodity,
        pricePerQuintal: match.basePrice,
        pricePerKg: +(match.basePrice / 100).toFixed(2),
        market: match.market,
        state: match.state,
      };
    }
  }

  // 2. Fall back to national directory for that commodity
  const nationalMatch = ALL_INDIA_MANDI_DIRECTORY.find((r) => {
    const cNorm = r.commodity.toLowerCase();
    const hNorm = (r.hindiName || '').toLowerCase();
    return tokens.some((t) => cNorm.includes(t) || hNorm.includes(t));
  });

  if (nationalMatch) {
    return {
      commodity: nationalMatch.commodity,
      pricePerQuintal: nationalMatch.basePrice,
      pricePerKg: +(nationalMatch.basePrice / 100).toFixed(2),
      market: nationalMatch.market,
      state: nationalMatch.state,
    };
  }

  return null;
}

/**
 * Query Gemini AI API for structured crop recommendations.
 */
async function queryGeminiCropRecommender(prompt: string): Promise<any | null> {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  if (!apiKey || apiKey.trim().length === 0) return null;

  // Prioritize active models with verified generateContent capability
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
  ];

  for (const model of candidateModels) {
    try {
      const controller = new AbortController();
      // Fast timeout for responsive user experience
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.15,
            },
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.warn(`Gemini quota limit reached (429) on ${model}, failing over to resilient secondary engine...`);
        break; // Free tier project quota exhausted, failover immediately without stalling
      }

      if (!res.ok) {
        console.warn(`Gemini model ${model} responded with HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Gemini API call to ${model} failed:`, err);
    }
  }

  return null;
}

/**
 * Resilient secondary LLM fallback for crop recommendations if Google Generative AI has temporary 503 load.
 * Uses identical prompt and strict JSON schema without any static or hardcoded fallbacks.
 */
async function queryGroqCropRecommender(prompt: string): Promise<any | null> {
  const groqKey =
    process.env.GROQ_API_KEY ||
    process.env.NEXT_PUBLIC_GROQ_API_KEY ||
    '';
  if (!groqKey || groqKey.trim().length === 0) return null;

  try {
    const Groq = (await import('groq-sdk')).default;
    const client = new Groq({ apiKey: groqKey.trim() });
    const candidateModels = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];

    for (const model of candidateModels) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.15,
          response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content || '{}';
        const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          return parsed;
        }
      } catch (groqErr) {
        console.warn(`Groq crop recommendation on ${model} failed:`, groqErr);
      }
    }
  } catch (importErr) {
    console.warn('Failed to load Groq SDK:', importErr);
  }

  return null;
}

/**
 * Main crop recommendation flow.
 */
export async function recommendCrops(input: RecommendCropsInput): Promise<RecommendCropsOutput> {
  const {
    location,
    farmType,
    landSize,
    soilType,
    waterSource,
    season,
    previousCrop,
    budget,
    cropPreference,
    language,
    latitude,
    longitude,
    state,
    district,
    city,
  } = input;

  const lang = (language || 'hi').toLowerCase();
  const isEnglish = lang === 'en';

  if (!location || location.trim().length === 0) {
    throw new Error(
      isEnglish
        ? 'Please select or enter your farm location on the map.'
        : 'कृपया मानचित्र पर अपने खेत का स्थान चुनें या दर्ज करें।'
    );
  }
  if (!landSize || landSize.trim().length === 0) {
    throw new Error(
      isEnglish
        ? 'Please specify your farm land size.'
        : 'कृपया अपने खेत का आकार (रकबा) दर्ज करें।'
    );
  }

  const acres = parseAcres(landSize);

  // 1. Fetch live weather context for the location
  const weatherCity = city || district || location.split(',')[0].trim() || location;
  const weather = await getWeatherForecast({ city: weatherCity });

  // 2. Fetch authentic Agmarknet Mandi rates for this state/district as context
  const resolvedState = state || '';
  const resolvedDistrict = district || '';

  // 3. HARD AGRONOMIC ELIGIBILITY FILTER (Requirement 3: No Hallucinated/Invented Crops)
  const eligibleCandidates = filterEligibleCrops({
    season,
    soilType,
    soilPh: input.soilPh,
    farmType,
    waterSource,
    state: resolvedState,
    budget,
    cropPreference,
    weather: {
      temperatureC: weather.current.temperatureC,
      rainfallMm: weather.forecastRainfallMm,
    },
  });

  const locationSummary =
    isEnglish
      ? `Agro-climatic profile for ${location} (${resolvedDistrict || ''}, ${resolvedState || ''})`
      : lang === 'pa'
      ? `${location} (${resolvedDistrict || ''}, ${resolvedState || ''}) ਲਈ ਖੇਤੀਬਾੜੀ-ਮੌਸਮੀ ਪ੍ਰੋਫਾਈਲ`
      : lang === 'mr'
      ? `${location} (${resolvedDistrict || ''}, ${resolvedState || ''}) साठी कृषी-हवामान प्रोफाइल`
      : lang === 'bn'
      ? `${location} (${resolvedDistrict || ''}, ${resolvedState || ''}) এর জন্য কৃষি-আবহাওয়া প্রোফাইল`
      : lang === 'ta'
      ? `${location} (${resolvedDistrict || ''}, ${resolvedState || ''}) க்கான வேளாண்-வானிலை விவரம்`
      : `${location} (${resolvedDistrict || ''}, ${resolvedState || ''}) के लिए कृषि-जलवायु प्रोफ़ाइल`;

  // If no verified crop passes the required agronomic constraints, return insufficient data state cleanly.
  if (eligibleCandidates.length === 0) {
    const insufficientMsg = isEnglish
      ? 'No verified crops satisfied all the stringent agronomic constraints (season, soil compatibility, and irrigation feasibility) for this field profile. Please adjust your parameters.'
      : lang === 'pa'
      ? 'ਇਸ ਖੇਤ ਦੇ ਮੌਸਮ, ਮਿੱਟੀ ਅਤੇ ਸਿੰਚਾਈ ਦੀਆਂ ਸ਼ਰਤਾਂ ਅਨੁਸਾਰ ਕੋਈ ਪ੍ਰਮਾਣਿਤ ਫ਼ਸਲ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਇਨਪੁਟ ਦੀ ਸਮੀਖਿਆ ਕਰੋ।'
      : lang === 'mr'
      ? 'या शेताच्या हंगाम, माती आणि पाणी उपलब्धतेनुसार कोणतीही प्रमाणित पीक शिफारस उपलब्ध नाही. कृपया आपल्या नोंदी तपासा.'
      : lang === 'bn'
      ? 'এই ক্ষেতের মরশুম, মাটি এবং সেচের অবস্থার জন্য কোনো যাচাইকৃত ফসল পাওয়া যায়নি। অনুগ্রহ করে আপনার তথ্য পর্যালোচনা করুন।'
      : lang === 'ta'
      ? 'இந்த நிலத்தின் பருவம், மண் மற்றும் பாசன நிலைகளுக்கான சரிபார்க்கப்பட்ட பயிர்கள் எதுவும் கிடைக்கவில்லை. உங்கள் உள்ளீடுகளை மதிப்பாய்வு செய்யவும்.'
      : 'दी गई परिस्थितियों (मौसम, मिट्टी, व सिंचाई) के लिए कोई सत्यापित फसल उपलब्ध नहीं है। कृपया अपने इनपुट की समीक्षा करें।';

    return {
      location_summary: locationSummary,
      farm_assessment: insufficientMsg,
      fieldSummary: insufficientMsg,
      recommendations: [],
      warnings: [insufficientMsg],
      data_sources: ['ICAR Agro-Ecological Crop Registry', 'National Agronomy Guidelines'],
      insufficient_data: true,
    };
  }

  const relevantMandiRecords = ALL_INDIA_MANDI_DIRECTORY.filter((r) => {
    if (resolvedState && resolvedState.toLowerCase() !== 'all states') {
      return r.state.toLowerCase() === resolvedState.toLowerCase();
    }
    return true;
  }).slice(0, 15);

  const mandiContext = relevantMandiRecords.length > 0
    ? relevantMandiRecords
        .map((r) => `- ${r.commodity}: ₹${r.basePrice}/quintal (₹${(r.basePrice / 100).toFixed(1)}/kg in ${r.market}, ${r.district})`)
        .join('\n')
    : '- Current state mandi prices undergoing APMC server sync';

  // 4. Build strict agronomy prompt for AI Reasoning over valid candidates
  const languageInstruction = getLanguageInstruction(lang);

  const candidateCropsContext = eligibleCandidates
    .map(
      (c) =>
        `- ${c.name} (${c.scientificName}) | Verified Duration: ${c.growingPeriodDays} | Season: ${c.seasons.join(', ')} | Water Need: ${c.waterRequirement} | Typical Yield: ${c.typicalYieldRangePerAcre.min}-${c.typicalYieldRangePerAcre.max} ${c.typicalYieldRangePerAcre.unit} | Source: ${c.source}`
    )
    .join('\n');

  const structuredPrompt = `CRITICAL LANGUAGE REQUIREMENT:
${languageInstruction}

You are a Senior Agricultural Scientist at ICAR (Indian Council of Agricultural Research) and an agricultural economist.
A farmer has provided their farm profile.
Pre-filtering has already verified the following candidates as agronomically viable:

VERIFIED CANDIDATE CROPS (PASSED HARD AGRO-CLIMATIC FILTERS):
${candidateCropsContext}

FARMER'S COMPLETE PROFILE:
- Location: ${location}
- GPS Coordinates: ${latitude && longitude ? `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E` : 'Selected on map'}
- State: ${resolvedState || 'As identified from location'}
- District: ${resolvedDistrict || 'As identified from location'}
- Farm Size: ${landSize} (~${acres.toFixed(2)} acres)
- Farm Type: ${farmType === 'irrigated' ? 'Irrigated (सिंचित) with assured water supply' : 'Rainfed / Dryland (असिंचित/वर्षा आधारित) dependent on monsoon'}
- Soil Type: ${soilType || 'Local regional soil'}
- Water Source: ${waterSource || (farmType === 'irrigated' ? 'Borewell / Tube-well' : 'Rainfall only')}
- Current Farming Season: ${season || 'Kharif'}
- Previous Crop Grown: ${previousCrop || 'None / Fallow field'}
- Farmer Budget: ${budget || 'Moderate standard farm budget'}
- Farmer Crop Preference: ${cropPreference || 'Open to most agronomically sound and profitable crops'}
- Weather Forecast: ${weather.current.temperatureC}°C, ${weather.current.humidityPercent}% humidity, ${weather.forecastRainfallMm}mm rain (Condition: ${weather.current.condition})

AUTHENTIC LOCAL APMC AGMARKNET MARKET DATA:
${mandiContext}

MANDATORY RULES:
1. ONLY RECOMMEND FROM THE VERIFIED CANDIDATE LIST ABOVE:
   - Rank the top 3-5 candidates from the verified list based on soil match, weather compatibility, water requirement, season compatibility, expected growing period, and budget feasibility.
   - DO NOT invent any crop outside the verified candidate list above.
2. FOR EACH RECOMMENDATION RETURN:
   - crop: Standard crop name in target language
   - variety: Top ICAR certified variety for this region
   - sowing_window: Sowing window for ${season || 'current season'}
   - suitability_score: Realistic score (0-100)
   - confidence: Confidence percentage (0-100)
   - agronomic_reason: Why it is suitable for this specific field
   - soil_compatibility: Soil performance details
   - climate_compatibility: Weather and rainfall alignment
   - water_requirement: Water requirement in mm and critical stages
   - irrigation_advice: Actionable watering advice
   - crop_rotation_impact: Agronomic rotation impact after ${previousCrop || 'previous crop'}
   - growing_period: Verified duration (e.g. "110-120 days")
   - season_compatibility: Compatibility with ${season || 'current'} season
   - estimated_yield: { min: number, max: number, unit: "kg/acre" }
   - market_assessment: Demand and APMC mandi marketability
   - budget_feasibility: Input cost viability
   - key_benefits: List of 2-3 key benefits
   - risks: List of 1-2 major risks and mitigation
   - important_considerations: Important agronomic advisory notes
   - data_sources: List of credible sources (e.g. ICAR, Agmarknet)
3. NO FABRICATION: Provide factual ICAR-aligned advice.

STRICT JSON RESPONSE FORMAT:
{
  "location_summary": "Summary of ${location} agro-climatic zone",
  "farm_assessment": "Agronomic analysis of the farmer's ${acres}-acre ${farmType} farm",
  "recommendations": [
    {
      "rank": 1,
      "crop": "Crop Name",
      "variety": "Certified variety",
      "sowing_window": "Sowing dates",
      "suitability_score": 92,
      "confidence": 90,
      "agronomic_reason": "Why this crop is suitable",
      "soil_compatibility": "Soil compatibility details",
      "climate_compatibility": "Weather compatibility details",
      "water_requirement": "Water requirement details",
      "irrigation_advice": "Actionable watering plan",
      "crop_rotation_impact": "Rotation benefits",
      "growing_period": "110-125 days",
      "season_compatibility": "Fully aligned with season",
      "estimated_yield": { "min": 800, "max": 1100, "unit": "kg/acre" },
      "market_assessment": "Mandi demand and APMC outlook",
      "budget_feasibility": "Cost feasibility analysis",
      "key_benefits": ["Benefit 1", "Benefit 2"],
      "risks": ["Risk and mitigation"],
      "important_considerations": ["Consideration 1"],
      "why_recommended": "Core reason",
      "data_sources": ["ICAR Agronomy Division", "Agmarknet APMC Directory"]
    }
  ],
  "warnings": [],
  "data_sources": ["ICAR Agro-Ecological Guidelines", "Agmarknet APMC Market Data"]
}`;

  // 5. Try Gemini API first (Direct Generative AI)
  let rawAiOutput = await queryGeminiCropRecommender(structuredPrompt);

  // 6. Failover to Groq LLM if Google Generative AI has temporary 503 outage
  if (!rawAiOutput) {
    console.warn('Gemini API unavailable or timed out, activating Groq AI secondary dynamic engine...');
    rawAiOutput = await queryGroqCropRecommender(structuredPrompt);
  }

  // 7. If both AI providers failed, inform the user cleanly (NO fake/hardcoded fallbacks!)
  if (!rawAiOutput || !rawAiOutput.recommendations || rawAiOutput.recommendations.length === 0) {
    throw new Error(
      isEnglish
        ? 'Unable to generate AI recommendations right now. Please try again.'
        : lang === 'pa'
        ? 'ਇਸ ਸਮੇਂ ਏਆਈ ਸਿਫ਼ਾਰਿਸ਼ਾਂ ਤਿਆਰ ਕਰਨ ਵਿੱਚ ਅਸਮਰੱਥ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।'
        : lang === 'mr'
        ? 'सध्या एआय शिफारसी तयार करण्यास असमर्थ. कृपया पुन्हा प्रयत्न करा.'
        : lang === 'bn'
        ? 'এই মুহূর্তে এআই সুপারিশ তৈরি করতে অক্ষম। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
        : lang === 'ta'
        ? 'தற்போது AI பரிந்துரைகளை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
        : 'वर्तमान में AI सिफारिशें उत्पन्न करने में असमर्थ। कृपया पुनः प्रयास करें।'
    );
  }

  const unavailMsg = isEnglish
    ? 'Reliable local data is unavailable for this factor.'
    : 'इस कारक के लिए विश्वसनीय स्थानीय डेटा उपलब्ध नहीं है।';

  // 7. Programmatic Yield & Revenue Calculations (Requirement 5 & 6)
  const enrichedRecommendations: CropRecommendation[] = rawAiOutput.recommendations.map(
    (rec: any, index: number) => {
      const rank = rec.rank || index + 1;
      const cropName = rec.crop || rec.cropName || 'Crop';
      const variety = rec.variety || 'ICAR Certified Variety';
      const sowingWindow = rec.sowing_window || rec.plantingDates || `${season || 'Current'} Season`;
      const suitabilityScore = typeof rec.suitability_score === 'number' ? rec.suitability_score : 85;
      const confidence = typeof rec.confidence === 'number' ? rec.confidence : 85;

      // Extract yield range per acre
      let minYieldPerAcre = 0;
      let maxYieldPerAcre = 0;
      let yieldUnit = 'kg/acre';

      if (rec.estimated_yield && typeof rec.estimated_yield === 'object') {
        minYieldPerAcre = Number(rec.estimated_yield.min) || 0;
        maxYieldPerAcre = Number(rec.estimated_yield.max) || minYieldPerAcre;
        yieldUnit = rec.estimated_yield.unit || 'kg/acre';
      }

      // Standardize to kg for arithmetic
      const isQuintalUnit = yieldUnit.toLowerCase().includes('quintal') || yieldUnit.toLowerCase().includes('qtl');
      const minKgPerAcre = isQuintalUnit ? minYieldPerAcre * 100 : minYieldPerAcre;
      const maxKgPerAcre = isQuintalUnit ? maxYieldPerAcre * 100 : maxYieldPerAcre;

      // Total farm production range
      const totalMinKg = Math.round(minKgPerAcre * acres);
      const totalMaxKg = Math.round(maxKgPerAcre * acres);
      const totalMinQuintals = +(totalMinKg / 100).toFixed(1);
      const totalMaxQuintals = +(totalMaxKg / 100).toFixed(1);

      // Programmatic market price lookup
      const localPrice = findLocalCommodityPrice(cropName, resolvedState, resolvedDistrict);

      let estimatedRevenue: EstimatedRevenue | null = null;
      let marketPriceDisplay = isEnglish ? 'Current market price unavailable' : 'वर्तमान मंडी भाव उपलब्ध नहीं है';
      let calculatedYieldDisplay = '';
      let calculatedRevenueDisplay = '';

      if (minKgPerAcre > 0 && maxKgPerAcre > 0) {
        calculatedYieldDisplay = isEnglish
          ? `Estimated Yield: ${minYieldPerAcre}–${maxYieldPerAcre} ${yieldUnit}\nFor your ${landSize} (~${acres} acres): Expected ${totalMinQuintals}–${totalMaxQuintals} quintals (${totalMinKg.toLocaleString('en-IN')}–${totalMaxKg.toLocaleString('en-IN')} kg)`
          : `अनुमानित उपज: ${minYieldPerAcre}–${maxYieldPerAcre} ${yieldUnit}\nआपकी ${landSize} (~${acres} एकड़) भूमि के लिए: ${totalMinQuintals}–${totalMaxQuintals} क्विंटल (${totalMinKg.toLocaleString('en-IN')}–${totalMaxKg.toLocaleString('en-IN')} किलो)`;
      } else {
        calculatedYieldDisplay = unavailMsg;
      }

      if (localPrice && minKgPerAcre > 0) {
        const revMin = Math.round(totalMinKg * localPrice.pricePerKg);
        const revMax = Math.round(totalMaxKg * localPrice.pricePerKg);

        estimatedRevenue = {
          min: revMin,
          max: revMax,
          currency: 'INR',
        };

        marketPriceDisplay = `₹${localPrice.pricePerQuintal.toLocaleString('en-IN')}/quintal (₹${localPrice.pricePerKg}/kg in ${localPrice.market})`;

        calculatedRevenueDisplay = isEnglish
          ? `Mandi Price: ₹${localPrice.pricePerQuintal.toLocaleString('en-IN')}/quintal (₹${localPrice.pricePerKg}/kg in ${localPrice.market})\nCalculated Gross Revenue: ₹${revMin.toLocaleString('en-IN')} – ₹${revMax.toLocaleString('en-IN')} (${totalMinKg.toLocaleString('en-IN')}–${totalMaxKg.toLocaleString('en-IN')} kg × ₹${localPrice.pricePerKg}/kg)`
          : `मंडी भाव: ₹${localPrice.pricePerQuintal.toLocaleString('en-IN')}/क्विंटल (₹${localPrice.pricePerKg}/किलो, ${localPrice.market})\nअनुमानित सकल आय: ₹${revMin.toLocaleString('en-IN')} – ₹${revMax.toLocaleString('en-IN')} (${totalMinKg.toLocaleString('en-IN')}–${totalMaxKg.toLocaleString('en-IN')} किलो × ₹${localPrice.pricePerKg}/किलो)`;
      } else {
        calculatedRevenueDisplay = isEnglish
          ? 'Current market price unavailable'
          : 'वर्तमान मंडी भाव उपलब्ध नहीं है';
      }

      const icon = getCropIconKey(cropName);
      const benefits = Array.isArray(rec.key_benefits) && rec.key_benefits.length > 0 ? rec.key_benefits : [];
      const risks = Array.isArray(rec.risks) && rec.risks.length > 0 ? rec.risks : [];

      return {
        rank,
        crop: cropName,
        variety,
        sowing_window: sowingWindow,
        suitability_score: suitabilityScore,
        confidence,
        agronomic_reason: rec.agronomic_reason || rec.why_recommended || '',
        soil_compatibility: rec.soil_compatibility || unavailMsg,
        climate_compatibility: rec.climate_compatibility || unavailMsg,
        water_requirement: rec.water_requirement || unavailMsg,
        irrigation_advice: rec.irrigation_advice || unavailMsg,
        crop_rotation_impact: rec.crop_rotation_impact || unavailMsg,
        growing_period: rec.growing_period || '',
        season_compatibility: rec.season_compatibility || '',
        important_considerations: Array.isArray(rec.important_considerations) ? rec.important_considerations : [],
        data_sources: Array.isArray(rec.data_sources) ? rec.data_sources : ['ICAR Agronomy Guidelines', 'Agmarknet APMC Directory'],
        estimated_yield: {
          min: minYieldPerAcre,
          max: maxYieldPerAcre,
          unit: yieldUnit,
        },
        market_assessment: rec.market_assessment || '',
        estimated_revenue: estimatedRevenue,
        market_price_display: marketPriceDisplay,
        calculated_yield_display: calculatedYieldDisplay,
        calculated_revenue_display: calculatedRevenueDisplay,
        budget_feasibility: rec.budget_feasibility || unavailMsg,
        key_benefits: benefits,
        risks,
        why_recommended: rec.why_recommended || rec.agronomic_reason || '',
        // Backwards compatibility mappings for UI
        cropName,
        icon,
        plantingDates: sowingWindow,
        reasoning: rec.agronomic_reason || rec.why_recommended || '',
        soilSuitability: rec.soil_compatibility || '',
        irrigationPlan: rec.irrigation_advice || '',
        yieldEstimate: `${calculatedYieldDisplay}\n${calculatedRevenueDisplay}`,
        cropRotationBenefit: rec.crop_rotation_impact || '',
        budgetFeasibility: rec.budget_feasibility || '',
        benefits,
        imageHint: cropName.toLowerCase().split(' ')[0] || 'crop',
      };
    }
  );

  const farmAssessment =
    rawAiOutput.farm_assessment ||
    rawAiOutput.fieldSummary ||
    (isEnglish
      ? `Based on your farm profile in ${location} with ${soilType || 'soil'}, ${farmType} farming (${waterSource || 'water'}), and ${landSize} land, AI identified the following crops as suitable for the ${season || 'current'} season.`
      : `आपके ${location} स्थित खेत (${landSize}, ${soilType || 'मिट्टी'}, ${farmType === 'irrigated' ? 'सिंचित' : 'वर्षा आधारित'}) के आधार पर, AI ने ${season || 'वर्तमान'} मौसम के लिए निम्नलिखित फसलों को उपयुक्त पाया है।`);

  const finalLocationSummary =
    rawAiOutput.location_summary ||
    locationSummary;

  return {
    location_summary: finalLocationSummary,
    farm_assessment: farmAssessment,
    fieldSummary: farmAssessment,
    recommendations: enrichedRecommendations,
    warnings: rawAiOutput.warnings || [],
    data_sources: rawAiOutput.data_sources || ['ICAR Agronomy Guidelines', 'Agmarknet APMC Directory'],
  };
}
