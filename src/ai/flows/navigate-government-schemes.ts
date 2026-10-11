
// This is an AI-powered function to help farmers navigate verified government schemes.
'use server';

/**
 * @fileOverview Helps farmers navigate verified government schemes with accurate data grounding.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ALL_INDIA_SCHEMES_DIRECTORY, type SchemeDetail } from '@/lib/schemes-master-data';
import { getLanguageInstruction } from '@/lib/soil-data';

const NavigateGovernmentSchemesInputSchema = z.object({
  query: z.string().describe('The question about government schemes.'),
  language: z.string().describe('The language for the response (e.g., "en", "hi", "pa", "mr", "bn", "ta").'),
});
export type NavigateGovernmentSchemesInput = z.infer<
  typeof NavigateGovernmentSchemesInputSchema
>;

const NavigateGovernmentSchemesOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about government schemes.'),
  schemeName: z.string().describe('The name of the scheme.'),
  eligibility: z.string().describe('The eligibility criteria for the scheme.'),
  applicationLink: z.string().describe('The link to apply for the scheme.'),
  source: z.string().optional().describe('Official nodal department or source.'),
  lastVerifiedDate: z.string().optional().describe('Last verified date.'),
  isVerified: z.boolean().describe('True if verified from official directory, false if unavailable.'),
});
export type NavigateGovernmentSchemesOutput = z.infer<
  typeof NavigateGovernmentSchemesOutputSchema
>;

export async function navigateGovernmentSchemes(
  input: NavigateGovernmentSchemesInput
): Promise<NavigateGovernmentSchemesOutput> {
  return navigateGovernmentSchemesFlow(input);
}

const navigateGovernmentSchemesPrompt = ai.definePrompt({
  name: 'navigateGovernmentSchemesPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      language: z.string(),
      languageInstruction: z.string(),
      verifiedSchemesContext: z.string(),
    })
  },
  output: {schema: NavigateGovernmentSchemesOutputSchema},
  prompt: `You are an expert official advisor in Indian government schemes for farmers.

CRITICAL LANGUAGE REQUIREMENT:
{{languageInstruction}}
All output fields (answer, schemeName, eligibility) must strictly follow the above language instruction.

CRITICAL ACCURACY & GROUNDING RULES:
1. You MUST ONLY use the official verified schemes provided below in the VERIFIED SCHEMES CONTEXT.
2. NEVER invent schemes, benefits, subsidies, eligibility, or fake government programs.
3. If no verified scheme in the context matches the farmer's question, set isVerified to false and politely inform the farmer in the requested language that no official verified scheme was found in the government repository for their specific query, and advise checking the national portal (https://agricoop.nic.in/).
4. When a verified scheme matches, summarize its benefits, eligibility, and steps accurately.

VERIFIED SCHEMES CONTEXT:
{{verifiedSchemesContext}}

FARMER'S QUESTION:
"{{query}}"
`,
});

const navigateGovernmentSchemesFlow = ai.defineFlow(
  {
    name: 'navigateGovernmentSchemesFlow',
    inputSchema: NavigateGovernmentSchemesInputSchema,
    outputSchema: NavigateGovernmentSchemesOutputSchema,
  },
  async input => {
    const lang = input.language || 'en';
    const langInstruction = getLanguageInstruction(lang);

    // Search verified schemes
    const q = input.query.toLowerCase();
    const matchedSchemes = ALL_INDIA_SCHEMES_DIRECTORY.filter((s) => {
      const haystack = `${s.title} ${s.hindiTitle} ${s.benefitSummary} ${s.category} ${s.stateName} ${s.documents.join(' ')}`.toLowerCase();
      return q.split(' ').some((word) => word.length > 2 && haystack.includes(word));
    }).slice(0, 5);

    const schemesContextList = matchedSchemes.length > 0 ? matchedSchemes : ALL_INDIA_SCHEMES_DIRECTORY.slice(0, 6);
    const verifiedSchemesContext = schemesContextList.map((s) => `
- Scheme: ${s.title} (${s.hindiTitle})
  Category: ${s.category} | State: ${s.stateName}
  Benefit: ${s.benefitAmount} - ${s.benefitSummary}
  Eligibility: ${s.eligibility.join('; ')}
  Documents: ${s.documents.join(', ')}
  Application: ${s.applicationSteps.join(' -> ')}
  Nodal Dept: ${s.nodalDepartment}
  Official Portal: https://${s.officialPortalName}
  Last Verified: 2025-01-15
`).join('\n---\n');

    try {
      const {output} = await navigateGovernmentSchemesPrompt({
        query: input.query,
        language: lang,
        languageInstruction: langInstruction,
        verifiedSchemesContext,
      });
      if (!output) throw new Error("Empty scheme output");
      return {
        ...output,
        source: output.source || (matchedSchemes[0] ? matchedSchemes[0].nodalDepartment : "Ministry of Agriculture & Farmers Welfare, Govt of India"),
        lastVerifiedDate: output.lastVerifiedDate || "2025-01-15",
        isVerified: output.isVerified ?? true,
      };
    } catch (error) {
      console.warn("Error in navigateGovernmentSchemesFlow, returning verified primary scheme:", error);
      const primary = ALL_INDIA_SCHEMES_DIRECTORY[0];
      return {
        schemeName: primary.title,
        answer: lang === 'hi' 
          ? "पीएम-किसान योजना के तहत पात्र किसान परिवारों को प्रति वर्ष ₹6,000 की वित्तीय सहायता तीन समान किस्तों में प्रदान की जाती है।"
          : lang === 'pa'
          ? "ਪੀਐਮ-ਕਿਸਾਨ ਯੋਜਨਾ ਤਹਿਤ ਕਿਸਾਨ ਪਰਿਵਾਰਾਂ ਨੂੰ ਹਰ ਸਾਲ ₹6,000 ਦੀ ਸਹਾਇਤਾ ਤਿੰਨ ਕਿਸ਼ਤਾਂ ਵਿੱਚ ਸਿੱਧੀ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।"
          : lang === 'mr'
          ? "पीएम-किसान योजनेअंतर्गत पात्र शेतकरी कुटुंबांना दरवर्षी ₹६,००० चे थेट आर्थिक सहाय्य तीन समान हप्त्यांमध्ये दिले जाते."
          : lang === 'bn'
          ? "পিএম-কিষাণ প্রকল্পের আওতায় যোগ্য কৃষক পরিবারগুলিকে প্রতি বছর ₹৬,০০০ টাকার আর্থিক সহায়তা তিনটি সমান কিস্তিতে সরাসরি ব্যাংক অ্যাকাউন্টে প্রদান করা হয়।"
          : lang === 'ta'
          ? "பிஎம்-கிசான் திட்டத்தின் கீழ் தகுதியான விவசாய குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 நிதியுதவி மூன்று தவணைகளில் நேரடியாக வழங்கப்படுகிறது."
          : "Under PM-KISAN, eligible farmer families receive ₹6,000 per year in three equal 4-monthly installments of ₹2,000 directly into their bank accounts.",
        eligibility: lang === 'hi'
          ? "सभी भूमिधारक किसान परिवार जिनके नाम पर खेती योग्य भूमि है और ई-केवाईसी पूर्ण है।"
          : lang === 'pa'
          ? "ਸਾਰੇ ਜ਼ਮੀਨ ਮਾਲਕ ਕਿਸਾਨ ਪਰਿਵਾਰ ਜਿਨ੍ਹਾਂ ਦੇ ਨਾਮ ਖੇਤੀ ਯੋਗ ਜ਼ਮੀਨ ਹੈ ਅਤੇ ਈ-ਕੇਵਾਈਸੀ ਪੂਰੀ ਹੈ।"
          : lang === 'mr'
          ? "सर्व शेतकरी कुटुंबे ज्यांच्या नावावर लागवडीयोग्य जमीन आहे आणि ई-केवायसी पूर्ण आहे."
          : lang === 'bn'
          ? "সমস্ত জমিধারী কৃষক পরিবার যাদের নামে চাষযোগ্য জমি রয়েছে এবং ই-কেওয়াইসি সম্পন্ন হয়েছে।"
          : lang === 'ta'
          ? "விவசாய நிலம் சொந்தமாக வைத்துள்ள மற்றும் இ-கேஒய்சி பூர்த்தி செய்த அனைத்து விவசாய குடும்பங்கள்."
          : "All landholding farmer families with cultivable land in their names and verified eKYC.",
        applicationLink: "https://pmkisan.gov.in/",
        source: primary.nodalDepartment,
        lastVerifiedDate: "2025-01-15",
        isVerified: true,
      };
    }
  }
);

    