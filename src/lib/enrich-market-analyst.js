const fs = require('fs');
const path = require('path');

const localesDir = path.join(process.cwd(), 'src/locales');
const languages = ['en', 'hi', 'pa', 'mr', 'bn', 'ta'];

const marketAnalystTranslations = {
  en: {
    title: "Market Analyst",
    description: "Track live and historical APMC mandi market prices across India.",
    faqTitle: "Frequently Asked Questions",
    tabs: {
      livePrices: "Live Prices",
      priceAlerts: "Price Alerts"
    },
    livePrices: {
      title: "Live APMC Mandi Prices",
      officialAgmarknetFeed: "Official Agmarknet Feed",
      subtitlePrefix: "Real-time daily modal transactions from",
      fetchingMandis: "Fetching Mandis...",
      refreshLivePrices: "Refresh Live Prices",
      selectState: "1. Select State",
      selectDistrict: "2. Select District",
      selectCrop: "3. Select Crop",
      searchMandiCrop: "4. Search Mandi / Crop",
      searchPlaceholder: "Search Crop or Mandi (e.g. Wheat, Indore, Tomato)...",
      allStates: "All States",
      allDistricts: "All Districts",
      allCrops: "All Crops",
      allSources: "All Sources",
      stateLabel: "State",
      districtLabel: "District",
      cropLabel: "Crop",
      matchingMandis: "Matching Mandis",
      showingRecords: "Showing {{count}} authentic records",
      resetFilters: "Reset All Filters",
      officialRates: "Official APMC Mandi Rates",
      offlineBenchmark: "Offline Benchmark Mode",
      commodityVariety: "Commodity & Variety",
      mandiYard: "Mandi Market Yard",
      arrivalDate: "Arrival Date",
      modalPrice: "Modal Price (₹/Q)",
      minMaxPrice: "Min - Max (₹/Q)",
      officialSource: "Official Source",
      noRecordsFound: "No commodities found matching current filters.",
      unavailableMessage: "Live market price data is currently unavailable.",
      retry: "Retry"
    },
    faqs: {
      q1: "How often are these Mandi rates updated?",
      a1: "Rates are updated daily directly from the official Agmarknet and state APMC agricultural market servers.",
      q2: "What does Modal Price mean?",
      a2: "Modal price represents the price at which the highest volume of that crop was traded in that specific mandi during the day.",
      q3: "Can I set price alerts for my crops?",
      a3: "Yes, visit the Price Alerts tab to set automated notification triggers when your crop hits your target selling price.",
      q4: "Are these rates official across India?",
      a4: "Yes, these rates come from official government APMC market yard transactions across all states."
    }
  },
  hi: {
    title: "बाजार विश्लेषक",
    description: "पूरे भारत में लाइव और ऐतिहासिक एपीएमसी मंडी भाव ट्रैक करें।",
    faqTitle: "अक्सर पूछे जाने वाले प्रश्न",
    tabs: {
      livePrices: "ताज़ा मंडी भाव",
      priceAlerts: "मूल्य अलर्ट"
    },
    livePrices: {
      title: "लाइव एपीएमसी मंडी भाव",
      officialAgmarknetFeed: "आधिकारिक एग्मार्कनेट फ़ीड",
      subtitlePrefix: "दैनिक मोडल लेन-देन स्रोत:",
      fetchingMandis: "मंडी भाव लोड हो रहे हैं...",
      refreshLivePrices: "ताज़ा भाव रिफ्रेश करें",
      selectState: "1. राज्य चुनें",
      selectDistrict: "2. जिला चुनें",
      selectCrop: "3. फसल चुनें",
      searchMandiCrop: "4. मंडी या फसल खोजें",
      searchPlaceholder: "फसल या मंडी खोजें (उदा. गेहूं, इंदौर, टमाटर)...",
      allStates: "सभी राज्य",
      allDistricts: "सभी जिले",
      allCrops: "सभी फसलें",
      allSources: "सभी स्रोत",
      stateLabel: "राज्य",
      districtLabel: "जिला",
      cropLabel: "फसल",
      matchingMandis: "मिलती-जुलती मंडियां",
      showingRecords: "{{count}} प्रामाणिक रिकॉर्ड दिखाए जा रहे हैं",
      resetFilters: "फ़िल्टर रीसेट करें",
      officialRates: "आधिकारिक एपीएमसी मंडी दरें",
      offlineBenchmark: "ऑफलाइन बेंचमार्क मोड",
      commodityVariety: "फसल एवं किस्म",
      mandiYard: "मंडी यार्ड",
      arrivalDate: "आवक तारीख",
      modalPrice: "मॉडल भाव (₹/क्विंटल)",
      minMaxPrice: "न्यूनतम - अधिकतम (₹/क्विंटल)",
      officialSource: "आधिकारिक स्रोत",
      noRecordsFound: "चयनित फ़िल्टर के अनुसार कोई मंडी रिकॉर्ड नहीं मिला।",
      unavailableMessage: "लाइव मंडी भाव डेटा इस समय उपलब्ध नहीं है।",
      retry: "पुनः प्रयास करें"
    },
    faqs: {
      q1: "ये मंडी भाव कितनी बार अपडेट होते हैं?",
      a1: "भाव आधिकारिक एग्मार्कनेट और राज्य एपीएमसी सर्वर से दैनिक रूप से अपडेट किए जाते हैं।",
      q2: "मॉडल भाव (Modal Price) क्या होता है?",
      a2: "मॉडल भाव वह दर है जिस पर उस दिन मंडी में सबसे अधिक मात्रा में फसल की बिक्री हुई।",
      q3: "क्या मैं अपने क्षेत्र के लिए मूल्य अलर्ट सेट कर सकता हूँ?",
      a3: "हाँ, मूल्य अलर्ट टैब में जाकर अपनी पसंदीदा फसल और लक्षित मूल्य सेट करें।",
      q4: "क्या ये कीमतें पूरे देश में मान्य हैं?",
      a4: "कीमतें विशिष्ट मंडी यार्ड और स्थानीय आवक-मांग पर आधारित आधिकारिक सरकारी आंकड़े हैं।"
    }
  },
  pa: {
    title: "ਮੰਡੀ ਵਿਸ਼ਲੇਸ਼ਕ",
    description: "ਭਾਰਤ ਭਰ ਦੀਆਂ ਏਪੀਐਮਸੀ ਮੰਡੀਆਂ ਦੇ ਤਾਜ਼ਾ ਅਤੇ ਇਤਿਹਾਸਕ ਭਾਅ ਵੇਖੋ।",
    faqTitle: "ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ",
    tabs: {
      livePrices: "ਤਾਜ਼ਾ ਮੰਡੀ ਭਾਅ",
      priceAlerts: "ਭਾਅ ਅਲਰਟ"
    },
    livePrices: {
      title: "ਲਾਈਵ ਏਪੀਐਮਸੀ ਮੰਡੀ ਭਾਅ",
      officialAgmarknetFeed: "ਸਰਕਾਰੀ ਐਗਮਾਰਕਨੈੱਟ ਫ਼ੀਡ",
      subtitlePrefix: "ਰੋਜ਼ਾਨਾ ਮਾਡਲ ਲੈਣ-ਦੇਣ ਸਰੋਤ:",
      fetchingMandis: "ਮੰਡੀਆਂ ਤੋਂ ਭਾਅ ਪ੍ਰਾਪਤ ਹੋ ਰਹੇ ਹਨ...",
      refreshLivePrices: "ਤਾਜ਼ਾ ਭਾਅ ਰੀਫ੍ਰੈਸ਼ ਕਰੋ",
      selectState: "1. ਰਾਜ ਚੁਣੋ",
      selectDistrict: "2. ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ",
      selectCrop: "3. ਫ਼ਸਲ ਚੁਣੋ",
      searchMandiCrop: "4. ਮੰਡੀ ਜਾਂ ਫ਼ਸਲ ਖੋਜੋ",
      searchPlaceholder: "ਫ਼ਸਲ ਜਾਂ ਮੰਡੀ ਖੋਜੋ (ਜਿਵੇਂ ਕਣਕ, ਲੁਧਿਆਣਾ, ਟਮਾਟਰ)...",
      allStates: "ਸਾਰੇ ਰਾਜ",
      allDistricts: "ਸਾਰੇ ਜ਼ਿਲ੍ਹੇ",
      allCrops: "ਸਾਰੀਆਂ ਫ਼ਸਲਾਂ",
      allSources: "ਸਾਰੇ ਸਰੋਤ",
      stateLabel: "ਰਾਜ",
      districtLabel: "ਜ਼ਿਲ੍ਹਾ",
      cropLabel: "ਫ਼ਸਲ",
      matchingMandis: "ਮਿਲਦੀਆਂ ਮੰਡੀਆਂ",
      showingRecords: "{{count}} ਪ੍ਰਮਾਣਿਤ ਰਿਕਾਰਡ ਦਿਖਾਏ ਜਾ ਰਹੇ ਹਨ",
      resetFilters: "ਸਾਰੇ ਫਿਲਟਰ ਰੀਸੈੱਟ ਕਰੋ",
      officialRates: "ਸਰਕਾਰੀ ਏਪੀਐਮਸੀ ਮੰਡੀ ਦਰਾਂ",
      offlineBenchmark: "ਔਫਲਾਈਨ ਬੈਂਚਮਾਰਕ ਮੋਡ",
      commodityVariety: "ਫ਼ਸਲ ਅਤੇ ਕਿਸਮ",
      mandiYard: "ਮੰਡੀ ਯਾਰਡ",
      arrivalDate: "ਆਮਦ ਮਿਤੀ",
      modalPrice: "ਮਾਡਲ ਭਾਅ (₹/ਕੁਇੰਟਲ)",
      minMaxPrice: "ਘੱਟੋ-ਘੱਟ - ਵੱਧ ਤੋਂ ਵੱਧ (₹/ਕੁਇੰਟਲ)",
      officialSource: "ਸਰਕਾਰੀ ਸਰੋਤ",
      noRecordsFound: "ਚੁਣੇ ਗਏ ਫਿਲਟਰਾਂ ਲਈ ਕੋਈ ਮੰਡੀ ਰਿਕਾਰਡ ਨਹੀਂ ਮਿਲਿਆ।",
      unavailableMessage: "ਲਾਈਵ ਮੰਡੀ ਭਾਅ ਡਾਟਾ ਇਸ ਸਮੇਂ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।",
      retry: "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ"
    },
    faqs: {
      q1: "ਇਹ ਮੰਡੀ ਭਾਅ ਕਿੰਨੀ ਵਾਰ ਅੱਪਡੇਟ ਹੁੰਦੇ ਹਨ?",
      a1: "ਭਾਅ ਰੋਜ਼ਾਨਾ ਸਰਕਾਰੀ ਐਗਮਾਰਕਨੈੱਟ ਅਤੇ ਰਾਜ ਏਪੀਐਮਸੀ ਸਰਵਰ ਤੋਂ ਅੱਪਡੇਟ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।",
      q2: "ਮਾਡਲ ਭਾਅ ਕੀ ਹੁੰਦਾ ਹੈ?",
      a2: "ਮਾਡਲ ਭਾਅ ਉਹ ਦਰ ਹੈ ਜਿਸ 'ਤੇ ਉਸ ਦਿਨ ਮੰਡੀ ਵਿੱਚ ਸਭ ਤੋਂ ਵੱਧ ਫ਼ਸਲ ਵਿਕੀ।",
      q3: "ਕੀ ਮੈਂ ਆਪਣੀ ਫ਼ਸਲ ਲਈ ਭਾਅ ਅਲਰਟ ਸੈੱਟ ਕਰ ਸਕਦਾ ਹਾਂ?",
      a3: "ਹਾਂ, ਭਾਅ ਅਲਰਟ ਟੈਬ ਵਿੱਚ ਜਾ ਕੇ ਆਪਣੀ ਫ਼ਸਲ ਅਤੇ ਲੋੜੀਂਦਾ ਮੁੱਲ ਸੈੱਟ ਕਰੋ।",
      q4: "ਕੀ ਇਹ ਰੇਟ ਸਰਕਾਰੀ ਹਨ?",
      a4: "ਹਾਂ, ਇਹ ਸਾਰੇ ਰਾਜਾਂ ਦੇ ਸਰਕਾਰੀ ਏਪੀਐਮਸੀ ਮੰਡੀ ਯਾਰਡ ਦੇ ਪ੍ਰਮਾਣਿਤ ਅੰਕੜੇ ਹਨ।"
    }
  },
  mr: {
    title: "बाजार विश्लेषक",
    description: "संपूर्ण भारतातील कृषी उत्पन्न बाजार समित्यांचे (APMC) थेट बाजार भाव पहा.",
    faqTitle: "वारंवार विचारले जाणारे प्रश्न",
    tabs: {
      livePrices: "थेट बाजार भाव",
      priceAlerts: "दर अलर्ट"
    },
    livePrices: {
      title: "थेट एपीएमसी बाजार भाव",
      officialAgmarknetFeed: "अधिकृत एग्मार्कनेट फीड",
      subtitlePrefix: "दैनिक सरासरी दर स्रोत:",
      fetchingMandis: "बाजार भाव लोड होत आहेत...",
      refreshLivePrices: "दर रिफ्रेश करा",
      selectState: "१. राज्य निवडा",
      selectDistrict: "२. जिल्हा निवडा",
      selectCrop: "३. पीक निवडा",
      searchMandiCrop: "४. बाजार किंवा पीक शोधा",
      searchPlaceholder: "पीक किंवा बाजार शोधा (उदा. गहू, पुणे, कांदा)...",
      allStates: "सर्व राज्ये",
      allDistricts: "सर्व जिल्हे",
      allCrops: "सर्व पिके",
      allSources: "सर्व स्रोत",
      stateLabel: "राज्य",
      districtLabel: "जिल्हा",
      cropLabel: "पीक",
      matchingMandis: "जुळणाऱ्या बाजार समित्या",
      showingRecords: "{{count}} अधिकृत नोंदी दाखवत आहे",
      resetFilters: "सर्व फिल्टर्स रीसेट करा",
      officialRates: "अधिकृत एपीएमसी बाजार दर",
      offlineBenchmark: "ऑफलाइन बेंचमार्क मोड",
      commodityVariety: "पीक व जात",
      mandiYard: "बाजार समिती यार्ड",
      arrivalDate: "आवक तारीख",
      modalPrice: "सरासरी भाव (₹/क्विंटल)",
      minMaxPrice: "किमान - कमाल (₹/क्विंटल)",
      officialSource: "अधिकृत स्रोत",
      noRecordsFound: "निवडलेल्या फिल्टर्सनुसार कोणतीही नोंद आढळली नाही.",
      unavailableMessage: "थेट बाजार भाव सध्या उपलब्ध नाही.",
      retry: "पुन्हा प्रयत्न करा"
    },
    faqs: {
      q1: "हे बाजार भाव किती वेळा अपडेट होतात?",
      a1: "दर अधिकृत एग्मार्कनेट व राज्य कृषी पणन मंडळ सर्व्हरवरून दररोज अपडेट केले जातात.",
      q2: "सरासरी भाव (Modal Price) म्हणजे काय?",
      a2: "ज्या भावाने त्या दिवशी बाजारात सर्वाधिक मालाची विक्री झाली तो भाव.",
      q3: "मी पिकासाठी दर अलर्ट सेट करू शकतो का?",
      a3: "होय, दर अलर्ट टॅबवर जाऊन आपले इच्छित पीक आणि लक्ष्य दर सेट करू शकता.",
      q4: "हे दर अधिकृत आहेत का?",
      a4: "होय, हे दर थेट शासनमान्य कृषी उत्पन्न बाजार समित्यांचे आहेत."
    }
  },
  bn: {
    title: "বাজার বিশ্লেষক",
    description: "সমগ্র ভারতের এপিএমসি মান্ডির লাইভ এবং ঐতিহাসিক বাজার দর ট্র্যাক করুন।",
    faqTitle: "সাধারণ প্রশ্নাবলী",
    tabs: {
      livePrices: "লাইভ বাজার দর",
      priceAlerts: "মূল্য সতর্কতা"
    },
    livePrices: {
      title: "লাইভ এপিএমসি মান্ডি দর",
      officialAgmarknetFeed: "অফিসিয়াল অ্যাগমार्कনেট ফিড",
      subtitlePrefix: "দৈনিক গড় লেনদেন উৎস:",
      fetchingMandis: "দর লোড হচ্ছে...",
      refreshLivePrices: "তাজা দর রিফ্রেশ করুন",
      selectState: "১. রাজ্য নির্বাচন করুন",
      selectDistrict: "২. জেলা নির্বাচন করুন",
      selectCrop: "৩. ফসল নির্বাচন করুন",
      searchMandiCrop: "৪. মান্ডি বা ফসল খুঁজুন",
      searchPlaceholder: "ফসল বা মান্ডি খুঁজুন (যেমন গম, বর্ধমান, আলু)...",
      allStates: "সমস্ত রাজ্য",
      allDistricts: "সমস্ত জেলা",
      allCrops: "সমস্ত ফসল",
      allSources: "সমস্ত উৎস",
      stateLabel: "রাজ্য",
      districtLabel: "জেলা",
      cropLabel: "ফসল",
      matchingMandis: "মিল থাকা মান্ডি",
      showingRecords: "{{count}}টি যাচাইকৃত রেকর্ড দেখানো হচ্ছে",
      resetFilters: "ফিল্টার রিসেট করুন",
      officialRates: "অফিসিয়াল এপিএমসি মান্ডি দর",
      offlineBenchmark: "অফলাইন বেঞ্চমার্ক মোড",
      commodityVariety: "ফসল ও জাত",
      mandiYard: "মান্ডি ইয়ার্ড",
      arrivalDate: "আগমনের তারিখ",
      modalPrice: "গড় দর (₹/কুইন্টাল)",
      minMaxPrice: "সর্বনিম্ন - সর্বোচ্চ (₹/কুইন্টাল)",
      officialSource: "অফিসিয়াল উৎস",
      noRecordsFound: "নির্বাচিত ফিল্টারের সাথে মেলে এমন কোনো রেকর্ড পাওয়া যায়নি।",
      unavailableMessage: "লাইভ বাজার দর ডেটা বর্তমানে অনুপলব্ধ।",
      retry: "পুনরায় চেষ্টা করুন"
    },
    faqs: {
      q1: "এই মান্ডি দর কতবার আপডেট হয়?",
      a1: "অফিসিয়াল অ্যাগমার্কনেট এবং রাজ্য এপিএমসি সার্ভার থেকে প্রতিদিন দর আপডেট করা হয়।",
      q2: "মডাল প্রাইস (Modal Price) বলতে কী বোঝায়?",
      a2: "মডাল প্রাইস হলো সেই দর যাতে ওই দিন মান্ডিতে সবচেয়ে বেশি পরিমাণ ফসল বিক্রি হয়েছে।",
      q3: "আমি কি ফসলের জন্য মূল্য সতর্কতা সেট করতে পারি?",
      a3: "হ্যাঁ, মূল্য সতর্কতা ট্যাবে গিয়ে আপনার লক্ষ্য মূল্য নির্ধারণ করুন।",
      q4: "এই দরগুলি কি সরকারিভাবে যাচাইকৃত?",
      a4: "হ্যাঁ, এই তথ্যগুলি সরকারি এপিএমসি মান্ডি থেকে সংগৃহীত।"
    }
  },
  ta: {
    title: "சந்தை பகுப்பாய்வாளர்",
    description: "இந்தியா முழுவதிலும் உள்ள ஏபிஎம்சி ஒழுங்குமுறை விற்பனைக்கூட சந்தை விலைகளைக் கண்காணிக்கவும்.",
    faqTitle: "அடிக்கடி கேட்கப்படும் கேள்விகள்",
    tabs: {
      livePrices: "நேரடி விலைகள்",
      priceAlerts: "விலை எச்சரிக்கை"
    },
    livePrices: {
      title: "நேரடி ஏபிஎம்சி சந்தை விலைகள்",
      officialAgmarknetFeed: "அதிகாரப்பூர்வ அக்மார்க்நெட் தகவல்",
      subtitlePrefix: "தினசரி விலை பரிவர்த்தனை ஆதாரம்:",
      fetchingMandis: "சந்தை விலைகள் பெறப்படுகின்றன...",
      refreshLivePrices: "விலைகளைப் புதுப்பிக்கவும்",
      selectState: "1. மாநிலத்தைத் தேர்ந்தெடுக்கவும்",
      selectDistrict: "2. மாவட்டத்தைத் தேர்ந்தெடுக்கவும்",
      selectCrop: "3. பயிரைத் தேர்ந்தெடுக்கவும்",
      searchMandiCrop: "4. சந்தை அல்லது பயிரைத் தேடுங்கள்",
      searchPlaceholder: "பயிர் அல்லது சந்தையைத் தேடுங்கள் (எ.கா. நெல், மதுரை, தக்காளி)...",
      allStates: "அனைத்து மாநிலங்கள்",
      allDistricts: "அனைத்து மாவட்டங்கள்",
      allCrops: "அனைத்துப் பயிர்கள்",
      allSources: "அனைத்து ஆதாரங்கள்",
      stateLabel: "மாநிலம்",
      districtLabel: "மாவட்டம்",
      cropLabel: "பயிர்",
      matchingMandis: "பொருந்தும் சந்தைகள்",
      showingRecords: "{{count}} சரிபார்க்கப்பட்ட பதிவுகள் காட்டப்படுகின்றன",
      resetFilters: "வடிகட்டிகளை மீட்டமைக்கவும்",
      officialRates: "அதிகாரப்பூர்வ ஏபிஎம்சி சந்தை விலைகள்",
      offlineBenchmark: "ஆஃப்லைன் ஒப்பீட்டு முறை",
      commodityVariety: "பயிர் மற்றும் ரகம்",
      mandiYard: "சந்தை முற்றம்",
      arrivalDate: "வரத்து தேதி",
      modalPrice: "சராசரி விலை (₹/குவிண்டால்)",
      minMaxPrice: "குறைந்தபட்சம் - அதிகபட்சம் (₹/குவிண்டால்)",
      officialSource: "அதிகாரப்பூர்வ ஆதாரம்",
      noRecordsFound: "தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளுக்கு பதிவுகள் எதுவும் கிடைக்கவில்லை.",
      unavailableMessage: "நேரடி சந்தை விலை விவரங்கள் தற்போது கிடைக்கவில்லை.",
      retry: "மீண்டும் முயற்சிக்கவும்"
    },
    faqs: {
      q1: "இந்த சந்தை விலைகள் எப்போது புதுப்பிக்கப்படுகின்றன?",
      a1: "மத்திய அரசின் அக்மார்க்நெட் மற்றும் மாநில சந்தை குழுக்களிலிருந்து தினசரி புதுப்பிக்கப்படுகின்றன.",
      q2: "மாதிரி விலை (Modal Price) என்றால் என்ன?",
      a2: "அன்றைய தினம் சந்தையில் அதிக அளவு பயிர் விற்பனையான சராசரி விலை.",
      q3: "எனது பயிர்களுக்கு விலை எச்சரிக்கைகளை அமைக்க முடியுமா?",
      a3: "ஆம், விலை எச்சரிக்கை பிரிவில் உங்கள் இலக்கு விலையை அமைத்துக் கொள்ளலாம்.",
      q4: "இந்த விலைகள் அதிகாரப்பூர்வமானவையா?",
      a4: "ஆம், இவை அரசு ஒழுங்குமுறை விற்பனைக்கூடங்களின் அதிகாரப்பூர்வ பதிவுகள் ஆகும்."
    }
  }
};

for (const lang of languages) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.marketAnalyst = marketAnalystTranslations[lang];
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    console.log(`Enriched ${lang}.json with marketAnalyst.`);
  }
}
