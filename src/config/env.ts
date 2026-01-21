const CLOUD_PROVIDERS = ["google"] as const;
type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

const SUPPORTED_LLM_PROVIDERS = ["google"] as const;
type LLMProvider = (typeof SUPPORTED_LLM_PROVIDERS)[number];

const getEnvVar = (key: string, required = true): string => {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`${key} environment variable is not set`);
  }
  return value ?? "";
};

const getOptionalEnvVar = (key: string, defaultValue = ""): string => {
  return process.env[key] ?? defaultValue;
};

export const env = {
  /**
   * Embedding Provider Configuration
   *
   * Determines how text embeddings are generated for vector search.
   *
   * Options:
   * - "local": Uses HuggingFace model (384-dim) running locally. No API key required.
   *   Ideal for offline-first scenarios and privacy. Default value.
   * - "google": Uses Google's embedding API. Requires GOOGLE_API_KEY.
   *
   * Note: Local embeddings are generated on-device for privacy and offline capability.
   * Cloud providers offer higher accuracy but require internet and API costs.
   * Additional cloud providers may be added in future milestones.
   */
  get embeddingProvider(): string {
    return getOptionalEnvVar("EMBEDDING_PROVIDER", "local").toLowerCase();
  },

  get isLocalEmbedding(): boolean {
    return this.embeddingProvider === "local";
  },

  get isCloudEmbedding(): boolean {
    return CLOUD_PROVIDERS.includes(this.embeddingProvider as CloudProvider);
  },

  /**
   * LLM Provider Configuration
   *
   * Determines which Large Language Model service to use for generating responses.
   *
   * Options:
   * - "google": Uses Google's Gemini models. Requires GOOGLE_API_KEY.
   *
   * Note: Unlike embeddings, LLM services are always cloud-based and require API keys.
   * No local LLM option is currently implemented (see Milestone 4 for future local TTS/STT).
   *
   * This provider powers the "Sunita" persona for pedagogical advice generation.
   */
  get llmProvider(): string {
    return getEnvVar("LLM_PROVIDER");
  },

  get isSupportedLLMProvider(): boolean {
    return SUPPORTED_LLM_PROVIDERS.includes(this.llmProvider as LLMProvider);
  },

  /**
   * Google Model Configuration
   */
  get googleModel(): string {
    return getOptionalEnvVar("GOOGLE_MODEL", "gemini-2.5-flash");
  },

  /**
   * Google STT Model Configuration
   *
   * Model used specifically for Speech-to-Text (audio transcription).
   * Must be a model that supports audio input (multimodal).
   * Default: gemini-2.5-flash (supports audio)
   */
  get googleSTTModel(): string {
    return getOptionalEnvVar("GOOGLE_STT_MODEL", "gemini-2.5-flash");
  },

  /**
   * STT Provider Configuration
   *
   * Determines which Speech-to-Text service to use.
   * Options:
   * - "google": Uses Google's Gemini for multimodal transcription. Requires GOOGLE_API_KEY.
   */
  get sttProvider(): string {
    return getOptionalEnvVar("STT_PROVIDER", "google").toLowerCase();
  },

  /**
   * TTS Provider Configuration
   *
   * Determines which Text-to-Speech service to use.
   * Options:
   * - "google": Uses Google Cloud Text-to-Speech API. Requires GOOGLE_API_KEY.
   * - "piper": Local TTS using tts-pipelines + ONNX Runtime. Fully offline.
   *
   * Use "google" for best quality, "piper" for offline capability.
   */
  get ttsProvider(): string {
    return getOptionalEnvVar("TTS_PROVIDER", "google").toLowerCase();
  },

  // active dependent on provider
  get googleApiKey(): string {
    return getEnvVar("GOOGLE_API_KEY");
  },

  get openaiApiKey(): string {
    return getOptionalEnvVar("OPENAI_API_KEY");
  },

  get supabaseUrl(): string {
    return getEnvVar("SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return getEnvVar("SUPABASE_ANON_KEY");
  },

  validate() {
    console.log(`🔍 Checking configs...`);

    // check Supabase settings
    void this.supabaseUrl;
    void this.supabaseAnonKey;

    // Validate Embedding Provider
    console.log(`📦 Embedding Provider: ${this.embeddingProvider}`);
    if (this.isCloudEmbedding) {
      if (this.embeddingProvider === "google") void this.googleApiKey;
    }

    // Validate LLM Provider
    console.log(`🤖 LLM Provider: ${this.llmProvider}`);
    if (!this.isSupportedLLMProvider) {
      throw new Error(`Invalid LLM_PROVIDER "${this.llmProvider}". Supported providers: ${SUPPORTED_LLM_PROVIDERS.join(", ")}`);
    }
    if (this.llmProvider === "google") void this.googleApiKey;

    // Validate STT
    console.log(`🎙️ STT Provider: ${this.sttProvider}`);

    // Validate TTS
    console.log(`🔊 TTS Provider: ${this.ttsProvider}`);

    console.log(`🎯 Google Model: ${this.googleModel}`);

    console.log("✅ Configurations validated successfully.");
  },
} as const;
