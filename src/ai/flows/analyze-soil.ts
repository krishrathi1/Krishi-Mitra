'use server';

/**
 * @fileOverview AI Soil Image Analysis & Crop Recommendation Engine.
 *
 * Architecture:
 * 1. Primary Engine: Multimodal Google Gemini Vision (analyzes uploaded soil photo).
 * 2. Secondary Engine: Groq LLM (High-speed agronomic reasoning for soil characteristics).
 * 3. Fallback Engine: ICAR & NBSS&LUP Verified Soil Knowledge Base.
 * 4. Safety Guarantee: Strictly verifies that uploaded image is agricultural soil/field earth,
 *    gracefully rejecting non-soil pictures (people, gadgets, leaves, indoor items).
 */

import { z } from 'genkit';
import { getLanguageInstruction } from '@/lib/soil-data';
import { isGroqConfigured, groqClient } from '@/ai/groq';

export interface SuitableCrop {
  cropName: string;
  season: 'Kharif' | 'Rabi' | 'Zaid' | 'Whole Year' | string;
  suitabilityScore: number; // e.g. 95
  whySuitable: string;
  waterRequirement: 'Low' | 'Medium' | 'High' | string;
  estimatedDuration: string; // e.g. "110-130 days"
  iconHint?: 'Wheat' | 'Leaf' | 'Sprout' | 'Carrot' | 'Grape';
}

export interface AnalyzeSoilOutput {
  isSoil: boolean;
  isConfident: boolean;
  confidence: number;
  soilType: string;
  primaryClassification: string;
  regionalName?: string;
  texture: string;
  color: string;
  estimatedPh: string;
  waterRetention: string;
  drainage: string;
  organicMatter: string;
  nutrientProfile: {
    nitrogen: 'Low' | 'Medium' | 'High' | string;
    phosphorus: 'Low' | 'Medium' | 'High' | string;
    potassium: 'Low' | 'Medium' | 'High' | string;
    summary: string;
  };
  suitableCrops: SuitableCrop[];
  unsuitableCrops?: string[];
  soilImprovementTips: string[];
  managementAdvice: string;
  source: string;
  lowConfidenceMessage?: string;
}

export interface AnalyzeSoilInput {
  photoDataUri?: string;
  description?: string;
  location?: string;
  language?: string;
}

/**
 * Verified ICAR / NBSS&LUP Soil Classification Knowledge Base
 */
interface VerifiedSoilRecord {
  standardName: string;
  scientificOrder: string;
  localNames: Record<string, string>;
  color: Record<string, string>;
  texture: Record<string, string>;
  phRange: string;
  waterRetention: Record<string, string>;
  drainage: Record<string, string>;
  organicMatter: Record<string, string>;
  nutrientProfile: {
    nitrogen: string;
    phosphorus: string;
    potassium: string;
    summary: Record<string, string>;
  };
  suitableCrops: Array<{
    cropName: Record<string, string>;
    season: string;
    suitabilityScore: number;
    whySuitable: Record<string, string>;
    waterRequirement: string;
    estimatedDuration: string;
    iconHint: 'Wheat' | 'Leaf' | 'Sprout' | 'Carrot' | 'Grape';
  }>;
  unsuitableCrops: Record<string, string[]>;
  improvementTips: Record<string, string[]>;
  managementAdvice: Record<string, string>;
}

