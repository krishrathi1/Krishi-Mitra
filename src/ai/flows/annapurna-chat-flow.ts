'use server';

/**
 * @fileOverview The main AI flow for the Annapurna chatbot & voice assistant.
 * Powered by high-speed Groq LLM with Gemini Multimodal fallback and rich ICAR agronomic knowledge.
 */

import { z } from 'genkit';
import { callGroqChat, isGroqConfigured, DEFAULT_GROQ_MODEL } from '@/ai/groq';
import { getLanguageInstruction } from '@/lib/soil-data';

const AnnapurnaChatInputSchema = z.object({
  query: z.string().describe("The user's message to the chatbot."),
  language: z.string().describe('The language of the user\'s query (e.g., "en", "hi", "kn", "bn", "bho", "pa", "mr", "ta").'),
});
export type AnnapurnaChatInput = z.infer<typeof AnnapurnaChatInputSchema>;

export type AnnapurnaIntent =
  | 'navigate_dashboard'
  | 'navigate_crop_doctor'
  | 'navigate_soil_analysis'
  | 'navigate_market_analyst'
  | 'navigate_schemes'
  | 'navigate_weather'
  | 'navigate_community'
  | 'navigate_shop'
  | 'navigate_learn'
  | 'navigate_tracker'
  | 'navigate_recommender'
  | 'navigate_profile'
  | 'navigate_settings'
  | 'navigate_fasal_certificate'
  | 'navigate_traceability'
  | 'query_market_prices'
  | 'query_schemes'
  | 'query_crop_recommendation'
  | 'query_soil_analysis'
  | 'general_question'
  | 'form_filling_help'
  | 'unknown';

const AnnapurnaChatOutputSchema = z.object({
  response: z.string().describe("A helpful, factual conversational response to the user's query, in their specified language."),
  intent: z.enum([
    'navigate_dashboard',
    'navigate_crop_doctor',
    'navigate_soil_analysis',
    'navigate_market_analyst',
    'navigate_schemes',
    'navigate_weather',
    'navigate_community',
    'navigate_shop',
    'navigate_learn',
    'navigate_tracker',
    'navigate_recommender',
    'navigate_profile',
    'navigate_settings',
    'navigate_fasal_certificate',
    'navigate_traceability',
    'query_market_prices',
    'query_schemes',
    'query_crop_recommendation',
    'query_soil_analysis',
    'general_question',
    'form_filling_help',
    'unknown',
  ]).describe("The user's primary goal or intent."),
  entities: z.object({
    crop: z.string().optional(),
    city: z.string().optional(),
    topic: z.string().optional(),
  }).optional(),
});
export type AnnapurnaChatOutput = z.infer<typeof AnnapurnaChatOutputSchema>;

const SYSTEM_PROMPT = `You are Annapurna, an empathetic, highly knowledgeable Chief AI Agricultural Assistant for Krishi Mitra (an Indian Farmer Operating System).
Your mission is to understand what the farmer is asking and provide a factual, concrete, practical answer tailored to Indian agriculture.

CRITICAL INSTRUCTIONS:
1. NEVER give a generic "Please send a photo" or vague static answer unless the user specifically asks how to diagnose an unknown leaf photo!
2. If the user asks about MARKET PRICES / MANDI RATES (e.g. Wheat, Paddy, Mustard, Cotton, Soybean):
   - Provide realistic current Indian APMC modal price ranges (e.g., Wheat ₹2,450-₹2,650/qtl, Mustard ₹5,400-₹5,700/qtl, Basmati Paddy ₹3,600-₹4,200/qtl, Soybean ₹4,600-₹4,850/qtl).
   - Inform them they can check exact district-wise live APMC modal prices in the Market Analyst section.
3. If the user asks about CROP DISEASES / PESTS (e.g. yellow spots, blast, leaf curl, blight):
   - Explain the likely cause (e.g., fungal infection, nitrogen deficiency, rust).
   - Recommend ICAR-approved organic management (Neem oil 1500ppm, Trichoderma) and chemical remedy (e.g., Propiconazole 1ml/L or Mancozeb 2g/L).
   - Remind them that they can take a leaf photo in Crop Doctor for instant automated visual diagnosis.
4. If the user asks about SOIL TESTING / SOIL TYPE / WHICH CROPS TO GROW:
   - Explain that they can upload a photo of their farm dirt in the "Soil Doctor & Crops" feature (/dashboard/soil-analysis) to detect soil type (Black, Alluvial, Red, Sandy), pH, and recommended crops.
5. If the user asks about GOVERNMENT SCHEMES / PM-KISAN / SUBSIDIES:
   - Provide clear guidelines: PM-Kisan provides ₹6,000 yearly in 3 DBT installments of ₹2,000 every 4 months; requirements include Aadhaar eKYC and land record verification. Mention PMFBY for crop insurance and KCC for low-interest loans.
6. If the user asks about WEATHER / RAIN:
   - Explain temperature trends and advise on pesticide/fertilizer spraying timing (avoid spraying within 4-6 hours before rainfall).
7. If the user asks about SEEDS or FERTILIZERS:
   - Mention certified high-yield seeds (HD-3086, Basmati 1121, Pioneer) and subsidized Urea/DAP, Vermicompost in the Agri Shop (/dashboard/shop).

LANGUAGE REQUIREMENT:
{{language_instruction}}
ALL response text MUST strictly be in the user's requested language. Never mix words from other languages.

Output strictly valid JSON:
{
  "response": "<informative, clear, conversational 2-4 sentence answer in requested language>",
  "intent": "<one of the intents listed above>",
  "entities": {
    "crop": "<crop name if any or null>",
    "city": "<city/district if any or null>",
    "topic": "<topic if any or null>"
  }
}`;

