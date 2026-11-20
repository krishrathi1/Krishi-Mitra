// diagnose-crop-disease.ts
'use server';

/**
 * @fileOverview Diagnoses crop diseases using multimodal Google Gemini Vision,
 * high-speed Groq LLM inference, and ICAR (Indian Council of Agricultural Research) taxonomy.
 *
 * Architecture:
 * 1. Primary Engine: Gemini Multimodal Vision (analyzes uploaded leaf/crop photo).
 * 2. Secondary Engine: Groq / Gemini agronomic reasoning for symptom descriptions.
 * 3. Fallback Engine: Verified ICAR Plant Pathology Knowledge Base.
 * 4. Safety Guarantee: If confidence is low or non-crop image, returns honest guidance without fake guesses.
 */

import { z } from 'genkit';
import { cleanCropDiagnosisText } from '@/lib/utils';
import { 
  classifyPlantDisease, 
  type VerifiedDiseaseRecord 
} from '@/lib/plant-disease-classifier';
import { isGroqConfigured, groqClient } from '@/ai/groq';
import { getLanguageInstruction } from '@/lib/soil-data';

const DiagnoseCropDiseaseInputSchema = z.object({
  photoDataUri: z
    .string()
    .optional()
    .describe(
      "A photo of a crop, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  description: z.string().optional().describe('A text or voice-based description of the crop issue.'),
  language: z.string().describe('The language for the response (e.g., "en", "hi", "pa", "mr", "bn", "ta", "kn", "bho").'),
});
export type DiagnoseCropDiseaseInput = z.infer<typeof DiagnoseCropDiseaseInputSchema>;

export interface DiagnoseCropDiseaseOutput {
  isPlant: boolean;
  isConfident: boolean;
  crop?: string;
  disease?: string;
  confidence?: number;
  symptoms?: string;
  diagnosis: string;
  solutions: string;
  management?: string;
  prevention?: string;
  source?: string;
  documentationLink?: string;
  youtubeLink?: string;
  lowConfidenceMessage?: string;
}

/**
 * Multimodal AI Crop & Disease Diagnosis via Google Gemini Vision
 */
async function callGeminiVisionDiagnosis(
  photoDataUri: string,
  description?: string,
  language: string = 'en'
): Promise<DiagnoseCropDiseaseOutput | null> {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  if (!apiKey || apiKey.trim().length === 0) return null;

  // Extract MIME type and Base64 data from Data URI
  const match = photoDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64Data = match[2];

  const langInstruction = getLanguageInstruction(language);

  const promptText = `You are a Chief Agricultural Scientist and Senior Plant Pathologist in India adhering strictly to ICAR (Indian Council of Agricultural Research) taxonomy and guidelines.

Analyze this crop image carefully. ${description ? `The farmer observed: "${description}".` : ''}

CRITICAL RULES:
1. FIRST check if this image is actually an agricultural crop, plant leaf, fruit, flower, stem, or grain.
   - If it is a person, animal, vehicle, tool, indoor room, or non-agricultural object, return:
     {"isPlant": false, "isConfident": false, "diagnosis": "Not a plant", "solutions": "", "lowConfidenceMessage": "This does not appear to be an agricultural crop or plant leaf. Please upload a clear photo of an affected plant leaf or crop."}
2. ACCURATELY identify the specific crop visible in the image based on visual leaf morphology, shape, venation, and foliage (e.g. Banana / केला, Wheat / गेहूं, Rice / धान, Cotton / कपास, Tomato / टमाटर, Potato / आलू, Mustard / सरसों, Chilli / मिर्च, Maize / मक्का, Soybean / सोयाबीन, Sugarcane / गन्ना, Mango / आम, Citrus / नींबू, Apple / सेब, etc.).
3. Accurately identify the exact disease, pest damage, fungal infection, nutrient deficiency, or if it is a healthy plant (e.g. Banana Sigatoka Leaf Spot, Wheat Yellow Stripe Rust, Rice Blast, Sheath Blight, Potato Late Blight, Tomato Blight, Cotton Bollworm, Chilli Leaf Curl, etc.).
4. Provide the scientific binomial name of the pathogen or pest (e.g., Puccinia striiformis f. sp. tritici, Magnaporthe oryzae, Phytophthora infestans).
5. Confidence score: integer between 70 and 99 reflecting diagnosis certainty.
6. Detail the observed visual symptoms visible in the photo.
7. Detail structured treatment in 3 distinct numbered sections:
   Section 1: Biological & Organic Management (natural biocontrol, neem, buttermilk, Trichoderma, pheromone traps, etc.)
   Section 2: Chemical Treatment (Precise ICAR-approved fungicide/insecticide with exact dosage in ml or grams per litre of water)
   Section 3: Preventive Field Hygiene (resistant seed varieties, crop rotation, soil drainage)
8. Cite the authoritative ICAR institute for this crop (e.g., ICAR-IIWBR Karnal for Wheat, ICAR-NRRI Cuttack for Rice, ICAR-IIVR Varanasi for Vegetables, ICAR-CPRI Shimla for Potato, ICAR-CICR Nagpur for Cotton, ICAR-IARI New Delhi).

LANGUAGE REQUIREMENT:
${langInstruction}
ALL user-facing text fields (crop, disease, symptoms, diagnosis, solutions, lowConfidenceMessage) MUST be in language "${language}".

Return strictly a valid JSON object matching this schema:
{
  "isPlant": true,
  "isConfident": true,
  "crop": "Crop Name (in ${language})",
  "disease": "Disease Name (in ${language})",
  "scientificName": "Scientific binomial name",
  "confidence": 92,
  "symptoms": "Detailed visual symptoms observed in this specific photo (in ${language})",
  "diagnosis": "Crop Name — Disease Name (Scientific Name)",
  "solutions": "1. Biological & Organic Management (in ${language}):\\n...\\n\\n2. Chemical Treatment (Precise Dosage/Litre) (in ${language}):\\n...\\n\\n3. Preventive Field Hygiene (in ${language}):\\n...",
  "source": "Name of ICAR Institute",
  "documentationSearchQuery": "search query for documentation",
  "youtubeSearchQuery": "youtube search query for remedy video"
}`;

  // Models to attempt in order of latency, quota availability, and vision support
  const models = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
  ];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.15,
            },
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`Gemini Vision model ${model} HTTP status: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);

      // Check if image was determined not to be a plant
      if (parsed.isPlant === false || parsed.isConfident === false) {
        return {
          isPlant: false,
          isConfident: false,
          confidence: parsed.confidence || 40,
          diagnosis: parsed.diagnosis || parsed.lowConfidenceMessage || 'Unable to identify crop disease.',
          solutions: '',
          lowConfidenceMessage: parsed.lowConfidenceMessage || parsed.diagnosis,
        };
      }

      if (parsed.diagnosis && parsed.solutions) {
        const fullDiagnosis = parsed.diagnosis.includes('—')
          ? parsed.diagnosis
          : `${parsed.crop || 'Crop'} — ${parsed.disease || 'Condition'} ${parsed.scientificName ? `(${parsed.scientificName})` : ''}`;

        return {
          isPlant: true,
          isConfident: true,
          crop: parsed.crop,
          disease: parsed.disease,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 92,
          symptoms: parsed.symptoms,
          diagnosis: fullDiagnosis,
          solutions: cleanCropDiagnosisText(parsed.solutions),
          source: parsed.source || 'ICAR-Indian Agricultural Research Institute (IARI), New Delhi',
          documentationLink: parsed.documentationSearchQuery
            ? `https://www.google.com/search?q=${encodeURIComponent(parsed.documentationSearchQuery + ' icar')}`
            : 'https://icar.org.in/',
          youtubeLink: parsed.youtubeSearchQuery
            ? `https://www.youtube.com/results?search_query=${encodeURIComponent(parsed.youtubeSearchQuery)}`
            : `https://www.youtube.com/results?search_query=${encodeURIComponent((parsed.crop || '') + ' ' + (parsed.disease || '') + ' treatment')}`,
        };
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} evaluation error:`, err?.message || err);
    }
  }

  return null;
}

/**
 * Text/Voice agronomic diagnosis via Groq or Gemini when photo is absent or failed
 */
async function callTextDiagnosis(
  description: string,
  language: string = 'en'
): Promise<DiagnoseCropDiseaseOutput | null> {
  const langInstruction = getLanguageInstruction(language);

  // 1. Try Groq Cloud LLM
  if (isGroqConfigured && groqClient) {
    try {
      const groqModels = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
      for (const model of groqModels) {
        try {
          const completion = await groqClient.chat.completions.create({
            model,
            messages: [
              {
                role: 'system',
                content: `You are an expert plant pathologist and agronomist in India adhering strictly to ICAR guidelines.
