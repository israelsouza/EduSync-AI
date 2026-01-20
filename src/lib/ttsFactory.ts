/**
 * TTS Factory
 *
 * Creates TTS service instances based on configuration.
 *
 * @module ttsFactory
 */

import { ITTSService } from "../interface/ITTSService.js";
import { GoogleTTSService } from "../services/GoogleTTSService.js";
import { AppError } from "../shared/AppError.js";
import { env } from "../config/env.js";

/**
 * Creates a TTS service instance based on the configuration
 *
 * @returns {ITTSService} Configured TTS service implementation
 */
export function createTTSService(): ITTSService {
  const provider = env.ttsProvider;

  switch (provider) {
    case "google":
      return new GoogleTTSService();

    // Future: Add local TTS providers
    // case "piper":
    //   return new PiperTTSService();

    default:
      throw new AppError(`Unknown TTS provider: ${provider}. Supported: google`, 400);
  }
}
