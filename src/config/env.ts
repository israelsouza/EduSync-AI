const CLOUD_PROVIDERS = ["openai", "google"] as const;
type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

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
  get embeddingProvider(): string {
    return getOptionalEnvVar("EMBEDDING_PROVIDER", "local").toLowerCase();
  },

  get isLocalEmbedding(): boolean {
    return this.embeddingProvider === "local";
  },

  get isCloudEmbedding(): boolean {
    return CLOUD_PROVIDERS.includes(this.embeddingProvider as CloudProvider);
  },

  // openai | google
  get llmProvider(): string {
    return getEnvVar("LLM_PROVIDER");
  },

  // active dependent on provider
  get openaiApiKey(): string {
    return getEnvVar("OPENAI_API_KEY");
  },
  get googleApiKey(): string {
    return getEnvVar("GOOGLE_API_KEY");
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
      if (this.embeddingProvider === "openai") void this.openaiApiKey;
      if (this.embeddingProvider === "google") void this.googleApiKey;
    }

    // Validate LLM Provider
    console.log(`🤖 LLM Provider: ${this.llmProvider}`);
    if (this.llmProvider === "openai") void this.openaiApiKey;
    if (this.llmProvider === "google") void this.googleApiKey;

    console.log("✅ Configurations validated successfully.");
  },
} as const;
