import { Embeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddings } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { env } from "../config/env";

export const createEmbeddingsFromEnv = (): Embeddings => {
  const provider = env.embeddingProvider;

  switch (provider) {
    case "openai":
      return new OpenAIEmbeddings({
        apiKey: env.openaiApiKey,
        modelName: "text-embedding-ada-002",
      });
    case "google":
      return new GoogleGenerativeAIEmbeddings({
        apiKey: env.googleApiKey,
        modelName: "embedding-001",
      });
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }
};
