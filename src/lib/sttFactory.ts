import { ISTTService } from "../interface/ISTTService.js";
import { GoogleSTTService } from "../services/GoogleSTTService.js";
import { AppError } from "../shared/AppError.js";
import { env } from "../config/env.js";

/**
 * Creates an STT service instance based on the configuration
 *
 * @returns {ISTTService} Configured STT service implementation
 */
export function createSTTService(): ISTTService {
  const provider = env.sttProvider;

  switch (provider) {
    case "google":
      return new GoogleSTTService();

    default:
      throw new AppError(`Unknown STT provider: ${provider}. Supported: google`, 400);
  }
}