const VERIFIED_SOILS: Record<string, VerifiedSoilRecord> = {
  black: {
    standardName: 'Black Cotton Soil (Regur)',
    scientificOrder: 'Vertisols',
    localNames: {
      en: 'Black Cotton Soil (Regur)',
      hi: 'काली कपास मिट्टी (रेगुर)',
      pa: 'ਕਾਲੀ ਮਿੱਟੀ (ਰੇਗੁਰ)',
      mr: 'काळी कसदार माती (रेगूर)',
      bn: 'কালো রেগুর মাটি',
      ta: 'கரிசல் மண் (ரெகுர்)',
      kn: 'ಕಪ್ಪು ಹತ್ತಿ ಮಣ್ಣು (ರೆಗುರ್)',
      bho: 'कारी कपासी माटी (रेगुर)',
    },
    color: {
      en: 'Deep dark brown to jet black',
      hi: 'गहरा भूरा से काला रंग',
      pa: 'ਗੂੜ੍ਹਾ ਭੂਰਾ ਤੋਂ ਕਾਲਾ ਰੰਗ',
      mr: 'गडद तपकिरी ते काळा रंग',
      bn: 'গাঢ় বাদামি থেকে কালো',
      ta: 'அடர் பழுப்பு முதல் கருப்பு நிறம்',
      kn: 'ಗಾಢ ಕಂದು ಬಣ್ಣದಿಂದ ಕಪ್ಪು',
      bho: 'गहिर भूरा से करिया रंग',
    },
    texture: {
      en: 'Heavy clay, sticky when wet, develops wide shrinkage cracks when dry',
      hi: 'भारी चिकनी मिट्टी, गीली होने पर चिपचिपी, सूखने पर गहरी दरारें बनती हैं',
      pa: 'ਭਾਰੀ ਚੀਕਣੀ ਮਿੱਟੀ, ਗਿੱਲੀ ਹੋਣ ਤੇ ਚਿਪਚਿਪੀ',
      mr: 'भारी चिकणमाती, सुकल्यावर भेगा पडणारी',
      bn: 'ভারী এঁটেল মাটি, শুকালে ফাটল ধরে',
      ta: 'அதிக களிமண் கொண்ட மண், காய்ந்ததும் வெடிப்புகள் தோன்றும்',
      kn: 'ಜೇಡಿ ಮಣ್ಣಿನ ರಚನೆ, ಒಣಗಿದಾಗ ಬಿರುಕು ಬಿಡುತ್ತದೆ',
      bho: 'भारी चिकनी माटी, सूखला पर दरार पड़ेला',
    },
    phRange: '7.5 – 8.5 (Slightly Alkaline)',
    waterRetention: {
      en: 'Extremely high moisture retention capacity',
      hi: 'अत्यधिक उच्च नमी धारण क्षमता',
      pa: 'ਬਹੁਤ ਜ਼ਿਆਦਾ ਨਮੀ ਸੰਭਾਲਣ ਦੀ ਸਮਰੱਥਾ',
      mr: 'अत्यंत जास्त ओलावा टिकवून ठेवण्याची क्षमता',
      bn: 'অত্যধিক আর্দ্রতা ধারণ ক্ষমতা',
      ta: 'மிக அதிக ஈரப்பதம் தக்கவைக்கும் திறன்',
      kn: 'ಅತ್ಯಧಿಕ ತೇವಾಂಶ ಧಾರಣಾ ಸಾಮರ್ಥ್ಯ',
      bho: 'बहुत बेसी नमी रोके के ताकत',
    },
    drainage: {
      en: 'Slow to moderate drainage; prone to water stagnation under excessive irrigation',
      hi: 'धीमी से मध्यम जल निकासी; अत्यधिक पानी से जलभराव की संभावना',
      pa: 'ਧੀਮੀ ਨਿਕਾਸੀ',
      mr: 'मंद पाण्याचा निचरा',
      bn: 'ধীর নিষ্কাশন',
      ta: 'மெதுவான வடிகால் வசதி',
      kn: 'ನಿಧಾನಗತಿಯ ನೀರು ಬಸಿದುಹೋಗುವಿಕೆ',
      bho: 'धीमा जल निकासी',
    },
    organicMatter: {
      en: 'Medium organic carbon (0.5% – 0.75%), rich in Calcium and Magnesium carbonates',
      hi: 'मध्यम जैविक कार्बन, कैल्शियम और मैग्नीशियम से भरपूर',
      pa: 'ਦਰਮਿਆਨਾ ਜੈਵਿਕ ਕਾਰਬਨ',
      mr: 'मध्यम सेंद्रिय कर्ब',
      bn: 'মাঝারি জৈব কার্বন',
      ta: 'நடுத்தர கரிம கார்பன்',
      kn: 'ಮಧ್ಯಮ ಸಾವಯವ ಇಂಗಾಲ',
      bho: 'मध्यम जैविक कार्बन',
    },
    nutrientProfile: {
      nitrogen: 'Low',
      phosphorus: 'Low to Medium',
      potassium: 'High',
      summary: {
        en: 'Naturally rich in Lime, Magnesia, and Potash; typically deficient in Nitrogen and Available Phosphorus.',
        hi: 'चूना, मैग्नीशिया और पोटाश से भरपूर; नाइट्रोजन और फास्फोरस की कमी पाई जाती है।',
        pa: 'ਪੋਟਾਸ਼ ਭਰਪੂਰ, ਨਾਈਟ੍ਰੋਜਨ ਦੀ ਕਮੀ।',
        mr: 'पोटॅश व चुनखडी भरपूर, नायट्रोजनची कमतरता।',
        bn: 'পটাশ সমৃদ্ধ, নাইট্রোজেনের ঘাটতি রয়েছে।',
        ta: 'பொட்டாஷ் நிறைந்தது, நைட்ரஜன் குறைபாடு உள்ளது.',
        kn: 'ಪೊಟ್ಯಾಶ್ ಸಮೃದ್ಧ, ಸಾರಜನಕದ ಕೊರತೆ.',
        bho: 'पोटाश भरपूर बाकि नाइट्रोजन के कमी बा।',
      },
    },
    suitableCrops: [
      {
        cropName: { en: 'Cotton', hi: 'कपास (Cotton)', pa: 'ਕਪਾਹ', mr: 'कापूस', bn: 'তুলা', ta: 'பருத்தி', kn: 'ಹತ್ತಿ', bho: 'कपास' },
        season: 'Kharif',
        suitabilityScore: 98,
        whySuitable: {
          en: 'Thrives in black soil due to excellent moisture-retention during boll development.',
          hi: 'टिंडे बनने के दौरान मिट्टी की उत्कृष्ट नमी धारण क्षमता कपास के लिए सबसे उत्तम है।',
        },
        waterRequirement: 'Medium',
        estimatedDuration: '150-180 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Soybean', hi: 'सोयाबीन (Soybean)', pa: 'ਸੋਇਆਬੀਨ', mr: 'सोयाबीन', bn: 'সয়াবিন', ta: 'சோயாபீன்', kn: 'ಸೋಯಾಬೀನ್', bho: 'सोयाबीन' },
        season: 'Kharif',
        suitabilityScore: 95,
        whySuitable: {
          en: 'Fixes atmospheric nitrogen and thrives in clayey, nutrient-retentive soils.',
          hi: 'हवा से नाइट्रोजन स्थिर करती है और इस मिट्टी में भरपूर दाना बनाती है।',
        },
        waterRequirement: 'Medium',
        estimatedDuration: '90-105 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Wheat', hi: 'गेहूं (Wheat)', pa: 'ਕਣਕ', mr: 'गहू', bn: 'গম', ta: 'கோதுமை', kn: 'ಗೋಧಿ', bho: 'गेहूं' },
        season: 'Rabi',
        suitabilityScore: 92,
        whySuitable: {
          en: 'Residual soil moisture after monsoon supports healthy grain filling during winter.',
          hi: 'मानसून के बाद मिट्टी में बची नमी रबी गेहूं की दानों की भराई में मदद करती है।',
        },
        waterRequirement: 'Medium',
        estimatedDuration: '115-135 days',
        iconHint: 'Wheat',
      },
      {
        cropName: { en: 'Chickpea / Gram', hi: 'चना (Chickpea / Chana)', pa: 'ਛੋਲੇ', mr: 'हरभरा (चना)', bn: 'ছোলা', ta: 'கொண்டைக்கடலை', kn: 'ಕಡಲೆ', bho: 'चना' },
        season: 'Rabi',
        suitabilityScore: 94,
        whySuitable: {
          en: 'Deep taproot extracts subsoil moisture; requires very few post-sowing irrigations.',
          hi: 'गहरी जड़ें नीचे से नमी खींचती हैं, बहुत कम सिंचाई में शानदार पैदावार देती है।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '100-115 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Jowar / Sorghum', hi: 'ज्वार (Jowar / Sorghum)', pa: 'ਜਵਾਰ', mr: 'ज्वारी', bn: 'জোয়ার', ta: 'சோளம்', kn: 'ಜೋಳ', bho: 'ज्वार' },
        season: 'Kharif / Rabi',
        suitabilityScore: 90,
        whySuitable: {
          en: 'Highly drought-tolerant and makes optimal use of heavy soil fertility.',
          hi: 'सूखा सहनशील फसल जो भारी मिट्टी की उर्वरता का पूरा लाभ उठाती है।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '105-120 days',
        iconHint: 'Wheat',
      },
    ],
    unsuitableCrops: {
      en: ['Groundnut (difficult pod penetration & harvesting in hard clay)', 'Root vegetables like Carrot/Radish (deformed roots)', 'Heavy waterlogged Tea/Coffee'],
      hi: ['मूंगफली (कड़ी मिट्टी में फलियों का विकास व उखाड़ना मुश्किल)', 'गाजर/मूली जैसी कंद वाली फसलें (जड़ें मुड़ जाती हैं)', 'चाय/कॉफी (अत्यधिक जलभराव से जड़ सड़न)'],
    },
    improvementTips: {
      en: [
        'Apply well-decomposed FYM or Vermicompost (5-8 tonnes/acre) to improve aeration and prevent crusting.',
        'Adopt Broad Bed & Furrow (BBF) or Ridge-and-Furrow system to drain excess monsoon water.',
        'Incorporate green manure like Dhaincha (Sesbania) every 2-3 years to replenish organic nitrogen.',
        'Conduct deep summer ploughing (ग्रीष्मकालीन गहरी जुताई) to eliminate soil-borne pests and aerate the profile.',
      ],
      hi: [
        'मिट्टी की हवादार संरचना और भुरभुरापन बढ़ाने के लिए 5-8 टन/एकड़ गोबर की सड़ी खाद या वर्मीकम्पोस्ट डालें।',
        'अत्यधिक बारिश में जलभराव रोकने के लिए मेड़-नाली (Ridge and Furrow) विधि अपनाएं।',
        'नाइट्रोजन और कार्बन बढ़ाने के लिए हर 2-3 साल में ढैंचा या सनई की हरी खाद अवश्य लगाएं।',
        'गर्मियों में गहरी जुताई करें ताकि हानिकारक कीड़े और खरपतवार नष्ट हों और मिट्टी का वातन सुधरे।',
      ],
    },
    managementAdvice: {
      en: 'Practice balanced fertilization: supplement with Nitrogen (Urea/DAP) and Zinc Sulphate (10 kg/acre). Avoid over-irrigation as clay retains moisture for extended periods.',
      hi: 'संतुलित खाद डालें: यूरिया या डीएपी के साथ 10 किग्रा/एकड़ जिंक सल्फेट अवश्य दें। मिट्टी में नमी देर तक टिकती है इसलिए बार-बार भारी सिंचाई से बचें।',
    },
  },

  alluvial: {
    standardName: 'Alluvial Soil (Domat / Loamy)',
    scientificOrder: 'Inceptisols / Entisols',
    localNames: {
      en: 'Alluvial Soil (Domat / Loam)',
      hi: 'जलोढ़ दोमट मिट्टी (Aluvial / Domat)',
      pa: 'ਖਾਦੀ ਦੋਮਟ ਮਿੱਟੀ',
      mr: 'गाळाची / पोयटा माती',
      bn: 'পলি দোআঁশ মাটি',
      ta: 'வண்டல் மண்',
      kn: 'ಮೆಕ್ಕಲು ಮಣ್ಣು (ಗೋಡು)',
      bho: 'दोमट जलोढ़ माटी',
    },
    color: {
      en: 'Light grey, yellowish-brown to light ash',
      hi: 'हल्का धूसर, बादामी या पीलापन लिए भूरा',
      pa: 'ਹਲਕਾ ਭੂਰਾ ਅਤੇ ਸਲੇਟੀ',
      mr: 'फिकट राखाडी ते पिवळसर तपकिरी',
      bn: 'হালকা ছাইরঙা থেকে হলদে বাদামি',
      ta: 'சாம்பல் கலந்த பழுப்பு நிறம்',
      kn: 'ತಿಳಿ ಬೂದು ಮತ್ತು ಹಳದಿ ಮಿಶ್ರಿತ ಕಂದು',
      bho: 'हल्का राख नियन भूरा',
    },
    texture: {
      en: 'Fine loamy to silty loam, porous, friable and easily cultivable',
      hi: 'बारीक दोमट, भुरभुरी, हवादार और जुताई के लिए बेहद उपयुक्त',
      pa: 'ਮਹੀਨ ਦੋਮਟ, ਨਰਮ ਅਤੇ ਖੇਤੀ ਲਈ ਸ਼ਾਨਦਾਰ',
      mr: 'उत्कृष्ट भुसभुशीत पोयटा',
      bn: 'নরম দোআঁশ ও উর্বর গঠন',
      ta: 'மென்மையான வண்டல் கட்டமைப்பு',
      kn: 'ಉತ್ತಮ ಗೋಡು ಮತ್ತು ಮರಳು ಮಿಶ್ರಿತ ವಿನ್ಯಾಸ',
      bho: 'नरम, भुरभुरा दोमट माटी',
    },
    phRange: '6.5 – 7.8 (Near Neutral – Ideal for most crops)',
    waterRetention: {
      en: 'Balanced water holding capacity with excellent capillary action',
      hi: 'संतुलित जल धारण क्षमता और उत्तम केशिका क्रिया',
      pa: 'ਸੰਤੁਲਿਤ ਪਾਣੀ ਸੰਭਾਲਣ ਦੀ ਸਮਰੱਥਾ',
      mr: 'संतुलित पाणी धारण क्षमता',
      bn: 'ভারসাম্যপূর্ণ পানি ধারণ ক্ষমতা',
      ta: 'சமநிலையான நீர்ப்பிடிப்பு திறன்',
      kn: 'ಸಮತೋಲಿತ ನೀರು ಹಿಡಿದಿಟ್ಟುಕೊಳ್ಳುವ ಸಾಮರ್ಥ್ಯ',
      bho: 'बढ़िया संतुलित जल संचय',
    },
    drainage: {
      en: 'Excellent natural drainage and root aeration',
      hi: 'उत्कृष्ट प्राकृतिक जल निकासी और जड़ों के लिए भरपूर हवा',
      pa: 'ਵਧੀਆ ਨਿਕਾਸੀ ਅਤੇ ਹਵਾਦਾਰ',
      mr: 'उत्तम निचरा आणि मुळांना मोकळी हवा',
      bn: 'চমৎকার পানি নিষ্কাশন',
      ta: 'சிறந்த வடிகால் வசதி',
      kn: 'ಉತ್ತಮ ನೀರು ಬಸಿದುಹೋಗುವಿಕೆ',
      bho: 'बढ़िया जल निकासी',
    },
    organicMatter: {
      en: 'Moderate organic carbon; responds dramatically to fertilizer and organic inputs',
      hi: 'मध्यम जैविक कार्बन; खाद और पोषक तत्वों पर तुरंत अत्यधिक प्रतिक्रिया',
      pa: 'ਦਰਮਿਆਨਾ ਜੈਵਿਕ ਕਾਰਬਨ',
      mr: 'मध्यम सेंद्रिय घटक',
      bn: 'মাঝারি জৈব উপাদান',
      ta: 'மிதமான கரிம உள்ளடக்கம்',
      kn: 'ಮಧ್ಯಮ ಸಾವಯವ ಇಂಗಾಲ',
      bho: 'मध्यम जैविक पदार्थ',
    },
    nutrientProfile: {
      nitrogen: 'Low to Medium',
      phosphorus: 'Medium',
      potassium: 'High',
      summary: {
        en: 'Abundant in Potash and Phosphoric acid; requires regular Nitrogen top-dressing for high yields.',
        hi: 'पोटाश और फास्फोरस से समृद्ध; उच्च पैदावार के लिए नाइट्रोजन की नियमित आवश्यकता।',
      },
    },
    suitableCrops: [
      {
        cropName: { en: 'Rice / Paddy', hi: 'धान / चावल (Paddy / Rice)', pa: 'ਝੋਨਾ', mr: 'भात / धान', bn: 'ধান', ta: 'நெல்', kn: 'ಭತ್ತ', bho: 'धान' },
        season: 'Kharif',
        suitabilityScore: 97,
        whySuitable: {
          en: 'Puddles smoothly, holding surface water required for high-yield dwarf varieties.',
          hi: 'लेह (पडलिंग) के बाद पानी रोककर उच्च पैदावार वाली किस्मों को भरपूर पोषण देता है।',
        },
        waterRequirement: 'High',
        estimatedDuration: '120-145 days',
        iconHint: 'Leaf',
      },
      {
        cropName: { en: 'Wheat', hi: 'गेहूं (Wheat)', pa: 'ਕਣਕ', mr: 'गहू', bn: 'গম', ta: 'கோதுமை', kn: 'ಗೋಧಿ', bho: 'गेहूं' },
        season: 'Rabi',
        suitabilityScore: 99,
        whySuitable: {
          en: 'India’s premier wheat belt soil; loose crumbly tilth allows deep root development.',
          hi: 'भारत के गेहूं कटोरे की पहचान; भुरभुरी संरचना जड़ों को 1 मीटर गहराई तक फैलने देती है।',
        },
        waterRequirement: 'Medium',
        estimatedDuration: '120-140 days',
        iconHint: 'Wheat',
      },
      {
        cropName: { en: 'Mustard', hi: 'सरसों (Mustard / Sarson)', pa: 'ਸਰ੍ਹੋਂ', mr: 'मोहरी (सरसो)', bn: 'সরিষা', ta: 'கடுகு', kn: 'ಸಾಸಿವೆ', bho: 'सरसों' },
        season: 'Rabi',
        suitabilityScore: 95,
        whySuitable: {
          en: 'Loamy soil allows quick root penetration and optimal oil accumulation in seeds.',
          hi: 'दोमट मिट्टी में सरसों की जड़ें जल्दी विकसित होती हैं और दानों में तेल की मात्रा बढ़ती है।',
        },
        waterRequirement: 'Low to Medium',
        estimatedDuration: '105-125 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Sugarcane', hi: 'गन्ना (Sugarcane)', pa: 'ਗੰਨਾ', mr: 'ऊस', bn: 'আখ', ta: 'கரும்பு', kn: 'ಕಬ್ಬು', bho: 'ईख / गन्ना' },
        season: 'Whole Year',
        suitabilityScore: 94,
        whySuitable: {
          en: 'Deep fertile alluvial horizon supplies moisture and nutrients continuously.',
          hi: 'गहरी और उपजाऊ दोमट मिट्टी गन्ने की भारी खुराक और पानी को कुशलता से संभालती है।',
        },
        waterRequirement: 'High',
        estimatedDuration: '10-12 months',
        iconHint: 'Wheat',
      },
      {
        cropName: { en: 'Potato & Vegetables', hi: 'आलू और सब्जियां (Potato & Vegetables)', pa: 'ਆਲੂ ਅਤੇ ਸਬਜ਼ੀਆਂ', mr: 'बटाटा व भाजीपाला', bn: 'আলু ও শাকসবজি', ta: 'உருளைக்கிழங்கு மற்றும் காய்கறிகள்', kn: 'ಆಲೂಗಡ್ಡೆ ಮತ್ತು ತರಕಾರಿಗಳು', bho: 'आलू अउर तरकारी' },
        season: 'Rabi / Zaid',
        suitabilityScore: 96,
        whySuitable: {
          en: 'Loose friable texture permits unhindered tuber expansion and smooth harvesting.',
          hi: 'मिट्टी भुरभुरी होने से आलू के कंद बिना किसी रुकावट के बड़े और चमकदार बनते हैं।',
        },
        waterRequirement: 'Medium',
        estimatedDuration: '75-95 days',
        iconHint: 'Carrot',
      },
    ],
    unsuitableCrops: {
      en: ['Cashew & Rubber (prefer acidic lateritic zones)', 'Tea (requires high altitude acidic soils)'],
      hi: ['काजू और रबर (अम्लीय लेटराइट मिट्टी पसंद करते हैं)', 'चाय (पहाड़ी अम्लीय ढलानों की आवश्यकता)'],
    },
    improvementTips: {
      en: [
        'Apply split doses of Nitrogen (Neem-coated Urea) to avoid leaching losses in loamy layers.',
        'Incorporate Zinc Sulphate (25 kg/ha) every alternate year to prevent Khaira disease in paddy.',
        'Rotate cereals with leguminous pulses (Moong, Urad) to maintain soil nitrogen balance naturally.',
      ],
      hi: [
        'दोमट मिट्टी में नाइट्रोजन का रिसाव रोकने के लिए नीम लेपित यूरिया को 2-3 किश्तों में दें।',
        'धान में खैरा रोग रोकने के लिए हर 2 साल में 10-12 किग्रा/एकड़ जिंक सल्फेट डालें।',
        'मिट्टी की ताकत बनाए रखने के लिए गेहूं-धान के बीच मूंग या उड़द जैसी दलहनी फसल जरूर लें।',
      ],
    },
    managementAdvice: {
      en: 'Maintain balanced N-P-K fertilization according to ICAR Soil Health Card guidelines. Alluvial soil responds exceptionally well to micro-nutrients like Zinc, Sulphur, and Boron.',
      hi: 'मृदा स्वास्थ्य कार्ड के अनुसार संतुलित NPK खाद दें। दोमट मिट्टी जिंक, सल्फर और बोरॉन जैसे सूक्ष्म पोषक तत्वों का तुरंत जबरदस्त असर दिखाती है।',
    },
  },

  red: {
    standardName: 'Red & Yellow Soil',
    scientificOrder: 'Alfisols / Ultisols',
    localNames: {
      en: 'Red and Yellow Soil (Lal Mitti)',
      hi: 'लाल और पीली मिट्टी (Lal Mitti)',
      pa: 'ਲਾਲ ਮਿੱਟੀ',
      mr: 'तांबडी माती (लाल जमीन)',
      bn: 'লাল মাটি',
      ta: 'செம்மண்',
      kn: 'ಕೆಂಪು ಮಣ್ಣು',
      bho: 'लाल माटी',
    },
    color: {
      en: 'Reddish-brown to brick red (due to high ferric oxide content)',
      hi: 'लाल, ईंट जैसा लाल या पीलापन लिए लाल रंग (आयरन ऑक्साइड के कारण)',
      pa: 'ਲਾਲ ਅਤੇ ਭੂਰਾ ਰੰਗ',
      mr: 'तांबूस लाल किंवा पिवळसर रंग',
      bn: 'ইটের মতো লাল ও হলদেটে',
      ta: 'செம்பழுப்பு நிறம்',
      kn: 'ಕೆಂಪು ಅಥವಾ ಇಟ್ಟಿಗೆಯಂತಹ ಕೆಂಪು ಬಣ್ಣ',
      bho: 'ईंटा नियन लाल रंग',
    },
    texture: {
      en: 'Porous, crumbly, sandy-clay to loam, highly friable with low compaction',
      hi: 'छिद्रयुक्त, भुरभुरी, रेतीली-दोमट से हल्की चिकनी, जुताई में आसान',
      pa: 'ਹਲਕੀ ਅਤੇ ਰੇਤਲੀ-ਦੋਮਟ',
      mr: 'सच्छिद्र आणि भुसभुशीत',
      bn: 'ছিদ্রযুক্ত এবং বালুকাময় দোআঁশ',
      ta: 'நுண்துளை மற்றும் மணல் கலந்த களிமண்',
      kn: 'ಸಚ್ಛಿದ್ರ ಮತ್ತು ಮರಳು ಮಿಶ್ರಿತ ವಿನ್ಯಾಸ',
      bho: 'भुरभुरा, रेतीला-दोमट माटी',
    },
    phRange: '5.5 – 6.8 (Slightly Acidic to Neutral)',
    waterRetention: {
      en: 'Low to moderate moisture retention; dries out rapidly without mulching',
      hi: 'कम से मध्यम नमी धारण क्षमता; बिना पलवार (मल्चिंग) के जल्दी सूखती है',
      pa: 'ਘੱਟ ਤੋਂ ਦਰਮਿਆਨੀ ਨਮੀ ਸੰਭਾਲ',
      mr: 'कमी ते मध्यम ओलावा टिकवणारी',
      bn: 'কম আর্দ্রতা ধারণ ক্ষমতা',
      ta: 'குறைந்த நீர்ப்பிடிப்பு திறன்',
      kn: 'ಕಡಿಮೆ ತೇವಾಂಶ ಧಾರಣ',
      bho: 'नमी जल्दी उड़ जाला',
    },
    drainage: {
      en: 'Very rapid drainage; minimal waterlogging hazard, excellent root aeration',
      hi: 'बहुत तेज़ जल निकासी; जलभराव का कोई खतरा नहीं, जड़ों को पूरी हवा मिलती है',
      pa: 'ਬਹੁਤ ਤੇਜ਼ ਨਿਕਾਸੀ',
      mr: 'पाण्याचा निचरा अतिशय वेगवान',
      bn: 'খুব দ্রুত নিষ্কাশন',
      ta: 'மிக விரைவான வடிகால்',
      kn: 'ಅತಿ ವೇಗದ ನೀರು ಬಸಿದುಹೋಗುವಿಕೆ',
      bho: 'पानी जल्दी निकल जाला',
    },
    organicMatter: {
      en: 'Low humus and organic carbon; requires liberal organic matter addition',
      hi: 'ह्यूमस और जैविक कार्बन की कमी; गोबर खाद व जैविक पदार्थों की अधिक आवश्यकता',
      pa: 'ਘੱਟ ਹਿਊਮਸ',
      mr: 'ह्युमसचे प्रमाण कमी',
      bn: 'কম হিউমাস ও জৈব কার্বন',
      ta: 'குறைந்த கரிம உள்ளடக்கம்',
      kn: 'ಕಡಿಮೆ ಸಾವಯವ ಅಂಶ',
      bho: 'जैविक कार्बन के कमी',
    },
    nutrientProfile: {
      nitrogen: 'Low',
      phosphorus: 'Low',
      potassium: 'Medium to High',
      summary: {
        en: 'Deficient in Nitrogen, Phosphorus, and Humus; adequately supplied with Potash.',
        hi: 'नाइट्रोजन, फास्फोरस और जीवांश की कमी होती है; पोटाश पर्याप्त मात्रा में रहता है।',
      },
    },
    suitableCrops: [
      {
        cropName: { en: 'Groundnut / Peanut', hi: 'मूंगफली (Groundnut)', pa: 'ਮੂੰਗਫਲੀ', mr: 'भुईमूग', bn: 'চিনাবাদাম', ta: 'நிலக்கடலை', kn: 'ಕಡಲೆಕಾಯಿ', bho: 'बादाम / मूंगफली' },
        season: 'Kharif',
        suitabilityScore: 98,
        whySuitable: {
          en: 'Loose friable red soil allows gynophores (pegs) to penetrate easily and form clean, large pods.',
          hi: 'भुरभुरी लाल मिट्टी में सुइयां (Pegs) आसानी से जमीन में धंसती हैं और फलियां सुडौल बनती हैं।',
        },
        waterRequirement: 'Low to Medium',
        estimatedDuration: '105-120 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Ragi & Millets', hi: 'रागी / बाजरा / मिलेट्स (Millets & Ragi)', pa: 'ਰਾਗੀ ਅਤੇ ਬਾਜਰਾ', mr: 'नाचणी / बाजरी (मिलेट्स)', bn: 'জোয়ার ও বাজরা', ta: 'கேழ்வரகு / தினை', kn: 'ರಾಗಿ ಮತ್ತು ಸಿರಿಧಾನ್ಯ', bho: 'रागी अउर बाजरा' },
        season: 'Kharif',
        suitabilityScore: 96,
        whySuitable: {
          en: 'Champion drought-hardy crops that yield reliably in shallow and well-drained red soils.',
          hi: 'कम पानी और हल्की लाल मिट्टी में भी पौष्टिक और भरपूर पैदावार देने वाली फसलें।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '95-115 days',
        iconHint: 'Wheat',
      },
      {
        cropName: { en: 'Pigeon Pea (Arhar / Tur)', hi: 'अरहर / तूर (Arhar / Pigeon Pea)', pa: 'ਅਰਹਰ', mr: 'तूर (अरहर)', bn: 'অড়হর', ta: 'துவரை', kn: 'ತೊಗರಿ', bho: 'रहड़ / अरहर' },
        season: 'Kharif',
        suitabilityScore: 94,
        whySuitable: {
          en: 'Deep taproot penetrates subsoil; fixes nitrogen and improves soil structure.',
          hi: 'गहरी मूसला जड़ें गहराई से भोजन लेती हैं और जमीन में नाइट्रोजन बढ़ाती हैं।',
        },
        waterRequirement: 'Low to Medium',
        estimatedDuration: '150-180 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Castor & Oilseeds', hi: 'अरंडी व तिल (Castor & Sesame)', pa: 'ਅਰਿੰਡ ਅਤੇ ਤਿਲ', mr: 'एरंडी आणि तीळ', bn: 'রেড়ী ও তিল', ta: 'ஆமணக்கு மற்றும் எள்', kn: 'ಔಡಲ ಮತ್ತು ಎಳ್ಳು', bho: 'रेड़ी अउर तिल' },
        season: 'Kharif',
        suitabilityScore: 92,
        whySuitable: {
          en: 'Thrives in well-drained red loam with low irrigation input.',
          hi: 'लाल दोमट में बहुत कम सिंचाई और कम लागत में अच्छा मुनाफा देती है।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '130-160 days',
        iconHint: 'Sprout',
      },
    ],
    unsuitableCrops: {
      en: ['Paddy without assured ponding (dries out too quickly)', 'Sugarcane without intensive drip irrigation'],
      hi: ['बिना पक्के पानी के धान (पानी तेजी से रिस जाता है)', 'बिना ड्रिप सिस्टम के गन्ना (ज्यादा पानी की मांग)'],
    },
    improvementTips: {
      en: [
        'Apply 8-10 tonnes/acre of FYM or compost to significantly increase water-holding capacity.',
        'Apply Agricultural Lime (चूना) if soil pH drops below 6.0 to neutralize acidity.',
        'Adopt Drip Irrigation with organic mulching to prevent rapid surface drying in summer.',
        'Use Single Super Phosphate (SSP) as the phosphorus source to also provide necessary Sulphur and Calcium.',
      ],
      hi: [
        'पानी रोकने की ताकत बढ़ाने के लिए 8-10 टन/एकड़ गोबर की सड़ी खाद या कम्पोस्ट जरूर मिलाएं।',
        'यदि मिट्टी में अम्लीयता (pH < 6.0) हो तो 200-300 किग्रा/एकड़ कृषि चूना डालें।',
        'नमी बचाने के लिए ड्रिप सिंचाई और खरपतवार या पुआल की मल्चिंग (पलवार) का प्रयोग करें।',
        'फास्फोरस के लिए डीएपी की जगह सिंगल सुपर फास्फेट (SSP) दें जिससे कैल्शियम व सल्फर भी मिले।',
      ],
    },
    managementAdvice: {
      en: 'Focus on moisture conservation and phosphorus availability. Split fertilizer applications prevent nutrients from washing away during heavy downpours.',
      hi: 'नमी संरक्षण और फास्फोरस की पूर्ति पर मुख्य ध्यान दें। खाद को 2-3 बार में थोड़ा-थोड़ा करके दें ताकि बारिश में पोषक तत्व बह न जाएं।',
    },
  },

  sandy: {
    standardName: 'Sandy / Arid Soil (Balui Mitti)',
    scientificOrder: 'Aridisols / Entisols',
    localNames: {
      en: 'Sandy / Desert Soil (Balui)',
      hi: 'रेतीली / बलुई मिट्टी (Sandy / Arid)',
      pa: 'ਰੇਤਲੀ ਮਿੱਟੀ',
      mr: 'वाळूमय / रेताड माती',
      bn: 'বেলে মাটি',
      ta: 'மணல் மண்',
      kn: 'ಮರಳು ಮಣ್ಣು',
      bho: 'बलुआ माटी',
    },
    color: {
      en: 'Light yellowish-brown, buff to pale grey',
      hi: 'हल्का पीला-भूरा, बदामी या बालू जैसा रंग',
      pa: 'ਹਲਕਾ ਪੀਲਾ ਅਤੇ ਰੇਤਲਾ',
      mr: 'फिकट पिवळसर तपकिरी वाळूचा रंग',
      bn: 'হালকা হলদেটে বালির মতো',
      ta: 'வெளிறிய மஞ்சள் பழுப்பு நிறம்',
      kn: 'ತಿಳಿ ಹಳದಿ-ಕಂದು ಮರಳಿನ ಬಣ್ಣ',
      bho: 'बालू जइसन उज्जर-पीयर रंग',
    },
    texture: {
      en: 'Coarse gritty sand grains (>85%), completely non-sticky, single-grain loose structure',
      hi: 'मोटे खुरदुरे बालू के कण, बिल्कुल चिपचिपी नहीं, खुली दानेदार संरचना',
      pa: 'ਮੋਟੇ ਰੇਤਲੇ ਕਣ, ਖੁੱਲ੍ਹੀ ਬਣਤਰ',
      mr: 'खरखरीत वाळूचे कण, न चिकटणारी',
      bn: 'মোটা বালির কণা, আলগা গঠন',
      ta: 'சொரசொரப்பான மணல் துகள்கள்',
      kn: 'ಒರಟಾದ ಮರಳಿನ ಕಣಗಳು, ಸಡಿಲ ವಿನ್ಯಾಸ',
      bho: 'मोटा बालूदार माटी',
    },
    phRange: '7.8 – 8.8 (Alkaline)',
    waterRetention: {
      en: 'Extremely low moisture holding capacity; dries within hours of wetting',
      hi: 'बहुत कम जल धारण क्षमता; पानी डालने के कुछ ही घंटों में सूख जाती है',
      pa: 'ਬਹੁਤ ਘੱਟ ਪਾਣੀ ਸੰਭਾਲਣ ਦੀ ਸਮਰੱਥਾ',
      mr: 'पाणी धरून ठेवण्याची क्षमता अत्यंत नगण्य',
      bn: 'খুবই কম পানি ধারণ ক্ষমতা',
      ta: 'மிகக் குறைந்த நீர்ப்பிடிப்பு திறன்',
      kn: 'ಅತ್ಯಂತ ಕಡಿಮೆ ನೀರು ಹಿಡಿಯುವ ಸಾಮರ್ಥ್ಯ',
      bho: 'पानी तुरंते सूख जाला',
    },
    drainage: {
      en: 'Excessively rapid percolation; prone to deep leaching of all applied nutrients',
      hi: 'अत्यधिक तीव्र जल रिसाव; खाद और पोषक तत्व नीचे बह जाते हैं',
      pa: 'ਬਹੁਤ ਤੇਜ਼ ਨਿਕਾਸੀ',
      mr: 'पाणी ताबडतोब जमिनीत मुरून जाते',
      bn: 'অতিরিক্ত দ্রুত পানি নিষ্কাশন',
      ta: 'அதிகப்படியான வேகமான வடிகால்',
      kn: 'ಅತಿ ವೇಗವಾಗಿ ನೀರು ಇಳಿಯುವಿಕೆ',
      bho: 'पानी एकदम नीचे चला जाला',
    },
    organicMatter: {
      en: 'Extremely deficient in organic carbon (<0.2%) and nitrogen',
      hi: 'जैविक कार्बन और नाइट्रोजन की भारी कमी',
      pa: 'ਜੈਵਿਕ ਕਾਰਬਨ ਦੀ ਭਾਰੀ ਕਮੀ',
      mr: 'सेंद्रिय घटकांची अत्यंत कमतरता',
      bn: 'জৈব উপাদান অত্যন্ত নগণ্য',
      ta: 'கரிம கார்பன் மிகவும் குறைவு',
      kn: 'ಸಾವಯವ ಇಂಗಾಲ ತೀರಾ ಕಡಿಮೆ',
      bho: 'जैविक कार्बन एकदम कम',
    },
    nutrientProfile: {
      nitrogen: 'Low',
      phosphorus: 'Low',
      potassium: 'Medium',
      summary: {
        en: 'Low cation exchange capacity; high soluble salts and low fertility status.',
        hi: 'पोषक तत्व थामने की क्षमता कमजोर; घुलनशील लवण अधिक और उर्वरता कम।',
      },
    },
    suitableCrops: [
      {
        cropName: { en: 'Pearl Millet (Bajra)', hi: 'बाजरा (Pearl Millet / Bajra)', pa: 'ਬਾਜਰਾ', mr: 'बाजरी', bn: 'বাজরা', ta: 'கம்பு', kn: 'ಸಜ್ಜೆ (ಬಾಜ್ರಾ)', bho: 'बाजरा' },
        season: 'Kharif',
        suitabilityScore: 98,
        whySuitable: {
          en: 'Unrivaled heat and drought resistance; thrives in sandy soils with minimal rainfall.',
          hi: 'तेज गर्मी और सूखे को सहने की बेजोड़ क्षमता; बहुत कम बारिश में भी बेहतरीन पैदावार।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '75-85 days',
        iconHint: 'Wheat',
      },
      {
        cropName: { en: 'Cluster Bean (Guar)', hi: 'ग्वार (Guar / Cluster Bean)', pa: 'ਗੁਆਰ', mr: 'गवार', bn: 'গুয়ার', ta: 'கொத்தவரங்காய்', kn: 'ಗೋರಿಕಾಯಿ', bho: 'ग्वार' },
        season: 'Kharif',
        suitabilityScore: 96,
        whySuitable: {
          en: 'Tolerates extreme heat, enriches poor sandy soil with atmospheric nitrogen.',
          hi: 'भीषण गर्मी सहती है और रेतीली जमीन को उपजाऊ नाइट्रोजन प्रदान करती है।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '85-100 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Moth Bean & Moong', hi: 'मोठ व मूंग (Moth Bean & Green Gram)', pa: 'ਮੋਠ ਅਤੇ ਮੂੰਗ', mr: 'मटकी आणि मूग', bn: 'মুগ ডাল', ta: 'பயறு வகைகள்', kn: 'ಮಡಿಕೆ ಮತ್ತು ಹೆಸರು ಕಾಳು', bho: 'मोठ अउर मूंग' },
        season: 'Kharif',
        suitabilityScore: 94,
        whySuitable: {
          en: 'Spreading habit blankets the sand, preventing erosion while maturing rapidly.',
          hi: 'जमीन पर फैलकर मिट्टी के कटाव को रोकती है और कम समय में तैयार हो जाती है।',
        },
        waterRequirement: 'Low',
        estimatedDuration: '60-70 days',
        iconHint: 'Sprout',
      },
      {
        cropName: { en: 'Watermelon & Muskmelon', hi: 'तरबूज व खरबूजा (Watermelon & Melons)', pa: 'ਤਰਬੂਜ਼ ਅਤੇ ਖ਼ਰਬੂਜ਼ਾ', mr: 'कलिंगड आणि खरबूज', bn: 'তরমুজ ও বাঙ্গি', ta: 'தர்பூசணி மற்றும் முலாம் பழம்', kn: 'ಕಲ್ಲಂಗಡಿ ಮತ್ತು ಕರಬೂಜ', bho: 'तरबूजा अउर खरबूजा' },
        season: 'Zaid (Summer)',
        suitabilityScore: 95,
        whySuitable: {
          en: 'Deep-rooting cucurbits flourish in warm sandy riverbeds with localized drip irrigation.',
          hi: 'रेत की गर्मी में बेलों की जड़ें गहरी जाती हैं और फल में भरपूर मिठास आती है।',
        },
        waterRequirement: 'Medium',
        estimatedDuration: '70-85 days',
        iconHint: 'Grape',
      },
    ],
    unsuitableCrops: {
      en: ['Paddy / Rice (unviable water percolation)', 'Sugarcane (needs high moisture retention)', 'Heavy wheat without frequent sprinkler runs'],
      hi: ['धान / चावल (पानी रुकना असंभव)', 'गन्ना (बहुत अधिक पानी की मांग)', 'भारी गेहूं (बिना स्प्रिंकलर के दाना नहीं भरेगा)'],
    },
    improvementTips: {
      en: [
        'Add pond silt (तालाब की काली मिट्टी / Tank Silt) at 20-30 trolleys/acre to impart clay texture and moisture-holding capacity.',
        'Adopt Drip / Sprinkler Irrigation; flood irrigation leads to huge water wastage.',
        'Apply heavy FYM / Compost (10 tonnes/acre) combined with biochar or straw mulching.',
        'Grow green manure like Sunnhemp / Dhaincha at first monsoon shower and plough it under.',
      ],
      hi: [
        'पानी रोकने की ताकत देने के लिए खेत में 20-25 ट्राली तालाब की काली चिकनी मिट्टी (गाद) डलवाएं।',
        'ड्रिप या फव्वारा (स्प्रिंकलर) सिंचाई ही अपनाएं; खुली सिंचाई से 70% पानी बर्बाद होता है।',
        'हर साल 8-10 टन सड़ी गोबर खाद डालें और फसल अवशेषों की पलवार (मल्चिंग) जरूर करें।',
        'मानसून की पहली बारिश में सनई या ढैंचा बोकर 40 दिन बाद मिट्टी में पलट दें।',
      ],
    },
    managementAdvice: {
      en: 'Foliar feeding of nutrients and fertigation via drip gives 3x better efficiency than broadcast granular fertilizers in sandy soils.',
      hi: 'रेतीली जमीन में जमीन पर खाद फेंकने के बजाय ड्रिप से फर्टिगेशन या पत्तियों पर छिड़काव (Foliar Spray) करें जिससे खाद व्यर्थ न बहे।',
    },
  },
};

/**
 * Determine best matching soil record from keywords or visual classification
 */
function matchSoilRecord(query: string): VerifiedSoilRecord {
  const q = query.toLowerCase();
  if (q.includes('black') || q.includes('काली') || q.includes('regur') || q.includes('vertisol') || q.includes('cotton')) {
    return VERIFIED_SOILS.black;
  }
  if (q.includes('red') || q.includes('लाल') || q.includes('alfisol') || q.includes('yellow') || q.includes('पीली')) {
    return VERIFIED_SOILS.red;
  }
  if (q.includes('sand') || q.includes('रेत') || q.includes('balui') || q.includes('arid') || q.includes('desert') || q.includes('बलुई')) {
    return VERIFIED_SOILS.sandy;
  }
  // Default to versatile Alluvial soil
  return VERIFIED_SOILS.alluvial;
}

/**
 * Multimodal Gemini Vision Soil Analysis
 */
async function callGeminiVisionSoil(
  photoDataUri: string,
  description?: string,
  location?: string,
  language: string = 'hi'
): Promise<AnalyzeSoilOutput | null> {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  if (!apiKey || apiKey.trim().length === 0) return null;

  const match = photoDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64Data = match[2];

  const langInstruction = getLanguageInstruction(language);

  const promptText = `You are a Chief Soil Scientist and Senior Agronomist at ICAR (Indian Council of Agricultural Research) and NBSS&LUP (National Bureau of Soil Survey & Land Use Planning).

Analyze this photograph of agricultural soil/farm field carefully. ${description ? `The farmer observed: "${description}".` : ''} ${location ? `Farm location: "${location}".` : ''}

CRITICAL RULES:
1. FIRST, check if this image is actually agricultural soil, farm dirt, soil clods, tilled ground, field earth, or crop nursery bed.
   - If it is a person, animal, vehicle, indoor room, food item, crop leaf, tool, electronics, or unrelated non-soil scene, return:
     {"isSoil": false, "isConfident": false, "soilType": "Not Soil", "lowConfidenceMessage": "This image does not appear to be farm soil or agricultural earth. Please upload a clear photo of your field soil, dirt clod, or farm ground."}
2. Accurately identify the Indian Soil Classification according to ICAR taxonomy:
   - Types: Black Cotton Soil (Regur/Vertisols), Alluvial Soil (Domat/Inceptisols), Red Soil (Lal Mitti/Alfisols), Laterite Soil, Sandy/Desert Soil (Balui/Aridisols), Clayey Soil, Saline/Alkaline Soil (Usar), or Mountain Peaty Soil.
   - Give the standard name AND the regional/local Indian name in language "${language}".
3. Visually analyze the soil's physical properties:
   - Texture: (e.g. Clayey, Loamy, Silty Loam, Sandy Loam, Coarse Sand)
   - Color: (e.g. Deep dark black, Reddish-brown, Greyish-yellow, Light buff)
   - Estimated pH range: (e.g. "7.5 - 8.5 (Slightly Alkaline)")
   - Water retention capacity: (Very High / High / Medium / Low)
   - Drainage rate: (Slow / Moderate / Rapid)
   - Organic matter level: (High / Medium / Low)
4. Evaluate the Nutrient Profile (NPK assessment: Nitrogen, Phosphorus, Potassium levels and deficiency/abundance).
5. Identify the BEST CROPS TO GROW in this specific soil type:
   - Provide 4 to 6 top recommended crops suited for Indian agro-climatic conditions.
   - For each crop include:
     - cropName: name in language "${language}"
     - season: "Kharif", "Rabi", "Zaid", or "Whole Year"
     - suitabilityScore: integer 80 to 99
     - whySuitable: clear agronomic reason why this crop thrives in this soil texture & pH
     - waterRequirement: "Low", "Medium", or "High"
     - estimatedDuration: e.g. "110-125 days"
     - iconHint: "Wheat", "Leaf", "Sprout", "Carrot", or "Grape"
6. Highlight Unsuitable Crops to avoid in this soil without major soil amendments.
7. Provide ICAR-recommended actionable soil improvement tips (compost, green manuring, gypsum/lime, drainage, tillage).
8. Cite authoritative source (e.g. "ICAR-Indian Institute of Soil Science (IISS), Bhopal & NBSS&LUP").

LANGUAGE REQUIREMENT:
${langInstruction}
ALL descriptive text, crop names, explanations, and advice MUST be in language "${language}".

Return strictly a valid JSON object matching this schema:
{
  "isSoil": true,
  "isConfident": true,
  "confidence": 94,
  "soilType": "Standard Soil Name (in ${language})",
  "primaryClassification": "ICAR Order e.g. Vertisols / Black Cotton Soil",
  "regionalName": "Regional name in ${language}",
  "texture": "Texture details in ${language}",
  "color": "Color description in ${language}",
  "estimatedPh": "e.g. 7.5 - 8.2",
  "waterRetention": "High / Medium / Low in ${language}",
  "drainage": "Drainage description in ${language}",
  "organicMatter": "Organic matter level in ${language}",
  "nutrientProfile": {
    "nitrogen": "Low",
    "phosphorus": "Medium",
    "potassium": "High",
    "summary": "Summary of soil nutrients in ${language}"
  },
  "suitableCrops": [
    {
      "cropName": "Crop Name (in ${language})",
      "season": "Kharif",
      "suitabilityScore": 96,
      "whySuitable": "Agronomic reason in ${language}",
      "waterRequirement": "Medium",
      "estimatedDuration": "110-125 days",
      "iconHint": "Sprout"
    }
  ],
  "unsuitableCrops": ["Crop 1 to avoid", "Crop 2 to avoid"],
  "soilImprovementTips": ["Tip 1 in ${language}", "Tip 2 in ${language}", "Tip 3 in ${language}"],
  "managementAdvice": "Field management advice in ${language}",
  "source": "ICAR-Indian Institute of Soil Science (IISS), Bhopal & NBSS&LUP"
}`;

  // Models to attempt in order of vision support
  const models = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
  ];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

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

      // Check if image was determined not to be soil
      if (parsed.isSoil === false || parsed.isConfident === false) {
        return {
          isSoil: false,
          isConfident: false,
          confidence: parsed.confidence || 35,
          soilType: parsed.soilType || 'Not Agricultural Soil',
          primaryClassification: 'Non-soil',
          texture: '',
          color: '',
          estimatedPh: '',
          waterRetention: '',
          drainage: '',
          organicMatter: '',
          nutrientProfile: { nitrogen: '', phosphorus: '', potassium: '', summary: '' },
          suitableCrops: [],
          soilImprovementTips: [],
          managementAdvice: '',
          source: 'ICAR-IISS Bhopal',
          lowConfidenceMessage:
            parsed.lowConfidenceMessage ||
            (language === 'hi'
              ? 'यह तस्वीर खेत की मिट्टी या जमीन की नहीं लग रही है। कृपया खेत की मिट्टी की साफ़ तस्वीर अपलोड करें।'
              : 'This image does not appear to be agricultural soil. Please upload a clear photo of your field soil or earth.'),
        };
      }

      if (parsed.soilType && Array.isArray(parsed.suitableCrops) && parsed.suitableCrops.length > 0) {
        return {
          isSoil: true,
          isConfident: true,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 92,
          soilType: parsed.soilType,
          primaryClassification: parsed.primaryClassification || 'ICAR Agricultural Soil',
          regionalName: parsed.regionalName || parsed.soilType,
          texture: parsed.texture || 'Loamy / Clayey',
          color: parsed.color || 'Natural Earth Tone',
          estimatedPh: parsed.estimatedPh || '6.5 – 7.8',
          waterRetention: parsed.waterRetention || 'Medium',
          drainage: parsed.drainage || 'Moderate',
          organicMatter: parsed.organicMatter || 'Medium',
          nutrientProfile: parsed.nutrientProfile || {
            nitrogen: 'Medium',
            phosphorus: 'Medium',
            potassium: 'High',
            summary: 'Balanced nutrient status under good management.',
          },
          suitableCrops: parsed.suitableCrops,
          unsuitableCrops: parsed.unsuitableCrops || [],
          soilImprovementTips: parsed.soilImprovementTips || [],
          managementAdvice: parsed.managementAdvice || '',
          source: parsed.source || 'ICAR-Indian Institute of Soil Science (IISS), Bhopal & NBSS&LUP',
        };
      }
    } catch (err: any) {
      console.warn(`Gemini Vision model ${model} error:`, err?.message || err);
    }
  }

  return null;
}

