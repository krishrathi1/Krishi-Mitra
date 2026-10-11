/**
 * @fileOverview Verified Indian Agricultural Crop Database & Strict Eligibility Filter.
 * Sourced from ICAR (Indian Council of Agricultural Research), State Agricultural Universities (SAUs),
 * and DAC&FW (Department of Agriculture, Cooperation and Farmers Welfare).
 *
 * Enforces strict agronomic eligibility before AI reasoning:
 * 1. Season matching (Kharif, Rabi, Zaid)
 * 2. Farm type & water availability (Rainfed / Irrigated, drought tolerance)
 * 3. Soil compatibility (Alluvial, Loamy, Black Cotton, Red, Sandy, Clay)
 * 4. Soil pH tolerance
 * 5. Agro-climatic zone & state compatibility
 */

export interface VerifiedCrop {
  id: string;
  name: string;
  scientificName: string;
  hindiName: string;
  punjabiName: string;
  marathiName: string;
  bengaliName: string;
  tamilName: string;
  seasons: ('kharif' | 'rabi' | 'zaid')[];
  soilTypes: string[]; // ['alluvial', 'loamy', 'black', 'red', 'sandy', 'clay']
  minPh: number;
  maxPh: number;
  waterRequirement: 'low' | 'medium' | 'high';
  farmTypes: ('irrigated' | 'rainfed')[];
  growingPeriodDays: string;
  sowingWindow: {
    kharif?: string;
    rabi?: string;
    zaid?: string;
  };
  typicalYieldRangePerAcre: {
    min: number;
    max: number;
    unit: string;
  };
  budgetCategory: 'low' | 'medium' | 'high';
  suitableStates?: string[]; // If restricted to specific agro-climatic zones
  incompatibleStates?: string[];
  keyAgronomicBenefits: string[];
  majorRisks: string[];
  source: string;
}

