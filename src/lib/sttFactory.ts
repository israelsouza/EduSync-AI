import { ISTTService } from "../interface/ISTTService.js";
import { GoogleSTTService } from "../services/GoogleSTTService.js";
import { WhisperSTTService } from "../services/WhisperSTTService.js";
import { AppError } from "../shared/AppError.js";
import { env } from "../config/env.js";

/**
 * Creates an STT service instance based on the configuration
 *
 * Supported providers:
 * - "google": Cloud-based STT using Google Gemini (requires API key, internet)
 * - "whisper": Local STT using whisper.cpp (requires model download, works offline)
 *
 * @returns {ISTTService} Configured STT service implementation
 */
export function createSTTService(): ISTTService {
  const provider = env.sttProvider;

  switch (provider) {
    case "google":
      return new GoogleSTTService();

    case "whisper":
      return new WhisperSTTService();

    default:
      throw new AppError(`Unknown STT provider: ${provider}. Supported: google, whisper`, 400);
  }
}
