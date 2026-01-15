import { ILLMService } from "../interface/ILLMService.js";
import { env } from "../config/env.js";
import { AppError } from "../shared/AppError.js";
import { GoogleLLMService } from "../services/GoogleLLMService.js";

/**
 * Creates an LLM service instance based on the configured provider
 *
 * @returns {ILLMService} Configured LLM service implementation
 * @throws {AppError} If provider is unknown or required API keys are missing
 */
export function createLLMService(): ILLMService {
  const provider = env.llmProvider;

  switch (provider) {
    case "google":
      if (!env.googleApiKey) {
        throw new AppError("GOOGLE_API_KEY is required when LLM_PROVIDER=google", 500);
      }
      return new GoogleLLMService(env.googleApiKey);

    default:
      throw new AppError(`Unknown LLM provider: ${provider}. Supported: google`, 400);
  }
}
