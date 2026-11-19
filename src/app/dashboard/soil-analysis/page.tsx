"use client";

import { SoilAnalysisClient } from './_components/soil-analysis-client';
import { useTranslation } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';

export default function SoilAnalysisPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Layers className="h-6 w-6" />
            </span>
            <h1 className="text-3xl font-bold font-headline">
              {t('soilAnalysis.title') || 'Soil Doctor & Crop Advisor'}
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            {t('soilAnalysis.description') ||
              'Upload a photo of your field soil or dirt to identify soil type, pH, fertility, and get AI-recommended crops with ICAR agronomic guidance.'}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('profile.backToDashboard') || 'Back to Dashboard'}
          </Link>
        </Button>
      </div>
      <SoilAnalysisClient />
    </div>
  );
}
