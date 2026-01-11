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
  embeddingProvider: getOptionalEnvVar("EMBEDDING_PROVIDER", "local").toLowerCase(),

  // API Keys (loaded lazily to avoid errors if not using that provider)
  get openaiApiKey(): string {
    return getEnvVar("OPENAI_API_KEY");
  },
  get googleApiKey(): string {
    return getEnvVar("GOOGLE_API_KEY");
  },

  // Supabase
  get supabaseUrl(): string {
    return getEnvVar("SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return getEnvVar("SUPABASE_ANON_KEY");
  },

  validate() {
    console.log(`🔍 Validando configurações para o provedor: ${this.embeddingProvider}`);

    // Sempre valida o Supabase
    void this.supabaseUrl;
    void this.supabaseAnonKey;

    // Valida apenas o que o provedor atual exige
    if (this.embeddingProvider === "openai") void this.openaiApiKey;
    if (this.embeddingProvider === "google") void this.googleApiKey;

    console.log("✅ Configurações validadas com sucesso.");
  },
} as const;
