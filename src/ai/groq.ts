import Groq from "groq-sdk";

const groqApiKey =
  process.env.GROQ_API_KEY ||
  process.env.NEXT_PUBLIC_GROQ_API_KEY ||
  "";

export const isGroqConfigured = Boolean(groqApiKey && groqApiKey.trim().length > 0);

export const groqClient = isGroqConfigured
  ? new Groq({ apiKey: groqApiKey.trim() })
  : null;

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const FAST_GROQ_MODEL = "openai/gpt-oss-20b";
export const CANDIDATE_GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallGroqChatOptions {
  messages: GroqChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Call Groq Cloud API for ultra-fast LLM responses with automatic model fallback
 */
export async function callGroqChat({
  messages,
  model = DEFAULT_GROQ_MODEL,
  temperature = 0.3,
  maxTokens = 1024,
  jsonMode = false,
}: CallGroqChatOptions): Promise<string> {
  if (!groqClient) {
    throw new Error("GROQ_API_KEY is not configured in environment variables.");
  }

  const modelsToTry = [model, ...CANDIDATE_GROQ_MODELS.filter((m) => m !== model)];
  let lastError: any = null;

  for (const m of modelsToTry) {
    try {
      const completion = await groqClient.chat.completions.create({
        model: m,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      });

      const content = completion.choices[0]?.message?.content;
      if (content && content.trim().length > 0) {
        return content;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Groq model ${m} failed:`, err?.message || err);
    }
  }

  throw lastError || new Error("All Groq models failed to generate response.");
}