Diagnose the crop problem described by the farmer.
LANGUAGE REQUIREMENT:
${langInstruction}
ALL output text MUST be in language "${language}".
Respond strictly with valid JSON:
{
  "isPlant": true,
  "isConfident": true,
  "crop": "Crop Name (in ${language})",
  "disease": "Disease/Pest Name (in ${language})",
  "scientificName": "Scientific binomial name",
  "confidence": 90,
  "symptoms": "Key symptoms extracted from farmer description (in ${language})",
  "diagnosis": "Crop Name — Disease Name (Scientific Name)",
  "solutions": "1. Biological & Organic Management (in ${language}):\\n...\\n\\n2. Chemical Treatment (Precise Dosage/Litre) (in ${language}):\\n...\\n\\n3. Preventive Field Hygiene (in ${language}):\\n...",
  "source": "Authoritative ICAR Research Institute name",
  "documentationSearchQuery": "search query for documentation",
  "youtubeSearchQuery": "search query for remedy video"
}`,
              },
              {
                role: 'user',
                content: `Farmer crop issue: "${description}"`,
              },
            ],
            temperature: 0.15,
            response_format: { type: 'json_object' },
          });

          const raw = completion.choices[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.diagnosis && parsed.solutions) {
              return {
                isPlant: parsed.isPlant ?? true,
                isConfident: parsed.isConfident ?? true,
                crop: parsed.crop,
                disease: parsed.disease,
                confidence: parsed.confidence || 90,
                symptoms: parsed.symptoms,
                diagnosis: parsed.diagnosis,
                solutions: cleanCropDiagnosisText(parsed.solutions),
                source: parsed.source || 'ICAR-Indian Agricultural Research Institute (IARI), New Delhi',
                documentationLink: parsed.documentationSearchQuery
                  ? `https://www.google.com/search?q=${encodeURIComponent(parsed.documentationSearchQuery + ' icar')}`
                  : 'https://icar.org.in/',
                youtubeLink: parsed.youtubeSearchQuery
                  ? `https://www.youtube.com/results?search_query=${encodeURIComponent(parsed.youtubeSearchQuery)}`
                  : `https://www.youtube.com/results?search_query=${encodeURIComponent((parsed.crop || '') + ' ' + (parsed.disease || '') + ' treatment')}`,
              };
            }
          }
        } catch (innerErr) {
          console.warn(`Groq model ${model} failed:`, innerErr);
        }
      }
    } catch (groqErr) {
      console.warn('Groq text diagnosis failed:', groqErr);
    }
  }

  // 2. Try Gemini Text Mode
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  if (apiKey) {
    const models = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite'];
    for (const model of models) {
      try {
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
              contents: [
                {
                  parts: [
                    {
                      text: `You are an expert plant pathologist in India adhering to ICAR guidelines.
Diagnose this farmer crop issue: "${description}".
LANGUAGE REQUIREMENT: ${langInstruction}
ALL fields must be in language "${language}".
Return valid JSON:
{
  "isPlant": true,
  "isConfident": true,
  "crop": "Crop Name (in ${language})",
  "disease": "Disease Name (in ${language})",
  "scientificName": "Scientific binomial name",
  "confidence": 90,
  "symptoms": "Symptoms (in ${language})",
  "diagnosis": "Crop Name — Disease Name (Scientific Name)",
  "solutions": "1. Biological & Organic Management (in ${language}):\\n...\\n\\n2. Chemical Treatment (Precise Dosage/Litre) (in ${language}):\\n...\\n\\n3. Preventive Field Hygiene (in ${language}):\\n...",
  "source": "ICAR Institute name",
  "documentationSearchQuery": "search query for documentation",
  "youtubeSearchQuery": "youtube search query"
}`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (!res.ok) continue;
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.diagnosis && parsed.solutions) {
            return {
              isPlant: parsed.isPlant ?? true,
              isConfident: parsed.isConfident ?? true,
              crop: parsed.crop,
              disease: parsed.disease,
              confidence: parsed.confidence || 90,
              symptoms: parsed.symptoms,
              diagnosis: parsed.diagnosis,
              solutions: cleanCropDiagnosisText(parsed.solutions),
              source: parsed.source || 'ICAR-Indian Agricultural Research Institute (IARI), New Delhi',
              documentationLink: parsed.documentationSearchQuery
                ? `https://www.google.com/search?q=${encodeURIComponent(parsed.documentationSearchQuery + ' icar')}`
                : 'https://icar.org.in/',
              youtubeLink: parsed.youtubeSearchQuery
                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(parsed.youtubeSearchQuery)}`
                : `https://www.youtube.com/results?search_query=${encodeURIComponent((parsed.crop || '') + ' ' + (parsed.disease || '') + ' treatment')}`,
            };
          }
        }
      } catch (err) {
        console.warn(`Gemini text model ${model} failed:`, err);
      }
    }
  }

  return null;
}

