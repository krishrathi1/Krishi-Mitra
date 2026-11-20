
"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  diagnoseCropDisease, 
  translateCropDiagnosis, 
  type DiagnoseCropDiseaseOutput, 
  DiagnoseCropDiseaseInput 
} from '@/ai/flows/diagnose-crop-disease';
import { cleanCropDiagnosisText } from '@/lib/utils';
import { generateSpeech } from '@/ai/flows/text-to-speech';
import { Leaf, Lightbulb, Upload, Volume2, Pause, BookOpen, Youtube, FileUp, Mic, Square, Loader2, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/contexts/language-context';

const SpeechRecognition =
  (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));

export function CropDoctorClient() {
  const { t, language } = useTranslation();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [visualSymptoms, setVisualSymptoms] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<DiagnoseCropDiseaseOutput | null>(null);
  const [resultLanguage, setResultLanguage] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [activeAudio, setActiveAudio] = useState<{ id: 'diagnosis' | 'solutions'; isPlaying: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    // Cleanup audio element and its event listeners
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const extractVisualSymptoms = (ctx: CanvasRenderingContext2D, width: number, height: number): string => {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      let greenCount = 0;
      let yellowCount = 0;
      let brownRustCount = 0;
      let whiteCount = 0;
      let darkSpotCount = 0;
      let totalSampled = 0;

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 50) continue;
        totalSampled++;

        // Chlorophyll green
        if (g > r * 1.1 && g > b * 1.1) {
          greenCount++;
        }
        // Yellow stripe / chlorosis: high R and G, lower B
        else if (r > 120 && g > 120 && b < 105 && Math.abs(r - g) < 55) {
          yellowCount++;
        }
        // Brown / orange rust pustules: high R, moderate G, low B
        else if (r > 110 && g < 120 && b < 80) {
          brownRustCount++;
        }
        // White powdery mildew / white rust
        else if (r > 180 && g > 180 && b > 180) {
          whiteCount++;
        }
        // Dark necrotic blight spots
        else if (r < 75 && g < 75 && b < 75) {
          darkSpotCount++;
        }
      }

      if (totalSampled === 0) return '';

      const yellowRatio = yellowCount / totalSampled;
      const rustRatio = brownRustCount / totalSampled;
      const greenRatio = greenCount / totalSampled;
      const whiteRatio = whiteCount / totalSampled;
      const darkRatio = darkSpotCount / totalSampled;

      // 1. Yellow stripes & rust pustules on cereal leaf (Wheat Yellow Stripe Rust)
      if (yellowRatio > 0.04 || rustRatio > 0.025 || (yellowRatio + rustRatio > 0.06)) {
        return 'Wheat crop leaf showing yellow stripe rust pustules (peela rattua) and chlorotic stripes along veins';
      }

      // 2. White blister or powdery patches (Mustard White Rust)
      if (whiteRatio > 0.10 && greenRatio > 0.15) {
        return 'Mustard crop leaf with white rust blister patches and fungal growth';
      }

      // 3. Dark necrotic blight spots / lesions (Late Blight / Blast)
      if (darkRatio > 0.06) {
        return 'Crop leaf showing dark necrotic blight spots with chlorotic halo';
      }

      // 4. General foliar spotting
      if (greenRatio > 0.20) {
        return 'Foliar leaf spotting and chlorosis on agricultural crop';
      }

      return 'Crop leaf showing disease symptoms';
    } catch {
      return '';
    }
  };

  const compressImage = (file: File): Promise<{ dataUrl: string; symptoms: string }> => {
    return new Promise((resolve) => {
      const img = new (window as any).Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIM = 800;
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
          const symptoms = extractVisualSymptoms(ctx, width, height);
          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', 0.82),
            symptoms,
          });
        } else {
          // Fallback to simple FileReader
          const reader = new FileReader();
          reader.onloadend = () => resolve({ dataUrl: reader.result as string, symptoms: '' });
          reader.readAsDataURL(file);
        }
      };
      img.onerror = () => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ dataUrl: reader.result as string, symptoms: '' });
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
        const { dataUrl, symptoms } = await compressImage(file);
        setImageData(dataUrl);
        setVisualSymptoms(symptoms);
        if (!description.trim() && symptoms) {
          setDescription(symptoms);
        }
      } catch (err) {
        console.error("Image compression error, using raw:", err);
        const reader = new FileReader();
        reader.onloadend = () => setImageData(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };
  
   const handleMicClick = () => {
    if (!SpeechRecognition) {
      toast({ title: t('toast.browserNotSupported'), description: t('toast.noVoiceSupport'), variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    const langMap: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', mr: 'mr-IN', bn: 'bn-IN', ta: 'ta-IN', kn: 'kn-IN', bho: 'bho-IN' };
    recognition.lang = langMap[language] || 'en-IN';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => setDescription(event.results[0][0].transcript);
    recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
            toast({ title: t('toast.noSpeechDetected'), description: t('toast.tryAgain'), variant: "destructive" });
        } else {
            toast({ title: t('toast.voiceError'), description: event.error, variant: "destructive" });
        }
    };
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };


  // Auto-translate result if language changes and result exists
  useEffect(() => {
    if (!result) return;
    const currentLang = language || 'hi';
    
    // Check if resultLanguage was set and differs from currentLang,
    // OR if the result text contains English markers while currentLang is not English
    const isEnglishContent =
      result.solutions.includes('(in en)') ||
      result.solutions.toLowerCase().includes('organic remedy') ||
      result.diagnosis.toLowerCase().includes('wheat —') ||
      result.diagnosis.toLowerCase().includes('spot blotch');

    const needsTranslation =
      (resultLanguage && resultLanguage !== currentLang) ||
      (!resultLanguage && currentLang !== 'en' && isEnglishContent);

    if (needsTranslation) {
      let active = true;
      setIsTranslating(true);
      translateCropDiagnosis(result.diagnosis, result.solutions, currentLang)
        .then((translated) => {
          if (active) {
            setResult((prev) => prev ? {
              ...prev,
              diagnosis: translated.diagnosis,
              solutions: translated.solutions,
            } : null);
            setResultLanguage(currentLang);
          }
        })
        .catch((err) => {
          console.warn("Failed to auto-translate crop diagnosis:", err);
        })
        .finally(() => {
          if (active) setIsTranslating(false);
        });

      return () => {
        active = false;
      };
    }
  }, [language, result, resultLanguage]);

  const playAudio = async (text: string, id: 'diagnosis' | 'solutions') => {
    // If this audio is already playing, pause it
    if (activeAudio?.id === id && activeAudio.isPlaying) {
      audioRef.current?.pause();
      setActiveAudio({ ...activeAudio, isPlaying: false });
      return;
    }
    
    // If another audio is playing, pause it before starting the new one
    if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
    }
    
    // If we're resuming a paused audio
    if (activeAudio?.id === id && !activeAudio.isPlaying) {
        audioRef.current?.play();
        setActiveAudio({ ...activeAudio, isPlaying: true });
        return;
    }

    // Otherwise, generate new audio
    setIsGeneratingSpeech(true);
    setActiveAudio(null);
    try {
      const response = await generateSpeech({ text, language: language || 'hi' });
      if (response.media) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.onended = () => {
            setActiveAudio((current) => current ? { ...current, isPlaying: false } : null);
          };
          audioRef.current.onpause = () => {
             setActiveAudio((current) => current ? { ...current, isPlaying: false } : null);
          };
          audioRef.current.onplay = () => {
            setActiveAudio((current) => current ? { ...current, isPlaying: true } : null);
          };
        }
        audioRef.current.src = response.media;
        audioRef.current.play();
        setActiveAudio({ id, isPlaying: true });
      }
    } catch (error) {
      console.error("Speech generation failed", error);
      toast({
        title: t('toast.speechGenerationFailed'),
        description: t('toast.couldNotGenerateAudio'),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleSubmit = async () => {
    if (!imageData && !description.trim()) {
      toast({
        title: t('toast.noInput'),
        description: t('toast.provideImageOrDescription'),
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setResult(null);
    setActiveAudio(null);
    if (audioRef.current) {
        audioRef.current.pause();
    }
    try {
      const effectiveLang = language || 'hi';
      const requestData: DiagnoseCropDiseaseInput = {
        description: description.trim(),
        visualSymptoms: visualSymptoms,
        language: effectiveLang,
      };
      if (imageData) {
        requestData.photoDataUri = imageData;
      }
      
      const diagnosisResult = await diagnoseCropDisease(requestData);
      setResult(diagnosisResult);
      setResultLanguage(effectiveLang);
    } catch (error) {
      console.error(error);
      toast({
        title: t('toast.diagnosisFailed'),
        description: t('toast.errorAnalyzingImage'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('cropDoctor.client.uploadTitle')}</CardTitle>
          <CardDescription>{t('cropDoctor.client.uploadDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
            <Label htmlFor="crop-image">{t('cropDoctor.client.imageLabel')}</Label>
            <Input id="crop-image" type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <FileUp className="mr-2 h-4 w-4" />
                {imagePreview ? t('cropDoctor.client.changeFile') : t('cropDoctor.client.chooseFile')}
            </Button>
          </div>

          {imagePreview && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md border">
              <Image src={imagePreview} alt={t('cropDoctor.client.cropPreview')} layout="fill" objectFit="cover" />
            </div>
          )}
          
           <div className="space-y-2">
              <Label htmlFor="description">{t('cropDoctor.client.descriptionLabel')}</Label>
              <div className="relative">
                <Textarea
                    id="description"
                    placeholder={t('cropDoctor.client.descriptionPlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="pr-10"
                />
                <Button 
                    type="button" 
                    variant={isRecording ? "destructive" : "ghost"} 
                    size="icon" 
                    onClick={handleMicClick}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                >
                    {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="sr-only">{isRecording ? t('community.stopRecording') : t('community.startRecording')}</span>
                </Button>
              </div>
            </div>

          <Button onClick={handleSubmit} disabled={isLoading || (!imageData && !description.trim())} className="w-full">
            {isLoading ? t('cropDoctor.client.diagnosing') : t('cropDoctor.client.diagnoseButton')}
          </Button>
        </CardContent>
      </Card>
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold font-headline">{t('cropDoctor.client.resultTitle')}</h2>
          {isTranslating && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
              <span>
                {language === 'hi'
                  ? 'हिंदी में अनुवाद हो रहा है...'
                  : language === 'pa'
                  ? 'ਪੰਜਾਬੀ ਵਿੱਚ ਅਨੁਵਾਦ ਹੋ ਰਿਹਾ ਹੈ...'
                  : language === 'kn'
                  ? 'ಕನ್ನಡದಲ್ಲಿ ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...'
                  : language === 'bn'
                  ? 'অনুবাদ করা হচ্ছে...'
                  : language === 'bho'
                  ? 'भोजपुरी में अनुवाद हो रहल बा...'
                  : 'Translating...'}
              </span>
            </div>
          )}
        </div>

        {isLoading && <LoadingSkeleton />}
        {result && !isLoading && !result.isConfident && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 p-5 rounded-2xl shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Leaf className="h-5 w-5 text-amber-600" />
                <span>{t('cropDoctor.client.lowConfidenceWarning') || result.diagnosis}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {result.lowConfidenceMessage || result.diagnosis}
              </p>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setImagePreview(null);
                    setImageData(null);
                    fileInputRef.current?.click();
                  }}
                  className="rounded-full text-xs font-semibold border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                >
                  <FileUp className="h-3.5 w-3.5 mr-1.5 text-amber-700" />
                  {t('cropDoctor.client.retryButton') || "Try Another Photo"}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {result && !isLoading && result.isConfident && (
          <div className="space-y-4">
            {/* Primary Diagnosis & Confidence Badge */}
            <Alert className="border-emerald-500/30 bg-emerald-500/5">
              <div className="flex justify-between items-start w-full">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      {result.confidence ? `${result.confidence}% ${t('cropDoctor.client.confidenceLabel') || 'Confidence'}` : 'Verified'}
                    </span>
                    {result.crop && (
                      <span className="text-xs font-bold text-muted-foreground">
                        {t('cropDoctor.client.cropLabel') || 'Crop'}: <strong className="text-foreground">{result.crop}</strong>
                      </span>
                    )}
                  </div>
                  <AlertTitle className="text-lg font-extrabold text-foreground leading-snug">
                    {cleanCropDiagnosisText(result.diagnosis)}
                  </AlertTitle>
                  {result.symptoms && (
                    <div className="pt-1 text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground font-semibold block mb-0.5">
                        {t('cropDoctor.client.symptomsLabel') || 'Observed Symptoms'}:
                      </strong>
                      <p>{result.symptoms}</p>
                    </div>
                  )}
                  {result.source && (
                    <p className="text-[11px] text-muted-foreground pt-1">
                      {t('cropDoctor.client.sourceLabel') || 'Source'}: <strong className="text-emerald-700 dark:text-emerald-400">{result.source}</strong>
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => playAudio(cleanCropDiagnosisText(result.diagnosis), 'diagnosis')} disabled={isGeneratingSpeech}>
                  {activeAudio?.id === 'diagnosis' && activeAudio.isPlaying ? <Pause className="h-5 w-5"/> : <Volume2 className="h-5 w-5"/>}
                </Button>
              </div>
            </Alert>

            {/* Management & Prevention */}
            <Alert className="border-border">
              <div className="flex justify-between items-start w-full">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-emerald-600" />
                    <AlertTitle className="font-bold text-sm">{t('cropDoctor.client.solutions')}</AlertTitle>
                  </div>
                  <AlertDescription className="pl-6">
                    <div className="space-y-3 text-xs text-foreground">
                      {cleanCropDiagnosisText(result.solutions)
                        .split(/\n\n+|\n(?=\d+\.\s)/)
                        .filter(Boolean)
                        .map((paragraph, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-muted/40 border border-border/50 leading-relaxed whitespace-pre-line">
                            {paragraph.trim()}
                          </div>
                        ))}
                    </div>
                  </AlertDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => playAudio(cleanCropDiagnosisText(result.solutions), 'solutions')} disabled={isGeneratingSpeech}>
                  {activeAudio?.id === 'solutions' && activeAudio.isPlaying ? <Pause className="h-5 w-5"/> : <Volume2 className="h-5 w-5"/>}
                </Button>
              </div>

              {result.isPlant && (result.documentationLink || result.youtubeLink) && (
                <div className="mt-4 pt-4 border-t flex gap-2 flex-wrap">
                  {result.documentationLink && (
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link href={result.documentationLink} target="_blank" rel="noopener noreferrer">
                        <BookOpen className="mr-1.5 h-3.5 w-3.5 text-emerald-600"/>
                        {t('cropDoctor.client.readDocs')}
                      </Link>
                    </Button>
                  )}
                  {result.youtubeLink && (
                    <Button asChild variant="destructive" size="sm" className="text-xs">
                      <Link href={result.youtubeLink} target="_blank" rel="noopener noreferrer">
                        <Youtube className="mr-1.5 h-3.5 w-3.5"/>
                        {t('cropDoctor.client.watchVideo')}
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </Alert>
          </div>
        )}
        {!result && !isLoading && (
          <Card className="flex flex-col items-center justify-center p-8 text-center h-full">
            <CardContent>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">{t('cropDoctor.client.resultPlaceholder')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const LoadingSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
);

    