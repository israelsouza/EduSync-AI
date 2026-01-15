import { Embeddings } from "@langchain/core/embeddings";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { env } from "../config/env";

export const createEmbeddingsFromEnv = (): Embeddings => {
  const provider = env.embeddingProvider;

  switch (provider) {
    case "google":
      return new GoogleGenerativeAIEmbeddings({
        apiKey: env.googleApiKey,
        modelName: "embedding-001",
      });
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }
};