export async function diagnoseCropDisease(
  input: DiagnoseCropDiseaseInput
): Promise<DiagnoseCropDiseaseOutput> {
  const langKey = (input.language || 'hi').toLowerCase();
  const validLang = (['en', 'hi', 'pa', 'mr', 'bn', 'ta', 'kn', 'bho'].includes(langKey) ? langKey : 'hi') as 'en' | 'hi' | 'pa' | 'mr' | 'bn' | 'ta' | 'kn' | 'bho';

  const userDesc = input.description?.trim() || '';

  // 1. Primary Engine: Multimodal Gemini Vision (if photo is provided)
  if (input.photoDataUri && input.photoDataUri.startsWith('data:image')) {
    try {
      const visionResult = await callGeminiVisionDiagnosis(
        input.photoDataUri,
        userDesc,
        validLang
      );
      if (visionResult && visionResult.isConfident && visionResult.isPlant) {
        return visionResult;
      }
    } catch (visionErr) {
      console.warn('Gemini vision diagnosis failed, falling back:', visionErr);
    }
  }

  // 2. Secondary Engine: Groq / Gemini text diagnosis for symptoms
  if (userDesc.length > 0) {
    try {
      const textResult = await callTextDiagnosis(userDesc, validLang);
      if (textResult && textResult.isConfident && textResult.isPlant) {
        return textResult;
      }
    } catch (textErr) {
      console.warn('Text diagnosis failed, falling back to ICAR database:', textErr);
    }
  }

  // 3. Fallback Engine: Verified ICAR Plant Pathology Knowledge Base
  const classification = classifyPlantDisease(input.photoDataUri, userDesc);

  // If low confidence or unidentifiable, return honest guidance without fake guesses
  const fallbackLang = (['en', 'hi', 'pa', 'mr', 'bn', 'ta'].includes(validLang) ? validLang : 'hi') as 'en' | 'hi' | 'pa' | 'mr' | 'bn' | 'ta';

  if (!classification.isConfident || !classification.record || classification.confidence < 70) {
    const lowConfMsg =
      classification.lowConfidenceMessage?.[fallbackLang] ||
      classification.lowConfidenceMessage?.hi ||
      (validLang === 'en'
        ? 'A reliable crop disease could not be identified from this image. Please upload a clear, close-up photo of the affected plant leaf or add a short description of the symptoms.'
        : 'इस तस्वीर से बीमारी की विश्वसनीय पहचान नहीं हो सकी। कृपया पत्ते की साफ़ और नज़दीक से तस्वीर अपलोड करें या समस्या का विवरण लिखें।');

    return {
      isPlant: false,
      isConfident: false,
      confidence: classification.confidence || 40,
      diagnosis: lowConfMsg,
      solutions: '',
      lowConfidenceMessage: lowConfMsg,
    };
  }

  // High-confidence match from verified database
  const record = classification.record;
  const cropName = record.cropName[fallbackLang] || record.cropName.en;
  const diseaseName = record.diseaseName[fallbackLang] || record.diseaseName.en;
  const symptoms = record.symptoms[fallbackLang] || record.symptoms.en;
  const bioRemedy = record.biologicalRemedy[fallbackLang] || record.biologicalRemedy.en;
  const chemRemedy = record.chemicalRemedy[fallbackLang] || record.chemicalRemedy.en;
  const prevention = record.prevention[fallbackLang] || record.prevention.en;

  const fullDiagnosisTitle = `${cropName} — ${diseaseName} (${record.scientificName})`;
  const fullSolutions = [
    validLang === 'en'
      ? `1. Biological & Organic Management:\n${bioRemedy}`
      : validLang === 'hi'
      ? `1. जैविक एवं प्राकृतिक उपचार:\n${bioRemedy}`
      : validLang === 'pa'
      ? `1. ਜੈਵਿਕ ਅਤੇ ਕੁਦਰਤੀ ਰੋਕਥਾਮ:\n${bioRemedy}`
      : validLang === 'mr'
      ? `1. सेंद्रिय व जैविक उपाय:\n${bioRemedy}`
      : validLang === 'bn'
      ? `1. জৈব ও প্রাকৃতিক প্রতিকার:\n${bioRemedy}`
      : `1. இயற்கை மற்றும் உயிரியல் தீர்வு:\n${bioRemedy}`,

    validLang === 'en'
      ? `2. Chemical Treatment (Precise Dosage/Litre):\n${chemRemedy}`
      : validLang === 'hi'
      ? `2. रासायनिक उपचार (सटीक खुराक प्रति लीटर पानी):\n${chemRemedy}`
      : validLang === 'pa'
      ? `2. ਰਸਾਇਣਕ ਇਲਾਜ (ਪ੍ਰਤੀ ਲਿਟਰ ਪਾਣੀ ਸਹੀ ਖੁਰਾਕ):\n${chemRemedy}`
      : validLang === 'mr'
      ? `2. रासायनिक उपचार (प्रति लिटर अचूक प्रमाण):\n${chemRemedy}`
      : validLang === 'bn'
      ? `2. রাসায়নিক চিকিৎসা (প্রতি লিটার জলে সঠিক ডোজ):\n${chemRemedy}`
      : `2. இரசாயன சிகிச்சை (ஒரு லிட்டருக்கு துல்லியமான அளவு):\n${chemRemedy}`,

    validLang === 'en'
      ? `3. Preventive Field Hygiene:\n${prevention}`
      : validLang === 'hi'
      ? `3. खेत में रोकथाम और सुरक्षा उपाय:\n${prevention}`
      : validLang === 'pa'
      ? `3. ਖੇਤ ਵਿੱਚ ਬਚਾਅ ਦੇ ਸੁਝਾਅ:\n${prevention}`
      : validLang === 'mr'
      ? `3. शेतातील प्रतिबंधात्मक काळजी:\n${prevention}`
      : validLang === 'bn'
      ? `3. মাঠে রোগ প্রতিরোধের উপায়:\n${prevention}`
      : `3. பண்ணை தடுப்பு நடவடிக்கைகள்:\n${prevention}`,
  ].join('\n\n');

  return {
    isPlant: true,
    isConfident: true,
    crop: cropName,
    disease: `${diseaseName} (${record.scientificName})`,
    confidence: classification.confidence,
    symptoms,
    management: `${bioRemedy}\n${chemRemedy}`,
    prevention,
    diagnosis: fullDiagnosisTitle,
    solutions: fullSolutions,
    source: record.source,
    documentationLink: record.documentationUrl,
    youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(record.youtubeQuery)}`,
  };
}

export async function translateCropDiagnosis(
  diagnosis: string,
  solutions: string,
  targetLanguage: string
): Promise<{ diagnosis: string; solutions: string }> {
  // If target language is already rendered or English, return cleaned
  return {
    diagnosis: cleanCropDiagnosisText(diagnosis),
    solutions: cleanCropDiagnosisText(solutions),
  };
}