/**
 * Direct Gemini REST Call as robust Tier 2
 */
async function callGeminiChat(query: string, language: string): Promise<AnnapurnaChatOutput | null> {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  if (!apiKey || apiKey.trim().length === 0) return null;

  const langInstruction = getLanguageInstruction(language);
  const prompt = SYSTEM_PROMPT.replace('{{language_instruction}}', langInstruction);

  const models = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.25,
            },
            contents: [
              {
                parts: [
                  { text: `${prompt}\n\nUser Question: "${query}"` },
                ],
              },
            ],
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      if (parsed.response && parsed.response.trim().length > 0) {
        return {
          response: parsed.response,
          intent: (parsed.intent as AnnapurnaIntent) || 'general_question',
          entities: parsed.entities || {},
        };
      }
    } catch (e: any) {
      console.warn(`Gemini assistant ${model} error:`, e?.message || e);
    }
  }

  return null;
}

/**
 * Execute Annapurna chat using Groq first, with Gemini and smart knowledge base fallback
 */
export async function annapurnaChat(input: AnnapurnaChatInput): Promise<AnnapurnaChatOutput> {
  const { query, language } = input;
  const safeLang = (['en', 'hi', 'pa', 'mr', 'bn', 'ta', 'kn', 'bho'].includes(language) ? language : 'hi');

  // 1. Try Groq Cloud LLM
  if (isGroqConfigured) {
    try {
      const groqResponse = await callGroqChat({
        model: DEFAULT_GROQ_MODEL,
        temperature: 0.25,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT.replace('{{language_instruction}}', getLanguageInstruction(safeLang)),
          },
          {
            role: 'user',
            content: query,
          },
        ],
      });

      const parsed = JSON.parse(groqResponse);
      if (parsed.response && parsed.response.trim().length > 0) {
        return {
          response: parsed.response,
          intent: (parsed.intent as AnnapurnaIntent) || 'general_question',
          entities: parsed.entities || {},
        };
      }
    } catch (groqErr) {
      console.warn('Groq assistant call failed, falling back to Gemini:', groqErr);
    }
  }

  // 2. Try Gemini REST API
  try {
    const geminiResult = await callGeminiChat(query, safeLang);
    if (geminiResult) {
      return geminiResult;
    }
  } catch (geminiErr) {
    console.warn('Gemini chat call failed, falling back to knowledge base:', geminiErr);
  }

  // 3. Smart agricultural knowledge base fallback (Specific, accurate answers for every topic!)
  return getSmartKnowledgeBaseResponse(query, safeLang);
}

/**
 * Comprehensive Knowledge Base covering all core agricultural questions
 */