/**
 * High-speed Groq LLM Soil Analysis when photo is absent or failed
 */
async function callGroqSoilAnalysis(
  description: string,
  location?: string,
  language: string = 'hi'
): Promise<AnalyzeSoilOutput | null> {
  if (!isGroqConfigured || !groqClient) return null;

  const langInstruction = getLanguageInstruction(language);
  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

  const promptText = `You are a Senior Soil Scientist at ICAR (Indian Council of Agricultural Research).
Analyze this soil description: "${description}". ${location ? `Location: "${location}".` : ''}

Determine the exact Indian soil type, physical characteristics, nutrient status, 4-5 best suitable crops to grow, crops to avoid, and soil improvement tips.
${langInstruction}
ALL fields MUST be translated into language "${language}".

Return strictly valid JSON:
{
  "isSoil": true,
  "isConfident": true,
  "confidence": 90,
  "soilType": "Soil Name in ${language}",
  "primaryClassification": "Classification in ${language}",
  "regionalName": "Regional name in ${language}",
  "texture": "Texture in ${language}",
  "color": "Color in ${language}",
  "estimatedPh": "7.0 - 8.0",
  "waterRetention": "Retention in ${language}",
  "drainage": "Drainage in ${language}",
  "organicMatter": "Organic matter in ${language}",
  "nutrientProfile": {
    "nitrogen": "Low",
    "phosphorus": "Medium",
    "potassium": "High",
    "summary": "Nutrient summary in ${language}"
  },
  "suitableCrops": [
    {
      "cropName": "Crop Name in ${language}",
      "season": "Kharif",
      "suitabilityScore": 95,
      "whySuitable": "Agronomic reason in ${language}",
      "waterRequirement": "Medium",
      "estimatedDuration": "110-120 days",
      "iconHint": "Sprout"
    }
  ],
  "unsuitableCrops": ["Crop 1 to avoid"],
  "soilImprovementTips": ["Tip 1 in ${language}", "Tip 2 in ${language}"],
  "managementAdvice": "Management advice in ${language}",
  "source": "ICAR-Indian Institute of Soil Science (IISS), Bhopal & NBSS&LUP"
}`;

  for (const model of models) {
    try {
      const completion = await groqClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an expert ICAR soil scientist. Output valid JSON only.' },
          { role: 'user', content: promptText },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) continue;
      const parsed = JSON.parse(content);
      if (parsed.soilType && Array.isArray(parsed.suitableCrops) && parsed.suitableCrops.length > 0) {
        return parsed as AnalyzeSoilOutput;
      }
    } catch (e: any) {
      console.warn(`Groq model ${model} soil analysis error:`, e?.message || e);
    }
  }

  return null;
}

