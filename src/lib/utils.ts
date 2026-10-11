import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanCropDiagnosisText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\(in\s+(?:en|hi|pa|mr|bn|ta|kn|bho)\)\s*:?/gi, '')
    .replace(/\(in\s+[a-z]{2}\)\s*:?/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