function getSmartKnowledgeBaseResponse(query: string, language: string): AnnapurnaChatOutput {
  const q = query.toLowerCase();

  // 1. WHEAT / GRAIN MANDI PRICES
  if (q.includes('gehun') || q.includes('गेहूं') || q.includes('wheat') || (q.includes('mandi') && (q.includes('bhav') || q.includes('price') || q.includes('rate')))) {
    const responses: Record<string, string> = {
      en: "Today's modal mandi price for Wheat across major APMC markets is ₹2,450 to ₹2,680 per quintal depending on quality and moisture. You can check your exact district and mandi rate in the Market Analyst section.",
      hi: "आज प्रमुख मंडियों में गेहूं का मॉडल भाव ₹2,450 से ₹2,680 प्रति क्विंटल के बीच चल रहा है। आप अपने जिले और स्थानीय मंडी का सटीक भाव देखने के लिए 'बाजार विश्लेषक' सेक्शन देख सकते हैं।",
      pa: "ਅੱਜ ਮੰਡੀਆਂ ਵਿੱਚ ਕਣਕ ਦਾ ਤਾਜ਼ਾ ਭਾਅ ₹2,450 ਤੋਂ ₹2,680 ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਦੇ ਵਿਚਕਾਰ ਹੈ। ਤੁਸੀਂ ਆਪਣੇ ਇਲਾਕੇ ਦਾ ਸਹੀ ਰੇਟ ਮਾਰਕੀਟ ਵਿਸ਼ਲੇਸ਼ਕ ਵਿੱਚ ਦੇਖ ਸਕਦੇ ਹੋ।",
      mr: "आज प्रमुख बाजार समित्यांमध्ये गव्हाचा दर ₹2,450 ते ₹2,680 प्रति क्विंटल दरम्यान आहे. तुम्ही तुमच्या भागातील अचूक दर बाजार विश्लेषक विभागात पाहू शकता.",
      bn: "আজকের প্রধান মান্ডিগুলোতে গমের দর প্রতি কুইন্টাল ₹২,৪৫০ থেকে ₹২,৬৮০ পর্যন্ত চলছে। আপনি আপনার স্থানীয় মান্ডির সঠিক দাম মার্কেট অ্যানালিস্টে দেখতে পারেন।",
      ta: "இன்று முக்கிய சந்தைகளில் கோதுமையின் விலை குவிண்டாலுக்கு ₹2,450 முதல் ₹2,680 வரை உள்ளது. உங்கள் பகுதி விலையை சந்தை ஆய்வாளர் பகுதியில் பார்க்கலாம்.",
      kn: "ಇಂದಿನ ಪ್ರಮುಖ ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ ಗೋಧಿ ಬೆಲೆ ಕ್ವಿಂಟಾಲ್‌ಗೆ ₹2,450 ರಿಂದ ₹2,680 ವರೆಗೆ ಇದೆ. ಮಾರುಕಟ್ಟೆ ವಿಶ್ಲೇಷಕದಲ್ಲಿ ನಿಮ್ಮ ಪ್ರದೇಶದ ಬೆಲೆಯನ್ನು ಪರಿಶೀಲಿಸಬಹುದು.",
      bho: "आज के प्रमुख मंडी में गेहूं के भाव ₹2,450 से ₹2,680 प्रति क्विंटल चल रहल बा। रउआ आपन जिला के भाव बाजार विश्लेषक में देख सकीं।",
    };
    return {
      response: responses[language] || responses.hi,
      intent: 'query_market_prices',
      entities: { crop: 'wheat', topic: 'mandi_price' },
    };
  }

  // 2. YELLOW LEAF SPOTS / CROP DISEASES
  if (q.includes('yellow') || q.includes('peele') || q.includes('पीले') || q.includes('patte') || q.includes('पत्ता') || q.includes('leaf') || q.includes('spot') || q.includes('dhabb') || q.includes('धब्बे') || q.includes('disease') || q.includes('bimari') || q.includes('रोग')) {
    const responses: Record<string, string> = {
      en: "Yellow spots or leaf yellowing are typically caused by fungal infections (like rust or blight) or nitrogen/zinc deficiency. For fungal spots, spray Propiconazole (1 ml/L water) or Mancozeb (2 g/L). For nutritional yellowing, spray 2% Urea or Zinc Sulphate. You can also upload a photo in 'Crop Doctor' for instant leaf analysis.",
      hi: "पत्तों पर पीले धब्बे फफूंद (जैसे रस्ट या ब्लाइट) या नाइट्रोजन/जिंक की कमी से होते हैं। फफूंद के लिए प्रोपिकोनाजोल (1 मिली/लीटर) या मैंकोजेब (2 ग्राम/लीटर) का छिड़काव करें। पोषण की कमी के लिए 2% यूरिया या जिंक का छिड़काव करें। सटीक जांच के लिए आप 'फसल डॉक्टर' में पत्ते की फोटो अपलोड कर सकते हैं।",
      pa: "ਪੱਤਿਆਂ 'ਤੇ ਪੀਲੇ ਧੱਬੇ ਉੱਲੀ (ਰਸਟ/ਬਲਾਈਟ) ਜਾਂ ਨਾਈਟ੍ਰੋਜਨ ਦੀ ਕਮੀ ਕਾਰਨ ਹੁੰਦੇ ਹਨ। ਉੱਲੀ ਲਈ ਪ੍ਰੋਪੀਕੋਨਾਜ਼ੋਲ (1 ਮਿਲੀ/ਲਿਟਰ) ਦਾ ਛਿੜਕਾਅ ਕਰੋ। ਸਹੀ ਜਾਂਚ ਲਈ ਤੁਸੀਂ 'ਫ਼ਸਲ ਡਾਕਟਰ' ਵਿੱਚ ਫੋਟੋ ਅਪਲੋਡ ਕਰ ਸਕਦੇ ਹੋ।",
      mr: "पानावरील पिवळे डाग बुरशीजन्य रोग किंवा नायट्रोजन/झिंकच्या कमतरतेमुळे होतात. बुरशीसाठी प्रोपिकोनाझोल (1 मिली/लिटर) फवारा. अचूक निदानासाठी 'पीक डॉक्टर' मध्ये पानाचा फोटो अपलोड करा.",
      bn: "পাতায় হলুদ দাগ ছত্রাক বা পুষ্টির ঘাটতির কারণে হয়। ছত্রাকের জন্য প্রোপিকোনাজোল (১ মিলি/লিটার) স্প্রে করুন। বিস্তারিত জানতে 'ফসল ডাক্তার'-এ পাতার ছবি আপলোড করুন।",
      ta: "இலைகளில் மஞ்சள் புள்ளிகள் பூஞ்சை அல்லது துத்தநாகக் குறைபாட்டால் ஏற்படுகின்றன. பூஞ்சைக்கு புரோபிகோனசோல் (1 மி.லி/லிட்டர்) தெளிக்கவும். பயிர் மருத்துவரில் புகைப்படம் பதிவேற்றி முழு விவரம் பெறலாம்.",
      kn: "ಎಲೆಗಳ ಮೇಲೆ ಹಳದಿ ಚುಕ್ಕೆಗಳು ಶಿಲೀಂಧ್ರ ಅಥವಾ ಪೋಷಕಾಂಶಗಳ ಕೊರತೆಯಿಂದ ಉಂಟಾಗುತ್ತವೆ. ಪ್ರೊಪಿಕೊನಜೋಲ್ (1 ಮಿಲಿ/ಲೀಟರ್) ಸಿಂಪಡಿಸಿ. ನಿಖರ ತಪಾಸಣೆಗಾಗಿ 'ಬೆಳೆ ವೈದ್ಯ'ದಲ್ಲಿ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
      bho: "पत्ता पर पीयर धब्बा फफूंद भा नाइट्रोजन के कमी से होला। फफूंद खातिर प्रोपिकोनाजोल (1 मिली/लीटर) छिड़कें। पूरा जांच खातिर 'फसल डॉक्टर' में पत्ता के फोटो अपलोड करीं।",
    };
    return {
      response: responses[language] || responses.hi,
      intent: 'navigate_crop_doctor',
      entities: { topic: 'crop_disease' },
    };
  }

  // 3. PM KISAN / SCHEMES
  if (q.includes('pm kisan') || q.includes('pm-kisan') || q.includes('पीएम किसान') || q.includes('yojana') || q.includes('योजना') || q.includes('scheme') || q.includes('6000') || q.includes('subsidy') || q.includes('सब्सिडी')) {
    const responses: Record<string, string> = {
      en: "Under PM-KISAN, eligible landholding farmer families receive ₹6,000 annually in 3 equal installments of ₹2,000 directly into their bank accounts via DBT. Make sure your Aadhaar eKYC and land seeding are completed. You can verify your eligibility and check status in 'Govt Schemes'.",
      hi: "पीएम-किसान योजना के तहत पात्र किसान परिवारों को प्रति वर्ष ₹6,000 की आर्थिक सहायता 3 बराबर किश्तों (₹2,000 हर 4 महीने में) में सीधे बैंक खाते में मिलती है। इसके लिए आधार eKYC और भूमि रिकॉर्ड का सत्यापन अनिवार्य है। आप 'सरकारी योजनाएं' सेक्शन में अपनी पात्रता जांच सकते हैं।",
      pa: "ਪੀਐਮ-ਕਿਸਾਨ ਯੋਜਨਾ ਤਹਿਤ ਕਿਸਾਨਾਂ ਨੂੰ ਸਾਲਾਨਾ ₹6,000 ਤਿੰਨ ਕਿਸ਼ਤਾਂ (₹2,000) ਵਿੱਚ ਸਿੱਧੇ ਬੈਂਕ ਖਾਤੇ ਵਿੱਚ ਮਿਲਦੇ ਹਨ। ਆਧਾਰ eKYC ਲਾਜ਼ਮੀ ਹੈ। ਪੂਰੀ ਜਾਣਕਾਰੀ ਲਈ ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਸੈਕਸ਼ਨ ਦੇਖੋ।",
      mr: "पीएम-किसान योजनेअंतर्गत पात्र शेतकरी कुटुंबांना वर्षाला ₹6,000 थेट बँक खात्यात 3 हप्त्यांमध्ये (₹2,000) मिळतात. आधार eKYC पूर्ण असणे आवश्यक आहे. अधिक माहिती 'सरकारी योजना' विभागात पहा.",
      bn: "পিএম-কিসান প্রকল্পের আওতায় যোগ্য কৃষকরা বছরে ৩টি কিস্তিতে মোট ₹৬,০০০ সরাসরি ব্যাংক অ্যাকাউন্টে পান। আধার eKYC সম্পূর্ণ থাকা প্রয়োজন। সরকারি প্রকল্প বিভাগে বিস্তারিত জানুন।",
      ta: "பிஎம்-கிசான் திட்டத்தின் கீழ் தகுதியான விவசாயிகளுக்கு ஆண்டுதோறும் ₹6,000 மூன்று தவணைகளில் (₹2,000) வங்கிக் கணக்கில் நேரடியாக வழங்கப்படுகிறது. ஆதார் eKYC அவசியம்.",
      kn: "ಪಿಎಂ-ಕಿಸಾನ್ ಯೋಜನೆಯಡಿ ಅರ್ಹ ರೈತರಿಗೆ ವಾರ್ಷಿಕವಾಗಿ ₹6,000 (3 ಕಂತುಗಳಲ್ಲಿ ₹2,000) ನೇರವಾಗಿ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಜಮೆಯಾಗುತ್ತದೆ. ಆಧಾರ್ eKYC ಕಡ್ಡಾಯವಾಗಿದೆ.",
      bho: "पीएम-किसान योजना के तहत किसानन के साल भर में ₹6,000 तीन किस्त में ₹2,000 सीधे बैंक में मिलेला। आधार eKYC जरूरी बा। सरकारी योजना सेक्शन में पूरा जानकारी देख सकीं।",
    };
    return {
      response: responses[language] || responses.hi,
      intent: 'navigate_schemes',
      entities: { topic: 'pm_kisan' },
    };
  }

  // 4. WEATHER / RAIN / SPRAYING
  if (q.includes('rain') || q.includes('barish') || q.includes('बारिश') || q.includes('weather') || q.includes('mausam') || q.includes('मौसम') || q.includes('spray') || q.includes('छिड़काव')) {
    const responses: Record<string, string> = {
      en: "For effective pesticide or fertilizer spraying, choose clear sunny weather and ensure there is no rainfall forecasted for at least 4 to 6 hours after application to avoid chemical wash-off. Check your localized 7-day rainfall forecast in the 'Weather' section.",
      hi: "कीटनाशक या खाद का छिड़काव करने के लिए शांत और धूप वाला मौसम सबसे अच्छा होता है। ध्यान रखें कि छिड़काव के बाद कम से कम 4-6 घंटे बारिश न हो ताकि दवा बह न जाए। आप अपने क्षेत्र का 7 दिनों का मौसम पूर्वानुमान 'मौसम' सेक्शन में देख सकते हैं।",
      pa: "ਸਪਰੇਅ ਕਰਨ ਲਈ ਸਾਫ਼ ਮੌਸਮ ਚੁਣੋ ਅਤੇ ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਸਪਰੇਅ ਤੋਂ ਬਾਅਦ 4-6 ਘੰਟੇ ਮੀਂਹ ਨਾ ਪਵੇ। ਤੁਸੀਂ ਆਪਣੇ ਇਲਾਕੇ ਦਾ 7 ਦਿਨਾਂ ਦਾ ਮੌਸਮ 'ਮੌਸਮ' ਸੈਕਸ਼ਨ ਵਿੱਚ ਦੇਖ ਸਕਦੇ ਹੋ।",
      mr: "फवारणीसाठी निरभ्र व शांत हवामान निवडा आणि फवारणीनंतर किमान 4-6 तास पाऊस पडणार नाही याची खात्री करा. 7 दिवसांचा हवामान अंदाज 'हवामान' विभागात पहा.",
      bn: "কীটনাশক স্প্রে করার জন্য পরিষ্কার রোদযুক্ত আবহাওয়া বেছে নিন এবং স্প্রে করার পর কমপক্ষে ৪-৬ ঘণ্টা যেন বৃষ্টি না হয়। আবহাওয়া বিভাগে ৭ দিনের পূর্বাভাস দেখুন।",
      ta: "மருந்து தெளிப்பதற்கு தெளிவான வானிலையைத் தேர்ந்தெடுக்கவும். தெளித்த பிறகு 4-6 மணி நேரத்திற்கு மழை பெய்யாமல் இருப்பது அவசியம். வானிலை பிரிவில் 7 நாள் முன்னறிவிப்பைப் பார்க்கலாம்.",
      kn: "ಕೀಟನಾಶಕ ಸಿಂಪಡಣೆಗೆ ಸ್ಪಷ್ಟ ಬಿಸಿಲಿನ ವಾತಾವರಣ ಸೂಕ್ತ. ಸಿಂಪಡಿಸಿದ ನಂತರ 4-6 ಗಂಟೆಗಳ ಕಾಲ ಮಳೆ ಬಾರದಂತೆ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ. 'ಹವಾಮಾನ' ವಿಭಾಗದಲ್ಲಿ ವರದಿ ನೋಡಿ.",
      bho: "दवा छिड़के खातिर साफ घाम वाला मौसम चुनीं आ धियान रहे कि छिड़काव के 4-6 घंटा बाद ले पानी ना बरसे। आपन इलाका के मौसम 'मौसम' सेक्शन में देख सकीं।",
    };
    return {
      response: responses[language] || responses.hi,
      intent: 'navigate_weather',
      entities: { topic: 'weather_spraying' },
    };
  }

  // 5. SOIL ANALYSIS / SOIL TESTING
  if (q.includes('soil') || q.includes('mitti') || q.includes('मिट्टी') || q.includes('माटी') || q.includes('fertil') || q.includes('खाद') || q.includes('ph')) {
    const responses: Record<string, string> = {
      en: "You can upload a photo of your field soil in our new 'Soil Doctor & Crops' feature (/dashboard/soil-analysis). AI will immediately detect your soil type (Black, Alluvial, Red, Sandy), estimated pH, and recommend the most profitable crops to grow.",
      hi: "आप हमारे नए 'मिट्टी परीक्षण व फसलें' फीचर (/dashboard/soil-analysis) में अपने खेत की मिट्टी की फोटो अपलोड कर सकते हैं। AI तुरंत आपकी मिट्टी का प्रकार (काली, दोमट, लाल, रेतीली), pH मान और उसमें उगाई जाने वाली सर्वोत्तम फसलें बताएगा।",
      pa: "ਤੁਸੀਂ ਸਾਡੇ ਨਵੇਂ 'ਮਿੱਟੀ ਡਾਕਟਰ' ਫੀਚਰ (/dashboard/soil-analysis) ਵਿੱਚ ਆਪਣੇ ਖੇਤ ਦੀ ਮਿੱਟੀ ਦੀ ਫੋਟੋ ਅਪਲੋਡ ਕਰਕੇ ਮਿੱਟੀ ਦੀ ਕਿਸਮ ਅਤੇ ਸਭ ਤੋਂ ਵਧੀਆ ਫ਼ਸਲਾਂ ਜਾਣ ਸਕਦੇ ਹੋ।",
      mr: "तुम्ही आमच्या नवीन 'माती परीक्षण व पिके' फीचरमध्ये शेतातील मातीचा फोटो अपलोड करून मातीचा प्रकार, pH आणि योग्य पिकांची माहिती मिळवू शकता.",
      bn: "আপনি আমাদের নতুন 'মাটি পরীক্ষা ও ফসল' ফিচারে আপনার জমির মাটির ছবি আপলোড করে মাটির ধরন, পিএইচ এবং উপযুক্ত ফসল জানতে পারেন।",
      ta: "எங்கள் புதிய 'மண் மருத்துவர்' பகுதியில் உங்கள் வயல் மண்ணின் புகைப்படத்தைப் பதிவேற்றி மண் வகை, pH மற்றும் சிறந்த பயிர்களை அறியலாம்.",
      kn: "ನಮ್ಮ ಹೊಸ 'ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ ಮತ್ತು ಬೆಳೆಗಳು' ವೈಶಿಷ್ಟ್ಯದಲ್ಲಿ ನಿಮ್ಮ ಜಮೀನಿನ ಮಣ್ಣಿನ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಸೂಕ್ತ ಬೆಳೆಗಳನ್ನು ತಿಳಿಯಿರಿ.",
      bho: "रउआ हमनी के नया 'माटी परीक्षण आ फसल' फीचर में खेत के माटी के फोटो अपलोड क के माटी के प्रकार, pH आ उत्तम फसल जान सकीं।",
    };
    return {
      response: responses[language] || responses.hi,
      intent: 'navigate_soil_analysis',
      entities: { topic: 'soil_testing' },
    };
  }

  // 6. SEEDS / FERTILIZERS / SHOP
  if (q.includes('seed') || q.includes('beej') || q.includes('बीज') || q.includes('khad') || q.includes('खाद') || q.includes('urea') || q.includes('यूरिया') || q.includes('dap') || q.includes('shop') || q.includes('store') || q.includes('दुकान')) {
    const responses: Record<string, string> = {
      en: "In our Agri Shop (/dashboard/shop), you can browse certified seeds (Wheat HD-3086, Basmati 1121, Pioneer Mustard), government-subsidized fertilizers (Neem Coated Urea ₹266, DAP ₹1,350, Nano Urea ₹225), organic vermicompost, and farm machinery with direct dealer contacts.",
      hi: "हमारे कृषि स्टोर (/dashboard/shop) में आप प्रमाणित बीज (गेहूं HD-3086, बासमती 1121, सरसों), सरकारी रियायती खाद (नीम कोटेड यूरिया ₹266, डीएपी ₹1,350, नैनो यूरिया ₹225), केंचुआ खाद और कृषि यंत्र सीधे प्रमाणित डीलरों से प्राप्त कर सकते हैं।",
      pa: "ਸਾਡੇ ਖੇਤੀ ਸਟੋਰ ਵਿੱਚ ਤੁਸੀਂ ਪ੍ਰਮਾਣਿਤ ਬੀਜ, ਸਬਸਿਡੀ ਵਾਲੀ ਖਾਦ (ਯੂਰੀਆ ₹266, ਡੀਏਪੀ ₹1,350) ਅਤੇ ਖੇਤੀ ਮਸ਼ੀਨਰੀ ਡੀਲਰਾਂ ਤੋਂ ਪ੍ਰਾਪਤ ਕਰ ਸਕਦੇ ਹੋ।",
      mr: "आमच्या कृषी स्टोअरमध्ये प्रमाणित बियाणे, अनुदानित खते (युरिया ₹266, डीएपी ₹1,350, नॅनो युरिया) आणि शेती अवजारे थेट अधिकृत विक्रेत्यांकडून मिळवू शकता.",
      bn: "আমাদের কৃষি স্টোরে আপনি প্রত্যয়িত বীজ, সরকারি ভর্তুকিযুক্ত সার (ইউরিয়া ₹২৬৬, ডিএপি ₹১,৩৫০) এবং কৃষি যন্ত্রপাতি সরাসরি ডিলারদের কাছ থেকে পেতে পারেন।",
      ta: "எங்கள் வேளாண்மை கடையில் சான்றளிக்கப்பட்ட விதைகள், மானிய உரங்கள் (யூரியா ₹266, டிஏபி ₹1,350) மற்றும் வேளாண் கருவிகளை நேரடியாக டீலர்களிடமிருந்து பெறலாம்.",
      kn: "ನಮ್ಮ ಕೃಷಿ ಮಳಿಗೆಯಲ್ಲಿ ಪ್ರಮಾಣೀಕೃತ ಬೀಜಗಳು, ಸಬ್ಸಿಡಿ ರಸಗೊಬ್ಬರಗಳು (ಯೂರಿಯಾ ₹266, ಡಿಎಪಿ ₹1,350) ಮತ್ತು ಕೃಷಿ ಯಂತ್ರೋಪಕರಣಗಳನ್ನು ಪಡೆಯಬಹುದು.",
      bho: "हमनी के कृषि स्टोर में रउआ प्रमाणित बीज, सरकारी सब्सिडी वाला खाद (यूरिया ₹266, डीएपी ₹1,350) आ कृषि यंत्र सीधे डीलर से ले सकीं।",
    };
    return {
      response: responses[language] || responses.hi,
      intent: 'navigate_shop',
      entities: { topic: 'agri_shop' },
    };
  }

  // DEFAULT / GENERAL ASSISTANCE
  const defaultResponses: Record<string, string> = {
    en: "Namaste! I am Annapurna, your AI farming partner. I can help you with live mandi prices, crop disease remedies, soil testing, weather advisories, certified seeds, and government schemes. How may I assist your farm today?",
    hi: "नमस्ते! मैं अन्नपूर्णा, आपकी AI कृषि सहायक हूँ। मैं आपको आज के ताज़ा मंडी भाव, फसल बीमारी की रोकथाम, मिट्टी परीक्षण, मौसम की सलाह, प्रमाणित बीज और सरकारी योजनाओं की सटीक जानकारी दे सकती हूँ। आज मैं आपकी क्या सहायता करूँ?",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਅੰਨਪੂਰਣਾ, ਤੁਹਾਡੀ AI ਖੇਤੀ ਸਾਥੀ ਹਾਂ। ਮੈਂ ਮੰਡੀ ਭਾਅ, ਫ਼ਸਲ ਬਿਮਾਰੀਆਂ, ਮਿੱਟੀ ਪਰਖ, ਮੌਸਮ ਅਤੇ ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਬਾਰੇ ਸਹੀ ਜਾਣਕਾਰੀ ਦੇ ਸਕਦੀ ਹਾਂ।",
    mr: "नमस्कार! मी अन्नपूर्णा, तुमची AI शेती सहाय्यक. मी तुम्हाला बाजार भाव, पीक रोग नियंत्रण, माती परीक्षण, हवामान आणि सरकारी योजनांबद्दल मार्गदर्शन करू शकते.",
    bn: "নমস্কার! আমি অন্নপূর্ণা, আপনার এআই কৃষি সহকারী। আমি মান্ডি দর, ফসলের রোগ প্রতিকার, মাটি পরীক্ষা, আবহাওয়া ও সরকারি প্রকল্পের সঠিক তথ্য দিতে পারি।",
    ta: "வணக்கம்! நான் அன்னபூர்ணா, உங்கள் AI வேளாண் உதவியாளர். சந்தை விலைகள், பயிர் நோய் தீர்வுகள், மண் பரிசோதனை, வானிலை மற்றும் அரசு திட்டங்கள் குறித்து உதவ முடியும்.",
    kn: "ನಮಸ್ಕಾರ! ನಾನು ಅನ್ನಪೂರ್ಣ, ನಿಮ್ಮ AI ಕೃಷಿ ಸಹಾಯಕ. ಮಾರುಕಟ್ಟೆ ಬೆಲೆ, ಬೆಳೆ ರೋಗಗಳು, ಮಣ್ಣಿನ ಪರೀಕ್ಷೆ, ಹವಾಮಾನ ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಿಖರ ಮಾಹಿತಿ ನೀಡಬಲ್ಲೆ.",
    bho: "प्रणाम! हम अन्नपूर्णा, रउआ AI खेती साथी। हम ताजा मंडी भाव, फसल के बेमारी, माटी परीक्षण, मौसम आ सरकारी योजना के सटीक जानकारी दे सकीं। बताईं आज का मदद करीं?",
  };

  return {
    response: defaultResponses[language] || defaultResponses.hi,
    intent: 'general_question',
    entities: {},
  };
}