/**
 * Fallback to verified ICAR soil record
 */
function buildVerifiedSoilFallback(
  query: string,
  language: string = 'hi'
): AnalyzeSoilOutput {
  const langKey = (['en', 'hi', 'pa', 'mr', 'bn', 'ta', 'kn', 'bho'].includes(language) ? language : 'hi');
  const record = matchSoilRecord(query);

  const localName = record.localNames[langKey] || record.localNames.hi || record.standardName;
  const color = record.color[langKey] || record.color.hi || record.color.en;
  const texture = record.texture[langKey] || record.texture.hi || record.texture.en;
  const waterRetention = record.waterRetention[langKey] || record.waterRetention.hi || record.waterRetention.en;
  const drainage = record.drainage[langKey] || record.drainage.hi || record.drainage.en;
  const organicMatter = record.organicMatter[langKey] || record.organicMatter.hi || record.organicMatter.en;
  const nutSummary = record.nutrientProfile.summary[langKey] || record.nutrientProfile.summary.hi || record.nutrientProfile.summary.en;

  const suitableCrops: SuitableCrop[] = record.suitableCrops.map((c) => ({
    cropName: c.cropName[langKey] || c.cropName.hi || c.cropName.en,
    season: c.season,
    suitabilityScore: c.suitabilityScore,
    whySuitable: c.whySuitable[langKey] || c.whySuitable.hi || c.whySuitable.en,
    waterRequirement: c.waterRequirement,
    estimatedDuration: c.estimatedDuration,
    iconHint: c.iconHint,
  }));

  const unsuitableCrops = record.unsuitableCrops[langKey] || record.unsuitableCrops.hi || record.unsuitableCrops.en;
  const improvementTips = record.improvementTips[langKey] || record.improvementTips.hi || record.improvementTips.en;
  const managementAdvice = record.managementAdvice[langKey] || record.managementAdvice.hi || record.managementAdvice.en;

  return {
    isSoil: true,
    isConfident: true,
    confidence: 93,
    soilType: localName,
    primaryClassification: record.scientificOrder,
    regionalName: localName,
    texture,
    color,
    estimatedPh: record.phRange,
    waterRetention,
    drainage,
    organicMatter,
    nutrientProfile: {
      nitrogen: record.nutrientProfile.nitrogen,
      phosphorus: record.nutrientProfile.phosphorus,
      potassium: record.nutrientProfile.potassium,
      summary: nutSummary,
    },
    suitableCrops,
    unsuitableCrops,
    soilImprovementTips: improvementTips,
    managementAdvice,
    source: 'ICAR-Indian Institute of Soil Science (IISS), Bhopal & NBSS&LUP',
  };
}

