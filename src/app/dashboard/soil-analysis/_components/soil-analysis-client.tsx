"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  analyzeSoil,
  type AnalyzeSoilOutput,
  type AnalyzeSoilInput,
  type SuitableCrop,
} from '@/ai/flows/analyze-soil';
import { generateSpeech } from '@/ai/flows/text-to-speech';
import {
  Layers,
  Upload,
  Mic,
  Square,
  Sparkles,
  Volume2,
  Pause,
  Droplets,
  Sun,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Wheat,
  Sprout,
  Leaf,
  Carrot,
  Grape,
  Loader2,
  CheckCircle2,
  FlaskConical,
  Compass,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/contexts/language-context';
import { useLocation } from '@/contexts/location-context';

const SpeechRecognition =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

const cropIconMap = {
  Wheat: Wheat,
  Sprout: Sprout,
  Leaf: Leaf,
  Carrot: Carrot,
  Grape: Grape,
};

export function SoilAnalysisClient() {
  const { t, language } = useTranslation();
  const { location } = useLocation();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<AnalyzeSoilOutput | null>(null);

  // Audio Text-to-Speech
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Client-side image compression for fast upload & responsiveness
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new (window as any).Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIM = 900;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        }
      };
      img.onerror = () => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
    });
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await compressImage(file);
        setImageData(compressed);
      } catch (err) {
        console.error('Image compression failed:', err);
        const reader = new FileReader();
        reader.onloadend = () => setImageData(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleMicClick = () => {
    if (!SpeechRecognition) {
      toast({
        title: t('toast.browserNotSupported') || 'Browser Not Supported',
        description: t('toast.noVoiceSupport') || 'Your browser does not support speech recognition.',
        variant: 'destructive',
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    const langMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      pa: 'pa-IN',
      mr: 'mr-IN',
      bn: 'bn-IN',
      ta: 'ta-IN',
      kn: 'kn-IN',
      bho: 'bho-IN',
    };
    recognition.lang = langMap[language] || 'hi-IN';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => setDescription(event.results[0][0].transcript);
    recognition.onerror = (event: any) => {
      toast({
        title: t('toast.voiceError') || 'Voice Error',
        description: event.error,
        variant: 'destructive',
      });
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleSubmit = async (overrideDescription?: string) => {
    const descToUse = overrideDescription !== undefined ? overrideDescription : description;
    if (!imageData && !descToUse.trim()) {
      toast({
        title: t('toast.noInput') || 'No Input Provided',
        description:
          t('soilAnalysis.client.uploadDescription') ||
          'Please upload a soil photo or provide a short description of your field soil.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);

    try {
      const payload: AnalyzeSoilInput = {
        description: descToUse.trim(),
        location: location?.displayName || '',
        language: language || 'hi',
      };
      if (imageData) {
        payload.photoDataUri = imageData;
      }

      const soilOutput = await analyzeSoil(payload);
      setResult(soilOutput);

      if (!soilOutput.isSoil) {
        toast({
          title: t('soilAnalysis.client.lowConfidenceWarning') || 'Non-Soil Image Detected',
          description:
            soilOutput.lowConfidenceMessage ||
            'The uploaded photo does not appear to be agricultural soil.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Soil Analysis Complete',
          description: `${soilOutput.soilType} — ${soilOutput.suitableCrops.length} crops recommended.`,
        });
      }
    } catch (err: any) {
      console.error('Soil analysis error:', err);
      toast({
        title: 'Analysis Failed',
        description: err?.message || 'Could not complete soil analysis. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Play audio report
  const playAudioReport = async () => {
    if (!result) return;

    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (audioRef.current && audioRef.current.src && !audioRef.current.ended) {
      audioRef.current.play();
      setIsPlayingAudio(true);
      return;
    }

    setIsGeneratingSpeech(true);
    try {
      const topCropsText = result.suitableCrops
        .slice(0, 4)
        .map((c) => c.cropName)
        .join(', ');

      const summaryText =
        language === 'en'
          ? `Soil Analysis Report: The identified soil is ${result.soilType}, ${result.texture}. Estimated pH is ${result.estimatedPh}. Top recommended crops for this soil are ${topCropsText}. Management advice: ${result.managementAdvice}`
          : `मिट्टी परीक्षण रिपोर्ट: आपकी मिट्टी का प्रकार ${result.soilType} है। बनावट: ${result.texture}। अनुमानित पीएच मान ${result.estimatedPh} है। इस मिट्टी के लिए सबसे उत्तम फसलें हैं: ${topCropsText}। प्रबंधन सलाह: ${result.managementAdvice}`;

      const speech = await generateSpeech({
        text: summaryText,
        language: language || 'hi',
      });

      if (speech.media) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.onended = () => setIsPlayingAudio(false);
          audioRef.current.onerror = () => setIsPlayingAudio(false);
        }
        audioRef.current.src = speech.media;
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    } catch (err) {
      console.warn('Speech playback failed:', err);
      toast({
        title: 'Speech Error',
        description: 'Could not generate voice report audio.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  // Quick preset test samples for one-click testing
  const runPreset = (soilName: string, desc: string) => {
    setImageData(null);
    setImagePreview(null);
    setDescription(desc);
    handleSubmit(desc);
  };

  const resetForm = () => {
    setImageData(null);
    setImagePreview(null);
    setDescription('');
    setResult(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* LEFT COLUMN: UPLOAD & CONTROLS (5 cols on lg) */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-headline">
              <Layers className="h-5 w-5 text-primary" />
              {t('soilAnalysis.client.uploadTitle') || 'Analyze Your Soil'}
            </CardTitle>
            <CardDescription>
              {t('soilAnalysis.client.uploadDescription') ||
                'Upload a photo of your field soil, dirt clod, or farm ground for instant AI classification & crop advice.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Image Upload Area */}
            <div>
              <Label className="font-semibold block mb-2">
                {t('soilAnalysis.client.imageLabel') || 'Upload Soil Photo'}
              </Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 min-h-[190px]"
              >
                {imagePreview ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden group">
                    <Image
                      src={imagePreview}
                      alt={t('soilAnalysis.client.soilPreview') || 'Soil preview'}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                      {t('soilAnalysis.client.changeFile') || 'Click to change photo'}
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2 p-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium">
                      {t('soilAnalysis.client.chooseFile') || 'Click to upload soil photo'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WEBP up to 10MB (field dirt, dry clod, or tilled soil)
                    </p>
                  </div>
                )}
                <Input
                  ref={fileInputRef}
                  id="soil-image-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Description / Voice Observation */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label htmlFor="soil-description" className="font-semibold text-sm">
                  {t('soilAnalysis.client.descriptionLabel') || 'Field Observations (Optional)'}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleMicClick}
                  className={`h-7 px-2 text-xs flex items-center gap-1.5 ${
                    isRecording ? 'text-destructive animate-pulse' : 'text-primary'
                  }`}
                >
                  {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isRecording ? 'Listening...' : 'Voice Note'}
                </Button>
              </div>
              <Textarea
                id="soil-description"
                placeholder={
                  t('soilAnalysis.client.descriptionPlaceholder') ||
                  "e.g., 'Soil is dark brown, holds water after irrigation, farm in Nashik' or click mic to speak."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* Quick Demo Soil Samples */}
            <div className="pt-2 border-t border-border/50">
              <span className="text-xs font-medium text-muted-foreground block mb-2">
                {t('soilAnalysis.client.samplePrompt') || 'Quick Demo Samples:'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start h-8 truncate"
                  onClick={() =>
                    runPreset(
                      'Black Soil',
                      'काली चिकनी कपास मिट्टी, सूखने पर दरारें पड़ती हैं, उच्च नमी धारण'
                    )
                  }
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-900 mr-1.5 shrink-0" />
                  {t('soilAnalysis.client.blackSoilSample') || 'Black Cotton Soil'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start h-8 truncate"
                  onClick={() =>
                    runPreset(
                      'Alluvial Soil',
                      'जलोढ़ दोमट मिट्टी, हल्की भूरी, भुरभुरी संरचना, गंगा-यमुना मैदान'
                    )
                  }
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600 mr-1.5 shrink-0" />
                  {t('soilAnalysis.client.alluvialSample') || 'Alluvial Domat'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start h-8 truncate"
                  onClick={() =>
                    runPreset(
                      'Red Soil',
                      'लाल भुरभुरी मिट्टी, आयरन ऑक्साइड युक्त, अच्छी जल निकासी, दक्षिण भारत'
                    )
                  }
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-700 mr-1.5 shrink-0" />
                  {t('soilAnalysis.client.redSoilSample') || 'Red Soil'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start h-8 truncate"
                  onClick={() =>
                    runPreset(
                      'Sandy Soil',
                      'रेतीली बलुई मिट्टी, बालू के कण, अत्यधिक जल रिसाव, राजस्थान/हरियाणा'
                    )
                  }
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mr-1.5 shrink-0" />
                  {t('soilAnalysis.client.sandySample') || 'Sandy / Arid'}
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button
              className="flex-1 font-semibold"
              onClick={() => handleSubmit()}
              disabled={isLoading || (!imageData && !description.trim())}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('soilAnalysis.client.analyzing') || 'Analyzing Soil...'}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('soilAnalysis.client.analyzeButton') || 'Analyze Soil & Crops'}
                </>
              )}
            </Button>
            {(imageData || description || result) && (
              <Button variant="ghost" size="icon" onClick={resetForm} title="Reset">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Location Banner */}
        {location?.displayName && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground border">
            <Compass className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">
              <strong>Farm Location:</strong> {location.displayName}
            </span>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: RESULTS & CROP RECOMMENDATIONS (7 cols on lg) */}
      <div className="lg:col-span-7 space-y-6">
        {isLoading ? (
          <Card className="border-2 border-primary/20 p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </Card>
        ) : result && !result.isSoil ? (
          <Alert variant="destructive" className="p-6">
            <AlertTriangle className="h-6 w-6" />
            <AlertTitle className="text-lg font-semibold ml-2">
              {t('soilAnalysis.client.lowConfidenceWarning') || 'Non-Soil Image Detected'}
            </AlertTitle>
            <AlertDescription className="mt-2 text-sm ml-2 space-y-3">
              <p>
                {result.lowConfidenceMessage ||
                  'The uploaded photo does not appear to be agricultural soil, farm dirt, or tilled field earth.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Tip: Please take a close-up photo of your farm ground, dirt clod, or field furrow in good daylight.
              </p>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {t('soilAnalysis.client.changeFile') || 'Upload Clear Soil Photo'}
              </Button>
            </AlertDescription>
          </Alert>
        ) : result ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. PRIMARY SOIL IDENTITY CARD */}
            <Card className="border-2 border-primary shadow-md overflow-hidden bg-gradient-to-br from-card to-primary/5">
              <CardHeader className="pb-3 border-b border-border/50 bg-primary/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="bg-background text-primary border-primary/30 font-semibold px-2.5 py-1">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary" />
                    {result.confidence}% Match • {t('soilAnalysis.client.sourceBadge') || 'ICAR Verified'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={playAudioReport}
                    disabled={isGeneratingSpeech}
                    className="h-8 gap-1.5 text-xs bg-background/80 hover:bg-background"
                  >
                    {isGeneratingSpeech ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isPlayingAudio ? (
                      <Pause className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5 text-primary" />
                    )}
                    {isPlayingAudio
                      ? 'Pause Report'
                      : t('soilAnalysis.client.listenReport') || 'Listen to Soil Report'}
                  </Button>
                </div>

                <div className="mt-3">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {result.primaryClassification}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-extrabold font-headline text-foreground mt-0.5">
                    {result.soilType}
                  </h2>
                  {result.regionalName && result.regionalName !== result.soilType && (
                    <p className="text-sm text-muted-foreground font-medium">
                      Regional name: {result.regionalName}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* 4 Physical Properties Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-background border shadow-xs space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                      <Layers className="h-3 w-3 text-amber-600" />
                      {t('soilAnalysis.client.texture') || 'Texture'}
                    </span>
                    <p className="text-xs font-semibold leading-tight line-clamp-2">
                      {result.texture}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-background border shadow-xs space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                      <FlaskConical className="h-3 w-3 text-emerald-600" />
                      {t('soilAnalysis.client.estimatedPh') || 'pH Level'}
                    </span>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {result.estimatedPh}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-background border shadow-xs space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                      <Droplets className="h-3 w-3 text-blue-600" />
                      {t('soilAnalysis.client.waterRetention') || 'Moisture'}
                    </span>
                    <p className="text-xs font-semibold leading-tight">
                      {result.waterRetention}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-background border shadow-xs space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                      <Sun className="h-3 w-3 text-orange-600" />
                      {t('soilAnalysis.client.drainage') || 'Drainage'}
                    </span>
                    <p className="text-xs font-semibold leading-tight">
                      {result.drainage}
                    </p>
                  </div>
                </div>

                {/* NPK Status Strip */}
                <div className="p-3 rounded-xl bg-muted/40 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground shrink-0">
                      {t('soilAnalysis.client.nutrientStatus') || 'NPK Status'}:
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[11px]">
                        N: <strong>{result.nutrientProfile.nitrogen}</strong>
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        P: <strong>{result.nutrientProfile.phosphorus}</strong>
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        K: <strong>{result.nutrientProfile.potassium}</strong>
                      </Badge>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[11px] italic sm:text-right">
                    {result.nutrientProfile.summary}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2. SUITABLE CROPS LIST */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-headline flex items-center gap-2">
                      <Sprout className="h-5 w-5 text-emerald-600" />
                      {t('soilAnalysis.client.suitableCropsTitle') ||
                        'Best Crops to Grow in this Soil'}
                    </CardTitle>
                    <CardDescription>
                      {t('soilAnalysis.client.cropsDescription') ||
                        'Ranked crops by soil compatibility, expected yield potential, and ICAR agronomic fitness.'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    {result.suitableCrops.length} Verified Crops
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {result.suitableCrops.map((crop, index) => {
                  const IconComp = cropIconMap[crop.iconHint || 'Wheat'] || Sprout;
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-base text-foreground">
                              {crop.cropName}
                            </h4>
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              {crop.season}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              {crop.suitabilityScore}% Match
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {crop.whySuitable}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                            <span>
                              💧 Water: <strong>{crop.waterRequirement}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              ⏱ Duration: <strong>{crop.estimatedDuration}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button asChild size="sm" variant="outline" className="shrink-0 self-end sm:self-center text-xs h-8">
                        <Link
                          href={`/dashboard/crop-recommender?soilType=${encodeURIComponent(
                            result.soilType
                          )}&cropPreference=${encodeURIComponent(crop.cropName)}`}
                        >
                          Plan Cultivation
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </CardContent>

              <CardFooter className="pt-0">
                <Button asChild className="w-full font-semibold" variant="default">
                  <Link
                    href={`/dashboard/crop-recommender?soilType=${encodeURIComponent(
                      result.soilType
                    )}`}
                  >
                    <FileCheck2 className="mr-2 h-4 w-4" />
                    {t('soilAnalysis.client.planInRecommender') ||
                      'Open Full Profit & Mandi Calculator for this Soil'}
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* 3. UNSUITABLE CROPS ALERT */}
            {result.unsuitableCrops && result.unsuitableCrops.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  {t('soilAnalysis.client.unsuitableCropsTitle') || 'Crops to Avoid in this Soil'}
                </h4>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  {result.unsuitableCrops.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. SOIL IMPROVEMENT & ICAR MANAGEMENT TIPS */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {t('soilAnalysis.client.improvementTitle') ||
                    'ICAR Soil Conditioning & Fertility Advice'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed">
                <p className="text-foreground font-medium p-3 rounded-lg bg-primary/5 border border-primary/10">
                  {result.managementAdvice}
                </p>
                {result.soilImprovementTips && result.soilImprovementTips.length > 0 && (
                  <ul className="space-y-2 list-none pl-0">
                    {result.soilImprovementTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-muted-foreground">{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground/80 italic pt-2 border-t">
                  Source: {result.source}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Empty State */
          <Card className="border-2 border-dashed border-muted-foreground/20 p-8 text-center flex flex-col items-center justify-center min-h-[420px] bg-muted/10">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-4">
              <Layers className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold font-headline mb-1">
              {t('soilAnalysis.client.resultTitle') || 'Soil Analysis & Recommended Crops'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Upload a photo of your field soil on the left or click a demo sample to see instant
              soil classification, pH, moisture traits, and AI crop recommendations.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                Upload Soil Photo
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  runPreset(
                    'Black Soil',
                    'काली चिकनी कपास मिट्टी, सूखने पर दरारें, उच्च नमी संचय'
                  )
                }
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                Try Black Soil Demo
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