export const VERIFIED_CROPS_DATABASE: VerifiedCrop[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    scientificName: 'Triticum aestivum',
    hindiName: 'गेहूं (Wheat)',
    punjabiName: 'ਕਣਕ (Wheat)',
    marathiName: 'गहू (Wheat)',
    bengaliName: 'গম (Wheat)',
    tamilName: 'கோதுமை (Wheat)',
    seasons: ['rabi'],
    soilTypes: ['alluvial', 'loamy', 'clay_loam', 'black'],
    minPh: 6.0,
    maxPh: 7.8,
    waterRequirement: 'medium',
    farmTypes: ['irrigated'],
    growingPeriodDays: '110-130 days',
    sowingWindow: { rabi: 'Nov 1 - Nov 25' },
    typicalYieldRangePerAcre: { min: 1800, max: 2400, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Bihar', 'Gujarat', 'Uttarakhand', 'Himachal Pradesh'],
    incompatibleStates: ['Kerala', 'Tamil Nadu', 'Goa', 'Andhra Pradesh'],
    keyAgronomicBenefits: ['Assured government MSP procurement', 'High staple grain demand', 'Excellent fodder byproduct (Bhusa)'],
    majorRisks: ['Terminal heat stress in late March', 'Yellow rust fungal susceptibility'],
    source: 'ICAR-IIWBR (Indian Institute of Wheat & Barley Research)'
  },
  {
    id: 'rice',
    name: 'Paddy / Basmati Rice',
    scientificName: 'Oryza sativa',
    hindiName: 'धान / बासमती (Paddy)',
    punjabiName: 'ਝੋਨਾ / ਬਾਸਮਤੀ (Paddy)',
    marathiName: 'भात / तांदूळ (Rice)',
    bengaliName: 'ধান / আমন (Paddy)',
    tamilName: 'நெல் (Paddy / Rice)',
    seasons: ['kharif'],
    soilTypes: ['clay', 'clay_loam', 'alluvial', 'loamy'],
    minPh: 5.5,
    maxPh: 7.5,
    waterRequirement: 'high',
    farmTypes: ['irrigated'],
    growingPeriodDays: '115-140 days',
    sowingWindow: { kharif: 'June 15 - July 20' },
    typicalYieldRangePerAcre: { min: 2000, max: 2800, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Punjab', 'Haryana', 'Uttar Pradesh', 'West Bengal', 'Bihar', 'Odisha', 'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Chhattisgarh', 'Madhya Pradesh', 'Assam', 'Uttarakhand'],
    keyAgronomicBenefits: ['Top national staple with MSP support', 'High commercial basmati export demand', 'High per-acre yield'],
    majorRisks: ['High groundwater depletion', 'Blast and sheath blight disease'],
    source: 'ICAR-NRRI (National Rice Research Institute)'
  },
  {
    id: 'soybean',
    name: 'Soybean',
    scientificName: 'Glycine max',
    hindiName: 'सोयाबीन (Soybean)',
    punjabiName: 'ਸੋਇਆਬੀਨ (Soybean)',
    marathiName: 'सोयाबीन (Soybean)',
    bengaliName: 'সয়াবিন (Soybean)',
    tamilName: 'சோயாபீன் (Soybean)',
    seasons: ['kharif'],
    soilTypes: ['black', 'clay_loam', 'loamy'],
    minPh: 6.0,
    maxPh: 7.8,
    waterRequirement: 'medium',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '90-105 days',
    sowingWindow: { kharif: 'June 20 - July 15' },
    typicalYieldRangePerAcre: { min: 700, max: 1100, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Karnataka', 'Telangana', 'Gujarat', 'Chhattisgarh'],
    keyAgronomicBenefits: ['Legume nitrogen-fixation enriches soil for Rabi wheat', 'Short 90-100 day duration', 'Strong oilseed and animal feed market'],
    majorRisks: ['Excess waterlogging during seedling emergence', 'Yellow mosaic virus'],
    source: 'ICAR-IISR (Indian Institute of Soybean Research, Indore)'
  },
  {
    id: 'cotton',
    name: 'BT Cotton',
    scientificName: 'Gossypium hirsutum',
    hindiName: 'कपास / नरमा (Cotton)',
    punjabiName: 'ਨਰਮਾ / ਕਪਾਹ (Cotton)',
    marathiName: 'कापूस (Cotton)',
    bengaliName: 'তুলা (Cotton)',
    tamilName: 'பருத்தி (Cotton)',
    seasons: ['kharif'],
    soilTypes: ['black', 'alluvial', 'loamy'],
    minPh: 6.0,
    maxPh: 8.0,
    waterRequirement: 'medium',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '150-180 days',
    sowingWindow: { kharif: 'May 1 - June 15' },
    typicalYieldRangePerAcre: { min: 800, max: 1400, unit: 'kg/acre' },
    budgetCategory: 'high',
    suitableStates: ['Gujarat', 'Maharashtra', 'Telangana', 'Andhra Pradesh', 'Punjab', 'Haryana', 'Rajasthan', 'Madhya Pradesh', 'Karnataka'],
    keyAgronomicBenefits: ['Major commercial cash crop fetching ₹7,000+/quintal', 'High export value', 'Drought-tolerant root system'],
    majorRisks: ['Pink bollworm infestation', 'Whitefly attack in early stages'],
    source: 'ICAR-CICR (Central Institute for Cotton Research, Nagpur)'
  },
  {
    id: 'chickpea',
    name: 'Chickpea / Desi Chana',
    scientificName: 'Cicer arietinum',
    hindiName: 'चना (Chickpea)',
    punjabiName: 'ਛੋਲੇ (Gram)',
    marathiName: 'हरभरा (Chana)',
    bengaliName: 'ছোলা (Gram)',
    tamilName: 'கொண்டைக்கடலை (Chickpea)',
    seasons: ['rabi'],
    soilTypes: ['black', 'loamy', 'sandy_loam', 'clay_loam'],
    minPh: 6.0,
    maxPh: 8.2,
    waterRequirement: 'low',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '100-120 days',
    sowingWindow: { rabi: 'Oct 15 - Nov 20' },
    typicalYieldRangePerAcre: { min: 700, max: 1100, unit: 'kg/acre' },
    budgetCategory: 'low',
    suitableStates: ['Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Uttar Pradesh', 'Karnataka', 'Gujarat', 'Andhra Pradesh', 'Haryana'],
    keyAgronomicBenefits: ['Low water requirement (only 1-2 irrigations)', 'Biological nitrogen fixation', 'Consistently high mandi pulses prices'],
    majorRisks: ['Wilt disease in heavy waterlogged soils', 'Pod borer (Helicoverpa) at flowering'],
    source: 'ICAR-IIPR (Indian Institute of Pulses Research, Kanpur)'
  },
  {
    id: 'mustard',
    name: 'Mustard / Sarson',
    scientificName: 'Brassica juncea',
    hindiName: 'सरसों / राई (Mustard)',
    punjabiName: 'ਸਰ੍ਹੋਂ (Mustard)',
    marathiName: 'मोहरी (Mustard)',
    bengaliName: 'সরিষা (Mustard)',
    tamilName: 'கடுகு (Mustard)',
    seasons: ['rabi'],
    soilTypes: ['loamy', 'sandy_loam', 'alluvial'],
    minPh: 6.0,
    maxPh: 7.8,
    waterRequirement: 'low',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '105-125 days',
    sowingWindow: { rabi: 'Oct 1 - Oct 25' },
    typicalYieldRangePerAcre: { min: 650, max: 1000, unit: 'kg/acre' },
    budgetCategory: 'low',
    suitableStates: ['Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'Haryana', 'Punjab', 'West Bengal', 'Bihar', 'Gujarat'],
    keyAgronomicBenefits: ['Thrives in low moisture with high oil content', 'Low investment input cost', 'High domestic demand for edible mustard oil'],
    majorRisks: ['Aphid attack during cloudy weather', 'White rust infection'],
    source: 'ICAR-DRMR (Directorate of Rapeseed-Mustard Research, Bharatpur)'
  },
  {
    id: 'maize',
    name: 'Hybrid Maize / Corn',
    scientificName: 'Zea mays',
    hindiName: 'मक्का (Maize)',
    punjabiName: 'ਮੱਕੀ (Maize)',
    marathiName: 'मका (Maize)',
    bengaliName: 'ভুট্টা (Maize)',
    tamilName: 'மக்காச்சோளம் (Maize)',
    seasons: ['kharif', 'rabi', 'zaid'],
    soilTypes: ['alluvial', 'loamy', 'red', 'black'],
    minPh: 5.8,
    maxPh: 7.5,
    waterRequirement: 'medium',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '85-110 days',
    sowingWindow: { kharif: 'June 20 - July 20', rabi: 'Oct 15 - Nov 15', zaid: 'Feb 15 - March 15' },
    typicalYieldRangePerAcre: { min: 1800, max: 2600, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Karnataka', 'Madhya Pradesh', 'Bihar', 'Tamil Nadu', 'Maharashtra', 'Telangana', 'Andhra Pradesh', 'Rajasthan', 'Uttar Pradesh', 'Punjab'],
    keyAgronomicBenefits: ['Consumes 60% less water than paddy', 'Heavy demand for poultry feed and ethanol production', 'Versatile multi-season suitability'],
    majorRisks: ['Fall armyworm (FAW) pest damage', 'Stagnant waterlogging sensitivity'],
    source: 'ICAR-IIMR (Indian Institute of Maize Research, Ludhiana)'
  },
  {
    id: 'millet',
    name: 'Pearl Millet / Bajra',
    scientificName: 'Pennisetum glaucum',
    hindiName: 'बाजरा (Pearl Millet)',
    punjabiName: 'ਬਾਜਰਾ (Bajra)',
    marathiName: 'बाजरी (Bajra)',
    bengaliName: 'বাজরা (Bajra)',
    tamilName: 'கம்பு (Bajra)',
    seasons: ['kharif', 'zaid'],
    soilTypes: ['sandy', 'sandy_loam', 'loamy', 'red'],
    minPh: 5.5,
    maxPh: 8.5,
    waterRequirement: 'low',
    farmTypes: ['rainfed', 'irrigated'],
    growingPeriodDays: '75-90 days',
    sowingWindow: { kharif: 'June 15 - July 15', zaid: 'March 1 - March 25' },
    typicalYieldRangePerAcre: { min: 900, max: 1500, unit: 'kg/acre' },
    budgetCategory: 'low',
    suitableStates: ['Rajasthan', 'Uttar Pradesh', 'Gujarat', 'Haryana', 'Madhya Pradesh', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
    keyAgronomicBenefits: ['Ultra drought-resilient and heat-hardy crop', 'Nutrient dense superfood (Millets Mission Shree Anna)', 'Low fertilizer input requirement'],
    majorRisks: ['Downy mildew during continuous cloudy weather', 'Bird damage at grain filling'],
    source: 'ICAR-IIMR (Indian Institute of Millets Research, Hyderabad)'
  },
  {
    id: 'mungbean',
    name: 'Green Gram / Moong',
    scientificName: 'Vigna radiata',
    hindiName: 'मूंग दाल (Green Gram)',
    punjabiName: 'ਮੂੰਗੀ (Moong)',
    marathiName: 'मूग (Moong)',
    bengaliName: 'মুগ ডাল (Moong)',
    tamilName: 'பாசிப்பயறு (Green Gram)',
    seasons: ['kharif', 'zaid'],
    soilTypes: ['loamy', 'alluvial', 'black', 'sandy_loam'],
    minPh: 6.2,
    maxPh: 7.8,
    waterRequirement: 'low',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '60-70 days',
    sowingWindow: { kharif: 'June 25 - July 15', zaid: 'March 15 - April 10' },
    typicalYieldRangePerAcre: { min: 400, max: 700, unit: 'kg/acre' },
    budgetCategory: 'low',
    suitableStates: ['Madhya Pradesh', 'Rajasthan', 'Maharashtra', 'Karnataka', 'Gujarat', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Bihar', 'Tamil Nadu', 'Odisha'],
    keyAgronomicBenefits: ['Short 60-day crop cycle enabling catch-crop rotation', 'Top pulses market prices (₹8,000+/q)', 'Adds organic nitrogen to soil'],
    majorRisks: ['Yellow mosaic virus transmitted by whitefly', 'Pod shatter if harvest delayed'],
    source: 'ICAR-IIPR (Indian Institute of Pulses Research)'
  },
  {
    id: 'blackgram',
    name: 'Black Gram / Urad',
    scientificName: 'Vigna mungo',
    hindiName: 'उड़द दाल (Black Gram)',
    punjabiName: 'ਮਾਂਹ ਦੀ ਦਾਲ (Urad)',
    marathiName: 'उडीद (Urad)',
    bengaliName: 'মাষকলাই (Urad)',
    tamilName: 'உளுந்து (Black Gram)',
    seasons: ['kharif', 'zaid'],
    soilTypes: ['black', 'clay_loam', 'loamy', 'alluvial'],
    minPh: 6.0,
    maxPh: 7.8,
    waterRequirement: 'low',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '70-85 days',
    sowingWindow: { kharif: 'June 20 - July 15', zaid: 'March 1 - March 20' },
    typicalYieldRangePerAcre: { min: 450, max: 750, unit: 'kg/acre' },
    budgetCategory: 'low',
    suitableStates: ['Madhya Pradesh', 'Uttar Pradesh', 'Andhra Pradesh', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Karnataka'],
    keyAgronomicBenefits: ['High industrial pulse demand (papad, dal)', 'Thrives in black soil rotation', 'Improves soil health and nitrogen retention'],
    majorRisks: ['Leaf crinkle virus', 'Moisture stress at pod development'],
    source: 'ICAR-IIPR (Indian Institute of Pulses Research)'
  },
  {
    id: 'pigeonpeas',
    name: 'Pigeon Pea / Arhar / Tur',
    scientificName: 'Cajanus cajan',
    hindiName: 'अरहर / तुअर दाल (Arhar)',
    punjabiName: 'ਅਰਹਰ (Arhar)',
    marathiName: 'तूर डाळ (Tur Dal)',
    bengaliName: 'অড়হর (Arhar)',
    tamilName: 'துவரை (Tur Dal)',
    seasons: ['kharif'],
    soilTypes: ['black', 'loamy', 'alluvial', 'red'],
    minPh: 6.0,
    maxPh: 8.0,
    waterRequirement: 'low',
    farmTypes: ['rainfed', 'irrigated'],
    growingPeriodDays: '150-180 days',
    sowingWindow: { kharif: 'June 15 - July 15' },
    typicalYieldRangePerAcre: { min: 600, max: 1000, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Maharashtra', 'Madhya Pradesh', 'Karnataka', 'Uttar Pradesh', 'Gujarat', 'Telangana', 'Jharkhand', 'Bihar'],
    keyAgronomicBenefits: ['Deep taproot tolerates extended dry spells', 'High MSP procurement support', 'Excellent for intercropping with soybean/cotton'],
    majorRisks: ['Sterility mosaic disease', 'Fusarium wilt in poorly drained fields'],
    source: 'ICAR-IIPR (Indian Institute of Pulses Research)'
  },
  {
    id: 'sugarcane',
    name: 'Sugarcane',
    scientificName: 'Saccharum officinarum',
    hindiName: 'गन्ना (Sugarcane)',
    punjabiName: 'ਗੰਨਾ (Sugarcane)',
    marathiName: 'ऊस (Sugarcane)',
    bengaliName: 'আখ (Sugarcane)',
    tamilName: 'கரும்பு (Sugarcane)',
    seasons: ['kharif', 'zaid'],
    soilTypes: ['alluvial', 'black', 'loamy', 'clay_loam'],
    minPh: 6.5,
    maxPh: 7.8,
    waterRequirement: 'high',
    farmTypes: ['irrigated'],
    growingPeriodDays: '300-365 days',
    sowingWindow: { kharif: 'Feb - March (Spring) or Oct - Nov (Autumn)' },
    typicalYieldRangePerAcre: { min: 25000, max: 40000, unit: 'kg/acre' },
    budgetCategory: 'high',
    suitableStates: ['Uttar Pradesh', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Bihar', 'Gujarat', 'Punjab', 'Haryana', 'Uttarakhand', 'Andhra Pradesh'],
    keyAgronomicBenefits: ['Guaranteed Statutory Minimum Price (FRP/SAP) from sugar mills', 'High biomass ratoon productivity for 2-3 years', 'High revenue realization'],
    majorRisks: ['Heavy water consumption', 'Red rot disease'],
    source: 'ICAR-IISR (Indian Institute of Sugarcane Research, Lucknow)'
  },
  {
    id: 'potato',
    name: 'Potato',
    scientificName: 'Solanum tuberosum',
    hindiName: 'आलू (Potato)',
    punjabiName: 'ਆਲੂ (Potato)',
    marathiName: 'बटाटा (Potato)',
    bengaliName: 'আলু (Potato)',
    tamilName: 'உருளைக்கிழங்கு (Potato)',
    seasons: ['rabi'],
    soilTypes: ['sandy_loam', 'loamy', 'alluvial'],
    minPh: 5.2,
    maxPh: 6.8,
    waterRequirement: 'medium',
    farmTypes: ['irrigated'],
    growingPeriodDays: '80-100 days',
    sowingWindow: { rabi: 'Oct 15 - Nov 10' },
    typicalYieldRangePerAcre: { min: 8000, max: 14000, unit: 'kg/acre' },
    budgetCategory: 'high',
    suitableStates: ['Uttar Pradesh', 'West Bengal', 'Bihar', 'Punjab', 'Gujarat', 'Madhya Pradesh', 'Haryana', 'Assam'],
    keyAgronomicBenefits: ['High cash return per acre in short 90 days', 'Thrives in well-drained sandy loam', 'High cold storage liquidity'],
    majorRisks: ['Late blight fungal blight during humid cloudy spells', 'Price crash during bumper harvest'],
    source: 'ICAR-CPRI (Central Potato Research Institute, Shimla)'
  },
  {
    id: 'groundnut',
    name: 'Groundnut / Peanut',
    scientificName: 'Arachis hypogaea',
    hindiName: 'मूंगफली (Groundnut)',
    punjabiName: 'ਮੂੰਗਫਲੀ (Groundnut)',
    marathiName: 'भुईमूग (Groundnut)',
    bengaliName: 'চিনাবাদাম (Groundnut)',
    tamilName: 'வேர்க்கடலை (Groundnut)',
    seasons: ['kharif', 'zaid'],
    soilTypes: ['sandy_loam', 'red', 'loamy'],
    minPh: 5.8,
    maxPh: 7.2,
    waterRequirement: 'low',
    farmTypes: ['irrigated', 'rainfed'],
    growingPeriodDays: '105-125 days',
    sowingWindow: { kharif: 'June 15 - July 10', zaid: 'Jan 15 - Feb 15' },
    typicalYieldRangePerAcre: { min: 800, max: 1400, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Gujarat', 'Rajasthan', 'Tamil Nadu', 'Andhra Pradesh', 'Karnataka', 'Madhya Pradesh', 'Maharashtra'],
    keyAgronomicBenefits: ['High oil content and strong confectionery market', 'Pod development benefits from friable sandy-loam soils', 'Fixes atmospheric nitrogen'],
    majorRisks: ['Tikka leaf spot disease', 'Aflatoxin contamination if dried improperly'],
    source: 'ICAR-DGR (Directorate of Groundnut Research, Junagadh)'
  },
  {
    id: 'lentil',
    name: 'Lentil / Masoor',
    scientificName: 'Lens culinaris',
    hindiName: 'मसूर दाल (Lentil)',
    punjabiName: 'ਮਸਰਾਂ ਦੀ ਦਾਲ (Lentil)',
    marathiName: 'मसूर (Lentil)',
    bengaliName: 'মসুর ডাল (Lentil)',
    tamilName: 'மசூர் பருப்பு (Lentil)',
    seasons: ['rabi'],
    soilTypes: ['loamy', 'alluvial', 'clay_loam'],
    minPh: 6.0,
    maxPh: 7.5,
    waterRequirement: 'low',
    farmTypes: ['rainfed', 'irrigated'],
    growingPeriodDays: '100-115 days',
    sowingWindow: { rabi: 'Oct 20 - Nov 15' },
    typicalYieldRangePerAcre: { min: 500, max: 850, unit: 'kg/acre' },
    budgetCategory: 'low',
    suitableStates: ['Madhya Pradesh', 'Uttar Pradesh', 'Bihar', 'West Bengal', 'Rajasthan'],
    keyAgronomicBenefits: ['Thrives in cooler winter weather with minimal water', 'Strong MSP and market liquidity', 'Low fertilizer input'],
    majorRisks: ['Rust and wilt in water-saturated soils', 'Aphids at pod formation'],
    source: 'ICAR-IIPR (Indian Institute of Pulses Research)'
  },
  {
    id: 'watermelon',
    name: 'Watermelon',
    scientificName: 'Citrullus lanatus',
    hindiName: 'तरबूज (Watermelon)',
    punjabiName: 'ਤਰਬੂਜ਼ (Watermelon)',
    marathiName: 'कलिंगड (Watermelon)',
    bengaliName: 'তরমুজ (Watermelon)',
    tamilName: 'தர்பூசணி (Watermelon)',
    seasons: ['zaid'],
    soilTypes: ['sandy', 'sandy_loam', 'alluvial', 'loamy'],
    minPh: 6.0,
    maxPh: 7.2,
    waterRequirement: 'medium',
    farmTypes: ['irrigated'],
    growingPeriodDays: '70-85 days',
    sowingWindow: { zaid: 'Feb 15 - March 20' },
    typicalYieldRangePerAcre: { min: 10000, max: 18000, unit: 'kg/acre' },
    budgetCategory: 'medium',
    suitableStates: ['Uttar Pradesh', 'Punjab', 'Haryana', 'Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Karnataka', 'Andhra Pradesh', 'West Bengal', 'Tamil Nadu'],
    keyAgronomicBenefits: ['Short 75-day turnaround yielding ₹80,000+/acre', 'High summer consumer demand', 'Responds well to drip fertigation'],
    majorRisks: ['Fusarium wilt', 'Fruit fly damage during ripening'],
    source: 'ICAR-IIHR (Indian Institute of Horticultural Research, Bengaluru)'
  }
];

export interface CropFilterInput {
  season?: string;
  soilType?: string;
  soilPh?: number;
  farmType?: 'irrigated' | 'rainfed';
  waterSource?: string;
  state?: string;
  budget?: string;
  cropPreference?: string;
  weather?: {
    temperatureC: number;
    rainfallMm: number;
  };
}

/**
 * Normalizes soil string into standard keys
 */
function normalizeSoilKey(soilStr?: string): string[] {
  if (!soilStr) return [];
  const s = soilStr.toLowerCase();
  const matched: string[] = [];
  if (s.includes('black') || s.includes('काली') || s.includes('regur')) matched.push('black');
  if (s.includes('alluvial') || s.includes('जलोढ़') || s.includes('terai')) matched.push('alluvial');
  if (s.includes('loam') || s.includes('दोमट')) matched.push('loamy');
  if (s.includes('clay') || s.includes('मटियारी') || s.includes('चिकनी')) matched.push('clay', 'clay_loam');
  if (s.includes('sandy') || s.includes('रेतीली') || s.includes('बलुई')) matched.push('sandy', 'sandy_loam');
  if (s.includes('red') || s.includes('लाल')) matched.push('red');
  return matched;
}

/**
 * Hard Agronomic Eligibility Filter.
 * Eliminates crops that cannot biologically or agronomically succeed under the farmer's conditions.
 */
export function filterEligibleCrops(input: CropFilterInput): VerifiedCrop[] {
  const normSeason = (input.season || 'kharif').toLowerCase();
  const seasonKey: 'kharif' | 'rabi' | 'zaid' = 
    normSeason.includes('rabi') || normSeason.includes('winter') || normSeason.includes('रबी')
      ? 'rabi'
      : normSeason.includes('zaid') || normSeason.includes('summer') || normSeason.includes('जायद')
        ? 'zaid'
        : 'kharif';

  const userSoilKeys = normalizeSoilKey(input.soilType);
  const isIrrigated = input.farmType === 'irrigated';
  const waterSource = (input.waterSource || '').toLowerCase();
  const rainOnly = !isIrrigated || waterSource.includes('rain') || waterSource.includes('वर्षा');
  const userState = input.state ? input.state.trim() : '';

  const candidates = VERIFIED_CROPS_DATABASE.filter((crop) => {
    // 1. Season constraint (Hard filter)
    if (!crop.seasons.includes(seasonKey)) {
      return false;
    }

    // 2. Water / Farm Type constraint (Hard filter)
    // High water crops cannot grow in rainfed dry fields with no irrigation
    if (rainOnly && crop.waterRequirement === 'high') {
      return false;
    }
    if (!isIrrigated && !crop.farmTypes.includes('rainfed')) {
      return false;
    }

    // 3. Soil compatibility constraint (Hard filter if soil is provided)
    if (userSoilKeys.length > 0) {
      const hasSoilMatch = userSoilKeys.some((userSoil) =>
        crop.soilTypes.some((cropSoil) => cropSoil.includes(userSoil) || userSoil.includes(cropSoil))
      );
      if (!hasSoilMatch) {
        return false;
      }
    }

    // 4. Soil pH constraint (Hard filter if pH provided)
    if (typeof input.soilPh === 'number' && input.soilPh > 0) {
      if (input.soilPh < crop.minPh - 0.4 || input.soilPh > crop.maxPh + 0.4) {
        return false;
      }
    }

    // 5. State / Agro-climatic incompatibility constraint (Hard filter)
    if (userState && crop.incompatibleStates && crop.incompatibleStates.some(s => s.toLowerCase() === userState.toLowerCase())) {
      return false;
    }

    // 6. Budget constraint (If budget is strictly low, eliminate high capital crops like sugarcane/commercial orchards)
    const budgetStr = (input.budget || '').toLowerCase();
    const isLowBudget = budgetStr.includes('low') || budgetStr.includes('कम') || budgetStr.includes('सीमित');
    if (isLowBudget && crop.budgetCategory === 'high') {
      return false;
    }

    return true;
  });

  return candidates;
}