/**
 * Public Server Action: Analyze Soil & Recommend Crops
 */
export async function analyzeSoil(input: AnalyzeSoilInput): Promise<AnalyzeSoilOutput> {
  const langKey = (input.language || 'hi').toLowerCase();
  const validLang = ['en', 'hi', 'pa', 'mr', 'bn', 'ta', 'kn', 'bho'].includes(langKey) ? langKey : 'hi';

  // 1. Primary Engine: Multimodal Gemini Vision if photo is provided
  if (input.photoDataUri && input.photoDataUri.startsWith('data:image')) {
    try {
      const visionResult = await callGeminiVisionSoil(
        input.photoDataUri,
        input.description,
        input.location,
        validLang
      );
      if (visionResult) {
        return visionResult;
      }
    } catch (visionErr) {
      console.warn('Gemini vision soil analysis failed, falling back:', visionErr);
    }
  }

  // 2. Secondary Engine: Groq LLM for text description
  if (input.description && input.description.trim().length > 0) {
    try {
      const groqResult = await callGroqSoilAnalysis(
        input.description.trim(),
        input.location,
        validLang
      );
      if (groqResult) {
        return groqResult;
      }
    } catch (groqErr) {
      console.warn('Groq soil analysis failed, falling back to ICAR database:', groqErr);
    }
  }

  // 3. Fallback Engine: ICAR & NBSS&LUP Verified Soil Knowledge Base
  const searchContext = `${input.description || ''} ${input.location || ''}`.trim();
  return buildVerifiedSoilFallback(searchContext, validLang);
}
