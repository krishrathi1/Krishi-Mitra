
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { recommendCrops, type RecommendCropsOutput } from '@/ai/flows/recommend-crops';
import { Bot, Leaf, Droplets, Sun, Sparkles, ArrowRight, Mic, Square, CheckCircle, CalendarDays, Wheat, Carrot, Grape, MapPin, TrendingUp, RefreshCw, Layers, Coins, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/contexts/language-context';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/contexts/location-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { LocationPicker, type LocationData } from '@/components/location-picker';
import {
  getSoilsForState,
  getSoilSelectLabel,
  type SupportedLanguage,
} from '@/lib/soil-data';
import { Badge } from '@/components/ui/badge';

const iconMap = {
  Leaf: <Leaf className="h-8 w-8 text-primary" />,
  Sprout: <Icons.sprout className="h-8 w-8 text-primary" />,
  Carrot: <Carrot className="h-8 w-8 text-primary" />,
  Wheat: <Wheat className="h-8 w-8 text-primary" />,
  Grape: <Grape className="h-8 w-8 text-primary" />,
};
type CropIcon = keyof typeof iconMap;

const RecommendCropsInputClientSchema = z.object({
  location: z.string().min(1),
  farmType: z.enum(['irrigated', 'rainfed']),
  landSize: z.string().min(1),
  soilType: z.string().optional(),
  waterSource: z.string().optional(),
  season: z.string().optional(),
  previousCrop: z.string().optional(),
  budget: z.string().optional(),
  cropPreference: z.string().optional(),
  language: z.string(),
  // Extended location fields
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

const SpeechRecognition =
  (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition));

type RecommendationFormValues = z.infer<typeof RecommendCropsInputClientSchema>;

export function CropRecommenderClient() {
  const { t, language } = useTranslation();
  const { userProfile } = useAuth();
  const lang = language as SupportedLanguage;
  const isHi = language === 'hi';

  const { location: sharedLocation, setLocation: setSharedLocation } = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecommendCropsOutput | null>(null);
  const [recordingField, setRecordingField] = useState<keyof RecommendationFormValues | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  const { handleSubmit, control, setValue, watch, formState: { errors } } = useForm<RecommendationFormValues>({
    resolver: zodResolver(RecommendCropsInputClientSchema),
    defaultValues: {
      location: '',
      farmType: 'irrigated',
      landSize: '',
      soilType: '',
      waterSource: '',
      season: 'kharif',
      previousCrop: '',
      budget: '',
      cropPreference: '',
      language: language,
    }
  });

  useEffect(() => {
    if (sharedLocation?.displayName && !watch('location')) {
      setValue('location', sharedLocation.displayName);
      if (sharedLocation.latitude) setValue('latitude', sharedLocation.latitude);
      if (sharedLocation.longitude) setValue('longitude', sharedLocation.longitude);
      if (sharedLocation.state) setValue('state', sharedLocation.state);
      if (sharedLocation.district) setValue('district', sharedLocation.district);
      if (sharedLocation.city) setValue('city', sharedLocation.city);
      if (sharedLocation.country) setValue('country', sharedLocation.country);
      setSelectedLocation({
        displayName: sharedLocation.displayName,
        latitude: sharedLocation.latitude || 23.2,
        longitude: sharedLocation.longitude || 77.08,
        state: sharedLocation.state || null,
        district: sharedLocation.district || null,
        city: sharedLocation.city || null,
        country: sharedLocation.country || 'India',
      });
    } else if (userProfile?.location && !watch('location')) {
      setValue('location', userProfile.location);
    }
    setValue('language', language);
  }, [sharedLocation, userProfile, setValue, language, watch]);

  // ── Location-aware soil types ──────────────────────────────────────────────
  const currentState = selectedLocation?.state || null;
  const soils = getSoilsForState(currentState);

  // Reset soil type when state changes
  useEffect(() => {
    setValue('soilType', '');
  }, [currentState, setValue]);

  // ── Handle map location change ─────────────────────────────────────────────
  const handleLocationChange = (locationData: LocationData) => {
    setSelectedLocation(locationData);
    setSharedLocation({
      displayName: locationData.displayName,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      state: locationData.state || null,
      district: locationData.district || null,
      city: locationData.city || null,
      country: locationData.country || 'India',
    });
    setValue('location', locationData.displayName);
    setValue('latitude', locationData.latitude);
    setValue('longitude', locationData.longitude);
    setValue('state', locationData.state || '');
    setValue('district', locationData.district || '');
    setValue('city', locationData.city || '');
    setValue('country', locationData.country || 'India');
  };

  // ── Voice input ────────────────────────────────────────────────────────────
  const handleMicClick = (field: keyof RecommendationFormValues) => {
    if (!SpeechRecognition) {
      toast({ title: t('toast.browserNotSupported'), description: t('toast.noVoiceSupport'), variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    const langMap: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', mr: 'mr-IN', bn: 'bn-IN', ta: 'ta-IN', kn: 'kn-IN', bho: 'bho-IN' };
    recognition.lang = langMap[language] || 'en-IN';
    recognition.onstart = () => setRecordingField(field);
    recognition.onresult = (event: any) => setValue(field, event.results[0][0].transcript);
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        toast({ title: t('toast.noSpeechDetected'), description: t('toast.tryAgain'), variant: "destructive" });
      } else {
        toast({ title: t('toast.voiceError'), description: event.error, variant: "destructive" });
      }
    };
    recognition.onend = () => setRecordingField(null);
    recognition.start();
  };

  const onSubmit = async (data: RecommendationFormValues) => {
    setIsLoading(true);
    setResult(null);
    try {
      const recommendationResult = await recommendCrops({
        ...data,
        language: language, // always use current selected language
      });
      setResult(recommendationResult);
    } catch (error: any) {
      console.error(error);
      const isHi = language === 'hi';
      toast({
        title: isHi ? 'AI सिफारिशें विफल' : 'Recommendation Generation Failed',
        description: error?.message || (isHi ? 'वर्तमान में AI सिफारिशें उत्पन्न करने में असमर्थ। कृपया पुनः प्रयास करें।' : 'Unable to generate AI recommendations right now. Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const waterSources = ["borewell", "canal", "rain-only", "tank", "river"];
  const seasons = ["kharif", "rabi", "zaid"];

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <Card className="lg:col-span-5 xl:col-span-4 shadow-sm border border-border/80">
        <CardHeader>
          <CardTitle className="font-headline font-bold text-xl">{t('cropRecommender.client.formTitle')}</CardTitle>
          <CardDescription className="text-xs leading-relaxed">{t('cropRecommender.client.formDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* ── STEP 1: Location Picker ─────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {t('cropRecommender.client.locationLabel') || t('profile.location')}
              </Label>
              <LocationPicker
                onLocationChange={handleLocationChange}
                value={watch('location')}
              />
              {errors.location && (
                <p className="text-xs text-destructive">{t('cropRecommender.client.locationRequired') || 'Location is required.'}</p>
              )}
            </div>

            {/* ── STEP 2: Farm Type ─────────────────────────────────────────── */}
            <div>
              <Label className="text-sm font-medium">{t('cropRecommender.client.farmType')}</Label>
              <Controller
                name="farmType"
                control={control}
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2 mt-2">
                    <Label
                      htmlFor="irrigated"
                      className="flex items-center gap-2 p-2.5 sm:p-3 border border-border/80 rounded-lg has-[:checked]:bg-secondary has-[:checked]:border-primary/60 cursor-pointer min-w-0 transition-all hover:bg-muted/50"
                    >
                      <RadioGroupItem value="irrigated" id="irrigated" className="shrink-0" />
                      <Droplets className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs sm:text-sm font-medium truncate">{t('cropRecommender.client.irrigated')}</span>
                    </Label>
                    <Label
                      htmlFor="rainfed"
                      className="flex items-center gap-2 p-2.5 sm:p-3 border border-border/80 rounded-lg has-[:checked]:bg-secondary has-[:checked]:border-primary/60 cursor-pointer min-w-0 transition-all hover:bg-muted/50"
                    >
                      <RadioGroupItem value="rainfed" id="rainfed" className="shrink-0" />
                      <Sun className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="text-xs sm:text-sm font-medium truncate">{t('cropRecommender.client.rainfed')}</span>
                    </Label>
                  </RadioGroup>
                )}
              />
            </div>

            {/* ── STEP 3: Land Size ─────────────────────────────────────────── */}
            <div>
              <Label htmlFor="landSize">{t('cropRecommender.client.landSize')}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Controller
                  name="landSize"
                  control={control}
                  render={({ field }) => (
                    <Input id="landSize" {...field} placeholder={t('cropRecommender.client.landSizePlaceholder') || 'e.g., 2 acres'} className="min-w-0 flex-1" />
                  )}
                />
                <Button type="button" variant={recordingField === 'landSize' ? "destructive" : "outline"} size="icon" onClick={() => handleMicClick('landSize')} disabled={!!recordingField} className="shrink-0">
                  {recordingField === 'landSize' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              {errors.landSize && <p className="text-xs text-destructive mt-1">{t('cropRecommender.client.landSizeRequired') || 'Land size is required.'}</p>}
            </div>

            {/* ── STEP 4: Soil Type (Location-Aware) ───────────────────────── */}
            <div>
              <Label htmlFor="soilType" className="flex items-center justify-between">
                <span>{t('cropRecommender.client.soilType')}</span>
                {currentState && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {currentState}
                  </Badge>
                )}
              </Label>
              {currentState && (
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                  {t('cropRecommender.client.soilsForState') || 'Showing soils documented for'} {currentState}
                </p>
              )}
              <Controller name="soilType" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('cropRecommender.client.selectSoilType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {soils.map(soil => (
                      <SelectItem key={soil.key} value={soil.key}>
                        {getSoilSelectLabel(soil, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              <div className="flex items-center justify-between text-xs mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  {isHi ? "मिट्टी का प्रकार नहीं जानते?" : "Don't know your soil type?"}
                </span>
                <Link
                  href="/dashboard/soil-analysis"
                  className="font-semibold text-primary underline hover:text-primary/80 flex items-center gap-0.5"
                >
                  {isHi ? "फोटो खींचकर जांचें" : "Upload photo to detect"} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* ── STEP 5: Water Source ──────────────────────────────────────── */}
            <div>
              <Label htmlFor="waterSource">{t('cropRecommender.client.waterSource')}</Label>
              <Controller name="waterSource" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger><SelectValue placeholder={t('cropRecommender.client.selectWaterSource')} /></SelectTrigger>
                  <SelectContent>
                    {waterSources.map(type => <SelectItem key={type} value={type}>{t(`cropRecommender.client.waterSources.${type}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <div className="flex items-center justify-between text-xs mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  {isHi ? "मिट्टी का प्रकार नहीं जानते?" : "Don't know your soil type?"}
                </span>
                <Link
                  href="/dashboard/soil-analysis"
                  className="font-semibold text-primary underline hover:text-primary/80 flex items-center gap-0.5"
                >
                  {isHi ? "फोटो खींचकर जांचें" : "Upload photo to detect"} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* ── STEP 6: Season ────────────────────────────────────────────── */}
            <div>
              <Label htmlFor="season">{t('cropRecommender.client.currentSeason')}</Label>
              <Controller name="season" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger><SelectValue placeholder={t('cropRecommender.client.selectSeason') || 'Select a season'} /></SelectTrigger>
                  <SelectContent>
                    {seasons.map(type => <SelectItem key={type} value={type}>{t(`cropRecommender.client.seasons.${type}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <div className="flex items-center justify-between text-xs mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  {isHi ? "मिट्टी का प्रकार नहीं जानते?" : "Don't know your soil type?"}
                </span>
                <Link
                  href="/dashboard/soil-analysis"
                  className="font-semibold text-primary underline hover:text-primary/80 flex items-center gap-0.5"
                >
                  {isHi ? "फोटो खींचकर जांचें" : "Upload photo to detect"} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* ── STEP 7: Previous Crop ──────────────────────────────────────── */}
            <div>
              <Label htmlFor="previousCrop">{t('cropRecommender.client.previousCrop')}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Controller
                  name="previousCrop"
                  control={control}
                  render={({ field }) => (
                    <Input id="previousCrop" {...field} placeholder={t('cropRecommender.client.previousCropPlaceholder') || 'e.g., Wheat'} />
                  )}
                />
                <Button type="button" variant={recordingField === 'previousCrop' ? "destructive" : "outline"} size="icon" onClick={() => handleMicClick('previousCrop')} disabled={!!recordingField}>
                  {recordingField === 'previousCrop' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* ── STEP 8: Budget ────────────────────────────────────────────── */}
            <div>
              <Label htmlFor="budget">{t('cropRecommender.client.budget')}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Controller
                  name="budget"
                  control={control}
                  render={({ field }) => (
                    <Input id="budget" {...field} placeholder={t('cropRecommender.client.budgetPlaceholder') || 'e.g., 10,000 INR'} />
                  )}
                />
                <Button type="button" variant={recordingField === 'budget' ? "destructive" : "outline"} size="icon" onClick={() => handleMicClick('budget')} disabled={!!recordingField}>
                  {recordingField === 'budget' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* ── STEP 9: Crop Preference ───────────────────────────────────── */}
            <div>
              <Label htmlFor="cropPreference">{t('cropRecommender.client.cropPreference')}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Controller
                  name="cropPreference"
                  control={control}
                  render={({ field }) => (
                    <Input id="cropPreference" {...field} placeholder={t('cropRecommender.client.cropPreferencePlaceholder')} />
                  )}
                />
                <Button type="button" variant={recordingField === 'cropPreference' ? "destructive" : "outline"} size="icon" onClick={() => handleMicClick('cropPreference')} disabled={!!recordingField}>
                  {recordingField === 'cropPreference' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full !mt-6">
              <Sparkles className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading
                ? (language === 'hi' ? 'AI आपके खेत की स्थिति का विश्लेषण कर रहा है...' : 'AI is analyzing your farm conditions...')
                : (t('cropRecommender.client.getRecommendations') || 'Get Recommendations')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Results Panel ──────────────────────────────────────────────────── */}
      <div className="lg:col-span-7 xl:col-span-8">
        <h2 className="text-2xl font-bold mb-4 font-headline">{t('cropRecommender.client.resultsTitle')}</h2>

        {/* ── Empty / Insufficient Data State (Requirement 3: No Hallucinations) ── */}
        {result && result.recommendations.length === 0 && !isLoading && (
          <Card className="border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                {lang === 'hi'
                  ? 'दी गई परिस्थितियों के लिए कोई उपयुक्त फसल नहीं मिली'
                  : lang === 'pa'
                  ? 'ਦਿੱਤੀਆਂ ਗਈਆਂ ਸ਼ਰਤਾਂ ਅਨੁਸਾਰ ਕੋਈ ਢੁਕਵੀਂ ਫ਼ਸਲ ਨਹੀਂ ਮਿਲੀ'
                  : lang === 'mr'
                  ? 'दिलेल्या परिस्थितीनुसार कोणतेही योग्य पीक आढळले नाही'
                  : lang === 'bn'
                  ? 'প্রদত্ত পরিস্থিতির জন্য কোনো উপযুক্ত ফসল পাওয়া যায়নি'
                  : lang === 'ta'
                  ? 'கொடுக்கப்பட்ட நிபந்தனைகளுக்கு ஏற்ற பயிர் எதுவும் கிடைக்கவில்லை'
                  : 'No Suitable Verified Crop Found'}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
                {result.farm_assessment ||
                  (lang === 'hi'
                    ? 'मौसम, मिट्टी, और सिंचाई की स्थिति के कड़े कृषि मानकों के अनुसार कोई भी फसल उपयुक्त नहीं पाई गई। कृपया अन्य मौसम या सिंचाई का प्रकार चुनकर पुनः प्रयास करें।'
                    : 'No verified crop in our agricultural database satisfied all constraints (season, soil compatibility, and irrigation feasibility). Please adjust your farm parameters.')}
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setResult(null)}
              >
                {lang === 'hi'
                  ? 'मापदंड संशोधित करें'
                  : lang === 'pa'
                  ? 'ਮਾਪਦੰਡ ਬਦਲੋ'
                  : lang === 'mr'
                  ? 'मापदंड बदला'
                  : lang === 'bn'
                  ? 'পরামিতি সংশোধন করুন'
                  : lang === 'ta'
                  ? 'அளவுருக்களை மாற்றவும்'
                  : 'Adjust Parameters'}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Verified Recommendation Results ─────────────────────────────────── */}
        {result?.recommendations && result.recommendations.length > 0 && !isLoading && (
          <div className="space-y-6">
            {/* Field Assessment Executive Summary (Dynamically Generated from AI) */}
            {(result.farm_assessment || result.fieldSummary) && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                      {lang === 'hi' ? 'खेत उपयुक्तता विश्लेषण' : lang === 'pa' ? 'ਖੇਤ ਅਨੁਕੂਲਤਾ ਵਿਸ਼ਲੇਸ਼ਣ' : lang === 'mr' ? 'शेती उपयुक्तता विश्लेषण' : lang === 'bn' ? 'ক্ষেতের উপযুক্ততা বিশ্লেষণ' : lang === 'ta' ? 'நில பொருத்தப்பாடு பகுப்பாய்வு' : 'Field Suitability Analysis'}
                    </h3>
                    {result.location_summary && (
                      <Badge variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
                        {result.location_summary}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-900/90 dark:text-emerald-300/90 leading-relaxed whitespace-pre-line">
                    {result.farm_assessment || result.fieldSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Advisory Warnings from AI if present */}
            {result.warnings && result.warnings.length > 0 && (
              <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
                <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                  {lang === 'hi' ? 'कृषि परामर्श व चेतावनियाँ' : lang === 'pa' ? 'ਖੇਤੀਬਾੜੀ ਸਲਾਹ ਅਤੇ ਚੇਤਾਵਨੀਆਂ' : lang === 'mr' ? 'कृषी सल्ला आणि सूचना' : lang === 'bn' ? 'কৃষি পরামর্শ ও সতর্কতা' : lang === 'ta' ? 'வேளாண் ஆலோசனை மற்றும் எச்சரிக்கைகள்' : 'Agro-Climate Advisory & Warnings'}
                </AlertTitle>
                <AlertDescription className="text-xs space-y-1 mt-1">
                  {result.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span>•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-6">
              {result.recommendations.map((rec, index) => (
                <Card key={index} className="overflow-hidden border border-border/80 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="bg-muted/30 border-b pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-border/70 shadow-xs">
                          {iconMap[rec.icon as CropIcon] || iconMap.Leaf}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg font-bold font-headline">{rec.crop || rec.cropName}</CardTitle>
                            {rec.variety && (
                              <Badge variant="secondary" className="text-xs font-semibold">
                                {rec.variety}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                            <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              {lang === 'hi' ? 'बुवाई का समय:' : lang === 'pa' ? 'ਬਿਜਾਈ ਦਾ ਸਮਾਂ:' : lang === 'mr' ? 'पेरणीची वेळ:' : lang === 'bn' ? 'বপনের সময়:' : lang === 'ta' ? 'விதைக்கும் காலம்:' : 'Sowing Window:'} <strong>{rec.sowing_window || rec.plantingDates}</strong>
                            </span>
                            {rec.growing_period && (
                              <span className="text-muted-foreground ml-1.5">
                                • {lang === 'hi' ? 'फसल अवधि:' : lang === 'pa' ? 'ਫ਼ਸਲ ਦੀ ਮਿਆਦ:' : lang === 'mr' ? 'कालावधी:' : lang === 'bn' ? 'সময়কাল:' : lang === 'ta' ? 'கால அளவு:' : 'Duration:'} <strong>{rec.growing_period}</strong>
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      {/* Rank & AI Suitability Score */}
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="w-fit bg-emerald-700 hover:bg-emerald-800 text-white text-xs">
                            {lang === 'hi' ? `शीर्ष पसंद #${rec.rank || index + 1}` : lang === 'pa' ? `ਪਹਿਲੀ ਪਸੰਦ #${rec.rank || index + 1}` : lang === 'mr' ? `सर्वोत्तम निवड #${rec.rank || index + 1}` : lang === 'bn' ? `শীর্ষ পছন্দ #${rec.rank || index + 1}` : lang === 'ta' ? `முதன்மைத் தேர்வு #${rec.rank || index + 1}` : `Top Pick #${rec.rank || index + 1}`}
                          </Badge>
                          {rec.suitability_score !== undefined && (
                            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                              {lang === 'hi' ? `AI उपयुक्तता स्कोर: ${rec.suitability_score}%` : lang === 'pa' ? `AI ਅਨੁਕੂਲਤਾ ਸਕੋਰ: ${rec.suitability_score}%` : lang === 'mr' ? `AI उपयुक्तता स्कोअर: ${rec.suitability_score}%` : lang === 'bn' ? `AI উপযুক্ততা স্কোর: ${rec.suitability_score}%` : lang === 'ta' ? `AI பொருத்தப்பாடு மதிப்பெண்: ${rec.suitability_score}%` : `AI Suitability Score: ${rec.suitability_score}%`}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground italic">
                          {lang === 'hi' ? 'सत्यापित कृषि नियमों के आधार पर वैज्ञानिक स्कोर।' : 'Scientific score based on verified agronomic rules.'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 text-xs sm:text-sm">
                    {/* Why this crop matches your filled details */}
                    <div className="p-3 bg-muted/30 rounded-xl border border-border/60">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        {lang === 'hi' ? 'खेत व मिट्टी के अनुसार वैज्ञानिक उपयुक्तता' : lang === 'pa' ? 'ਖੇਤ ਅਤੇ ਮਿੱਟੀ ਅਨੁਸਾਰ ਵਿਗਿਆਨਕ ਅਨੁਕੂਲਤਾ' : lang === 'mr' ? 'शेत आणि मातीनुसार वैज्ञानिक उपयुक्तता' : lang === 'bn' ? 'ক্ষেত ও মাটি অনুসারে বৈজ্ঞানিক উপযুক্ততা' : lang === 'ta' ? 'மண் மற்றும் நிலத்திற்கான அறிவியல் பொருத்தப்பாடு' : 'Agronomic Match for Your Farm'}
                      </h4>
                      <p className="text-foreground leading-relaxed">
                        {rec.agronomic_reason || rec.why_recommended || rec.reasoning}
                      </p>
                    </div>

                    {/* Key Detail Grids tailored to inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Programmatically Calculated Yield & Revenue */}
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-1.5 md:col-span-2">
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          {lang === 'hi' ? 'अनुमानित उपज व सकल आय' : lang === 'pa' ? 'ਅਨੁਮਾਨਿਤ ਝਾੜ ਅਤੇ ਕੁੱਲ ਆਮਦਨ' : lang === 'mr' ? 'अंदाजे उत्पादन आणि उत्पन्न' : lang === 'bn' ? 'আনুমানিক ফলন ও মোট আয়' : lang === 'ta' ? 'எதிர்பார்க்கப்படும் மகசூல் மற்றும் வருமானம்' : 'Expected Yield & Revenue'}
                        </span>
                        <p className="text-xs text-foreground/90 font-medium whitespace-pre-line">
                          {rec.calculated_yield_display || rec.yieldEstimate}
                        </p>
                        {rec.calculated_revenue_display && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold whitespace-pre-line">
                            {rec.calculated_revenue_display}
                          </p>
                        )}
                        {rec.market_assessment && (
                          <p className="text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/10">
                            <strong>{lang === 'hi' ? 'मंडी मांग व खरीद:' : lang === 'pa' ? 'ਮੰਡੀ ਮੰਗ ਅਤੇ ਖਰੀਦ:' : lang === 'mr' ? 'बाजार मागणी आणि खरेदी:' : lang === 'bn' ? 'বাজারের চাহিদা ও ক্রয়:' : lang === 'ta' ? 'சந்தை தேவை மற்றும் கொள்முதல்:' : 'Market Demand & Procurement:'}</strong> {rec.market_assessment}
                          </p>
                        )}
                      </div>

                      {/* Soil Compatibility */}
                      {(rec.soil_compatibility || rec.soilSuitability) && (
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-1">
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase">
                            <Layers className="h-3.5 w-3.5 text-amber-600" />
                            {lang === 'hi' ? 'मिट्टी अनुकूलता' : lang === 'pa' ? 'ਮਿੱਟੀ ਅਨੁਕੂਲਤਾ' : lang === 'mr' ? 'माती सुसंगतता' : lang === 'bn' ? 'মাটি সামঞ্জস্যতা' : lang === 'ta' ? 'மண் பொருத்தம்' : 'Soil Compatibility'}
                          </span>
                          <p className="text-xs text-foreground/90">
                            {rec.soil_compatibility || rec.soilSuitability}
                          </p>
                        </div>
                      )}

                      {/* Irrigation & Moisture */}
                      {(rec.irrigation_advice || rec.irrigationPlan) && (
                        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-1">
                          <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5 uppercase">
                            <Droplets className="h-3.5 w-3.5 text-blue-600" />
                            {lang === 'hi' ? 'सिंचाई व नमी प्रबंधन' : lang === 'pa' ? 'ਸਿੰਚਾਈ ਅਤੇ ਨਮੀ ਪ੍ਰਬੰਧਨ' : lang === 'mr' ? 'सिंचन आणि ओलावा व्यवस्थापन' : lang === 'bn' ? 'সেচ ও আর্দ্রতা ব্যবস্থাপনা' : lang === 'ta' ? 'பாசனம் மற்றும் ஈரப்பத மேலாண்மை' : 'Irrigation & Moisture'}
                          </span>
                          <p className="text-xs text-foreground/90">
                            {rec.irrigation_advice || rec.irrigationPlan}
                          </p>
                          {rec.water_requirement && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {lang === 'hi' ? 'जल आवश्यकता:' : lang === 'pa' ? 'ਪਾਣੀ ਦੀ ਲੋੜ:' : lang === 'mr' ? 'पाण्याची गरज:' : lang === 'bn' ? 'পানির প্রয়োজনীয়তা:' : lang === 'ta' ? 'நீர் தேவை:' : 'Water Requirement:'} {rec.water_requirement}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Crop Rotation Impact */}
                      {(rec.crop_rotation_impact || rec.cropRotationBenefit) && (
                        <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 space-y-1">
                          <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5 uppercase">
                            <RefreshCw className="h-3.5 w-3.5 text-purple-600" />
                            {lang === 'hi' ? 'फसल चक्र प्रभाव' : lang === 'pa' ? 'ਫ਼ਸਲੀ ਚੱਕਰ ਪ੍ਰਭਾਵ' : lang === 'mr' ? 'पीक फेरपालट प्रभाव' : lang === 'bn' ? 'ফসল চক্রের প্রভাব' : lang === 'ta' ? 'பயிர் சுழற்சி தாக்கம்' : 'Crop Rotation Impact'}
                          </span>
                          <p className="text-xs text-foreground/90">
                            {rec.crop_rotation_impact || rec.cropRotationBenefit}
                          </p>
                        </div>
                      )}

                      {/* Budget & Input Feasibility */}
                      {(rec.budget_feasibility || rec.budgetFeasibility) && (
                        <div className="p-3 rounded-xl bg-slate-500/5 border border-slate-500/15 space-y-1">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5 uppercase">
                            <Coins className="h-3.5 w-3.5 text-slate-600" />
                            {lang === 'hi' ? 'बजट व लागत अनुकूलता' : lang === 'pa' ? 'ਬਜਟ ਅਤੇ ਲਾਗਤ ਅਨੁਕੂਲਤਾ' : lang === 'mr' ? 'अंदाजपत्रक व खर्च सुसंगतता' : lang === 'bn' ? 'বাজেট ও ব্যয় উপযুক্ততা' : lang === 'ta' ? 'பட்ஜெட் மற்றும் செலவு பொருத்தம்' : 'Budget & Input Feasibility'}
                          </span>
                          <p className="text-xs text-foreground/90">
                            {rec.budget_feasibility || rec.budgetFeasibility}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Key Benefits List */}
                    {rec.key_benefits && rec.key_benefits.length > 0 && (
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                          {lang === 'hi' ? 'मुख्य कृषि लाभ' : lang === 'pa' ? 'ਮੁੱਖ ਖੇਤੀ ਲਾਭ' : lang === 'mr' ? 'मुख्य कृषी फायदे' : lang === 'bn' ? 'প্রধান কৃষি সুবিধা' : lang === 'ta' ? 'முக்கிய வேளாண் நன்மைகள்' : t('cropRecommender.client.keyBenefits')}
                        </h4>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {rec.key_benefits.map((benefit, i) => (
                            <li key={i} className="flex items-start gap-2 bg-muted/20 p-2 rounded-lg border border-border/40">
                              <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                              <span className="leading-snug">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risk Factors & Mitigation */}
                    {rec.risks && rec.risks.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                          {lang === 'hi' ? 'जोखिम कारक व समाधान' : lang === 'pa' ? 'ਜੋਖਮ ਅਤੇ ਹੱਲ' : lang === 'mr' ? 'धोके आणि उपाय' : lang === 'bn' ? 'ঝুঁকি ও প্রতিকার' : lang === 'ta' ? 'அபாய காரணிகள் மற்றும் தீர்வுகள்' : 'Risk Factors & Mitigation'}
                        </span>
                        <ul className="text-xs text-foreground/80 space-y-0.5 list-disc list-inside">
                          {rec.risks.map((r, rIdx) => (
                            <li key={rIdx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Important Considerations */}
                    {rec.important_considerations && rec.important_considerations.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                          {lang === 'hi' ? 'महत्वपूर्ण कृषि सावधानियां' : lang === 'pa' ? 'ਮਹੱਤਵਪੂਰਨ ਸਾਵਧਾਨੀਆਂ' : lang === 'mr' ? 'महत्त्वाच्या सूचना' : lang === 'bn' ? 'গুরুত্বপূর্ণ সতর্কতা' : lang === 'ta' ? 'முக்கிய குறிப்புகள்' : 'Important Agronomic Considerations'}
                        </span>
                        <ul className="text-xs text-foreground/80 space-y-0.5 list-disc list-inside">
                          {rec.important_considerations.map((c, cIdx) => (
                            <li key={cIdx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="bg-muted/10 border-t py-3 px-5 flex justify-end">
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <Link href={`/dashboard/learn?q=${encodeURIComponent(rec.crop || rec.cropName)}`}>
                        {lang === 'hi' ? 'अधिक जानकारी' : lang === 'pa' ? 'ਹੋਰ ਜਾਣਕਾਰੀ' : lang === 'mr' ? 'अधिक माहिती' : lang === 'bn' ? 'আরও জানুন' : lang === 'ta' ? 'மேலும் அறிக' : t('cropRecommender.client.learnMore')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Data sources footer */}
            {result.data_sources && result.data_sources.length > 0 && (
              <p className="text-[11px] text-muted-foreground text-center">
                {lang === 'hi' ? 'डेटा व कृषि स्रोत:' : lang === 'pa' ? 'ਡਾਟਾ ਅਤੇ ਖੇਤੀ ਸਰੋਤ:' : lang === 'mr' ? 'माहिती आणि कृषी स्रोत:' : lang === 'bn' ? 'উপাত্ত ও কৃষি উৎস:' : lang === 'ta' ? 'தரவு மற்றும் வேளாண் ஆதாரங்கள்:' : 'Data & Agronomy Sources:'} {result.data_sources.join(' • ')}
              </p>
            )}
          </div>
        )}

        {isLoading && <LoadingSkeleton />}

        {!result && !isLoading && (
          <Card className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[50vh]">
            <CardContent className='p-0'>
              <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">{t('cropRecommender.client.resultsPlaceholder')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-start gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className='flex-1 space-y-2'>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardHeader>
          <CardContent className="flex-grow space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-9 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  </div>
);
