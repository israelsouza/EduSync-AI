/**
 * TTS Factory
 *
 * Creates TTS service instances based on configuration.
 * Supports cloud (Google) and local (Piper) TTS providers.
 *
 * @module ttsFactory
 */

import { ITTSService } from "../interface/ITTSService.js";
import { GoogleTTSService } from "../services/GoogleTTSService.js";
import { PiperTTSService } from "../services/PiperTTSService.js";
import { AppError } from "../shared/AppError.js";
import { env } from "../config/env.js";

/**
 * Supported TTS providers
 * - google: Google Cloud Text-to-Speech (requires internet + API key)
 * - piper: Local Piper TTS via tts-pipelines (offline capable)
 */
export type TTSProvider = "google" | "piper";

/**
 * Creates a TTS service instance based on the configuration
 *
 * @returns {ITTSService} Configured TTS service implementation
 */
export function createTTSService(): ITTSService {
  const provider = env.ttsProvider as TTSProvider;

  switch (provider) {
    case "google":
      console.log("[TTSFactory] Creating GoogleTTSService (cloud)");
      return new GoogleTTSService();

    case "piper":
      console.log("[TTSFactory] Creating PiperTTSService (local/offline)");
      return new PiperTTSService();

    default:
      throw new AppError(`Unknown TTS provider: ${provider}. Supported: google, piper`, 400);
  }
}

/**
 * Creates a specific TTS service regardless of configuration
 * Useful for testing or when you need a specific provider
 *
 * @param provider - The TTS provider to create
 * @returns {ITTSService} The specified TTS service implementation
 */
export function createSpecificTTSService(provider: TTSProvider): ITTSService {
  switch (provider) {
    case "google":
      return new GoogleTTSService();
    case "piper":
      return new PiperTTSService();
    default:
      throw new AppError(`Unknown TTS provider: ${provider}`, 400);
  }
}
