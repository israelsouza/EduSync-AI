import {
  ISTTService,
  STTConfig,
  TranscriptionResult,
  STTModelInfo,
  STTStreamCallback,
  DEFAULT_STT_CONFIG,
  SupportedLanguage,
} from "../interface/ISTTService.js";
import { AudioChunk } from "../interface/IAudioStreamHandler.js";
import { env } from "../config/env.js";

/**
 * Google Gemini STT Service Implementation
 *
 * Uses Gemini 1.5 Flash to transcribe audio data.
 * This is a multimodal approach that provides high accuracy.
 */
export class GoogleSTTService implements ISTTService {
  private config: STTConfig;
  private apiKey: string;

  constructor() {
    this.apiKey = env.googleApiKey;
    this.config = { ...DEFAULT_STT_CONFIG };
  }

  async initialize(config?: Partial<STTConfig>): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    return !!this.apiKey;
  }

  async transcribe(audioData: ArrayBuffer, config?: Partial<STTConfig>): Promise<TranscriptionResult> {
    const activeConfig = { ...this.config, ...config };
    const startTime = Date.now();

    try {
      // Convert ArrayBuffer to Base64 (safely handling offsets if any)
      const buffer = Buffer.from(audioData);
      const base64Audio = buffer.toString("base64");
      const mimeType = this.getMimeType(activeConfig.encoding);

      // Call Gemini API via REST (Multimodal Transcription)
      // Use specific STT model that supports audio input
      const model = env.googleSTTModel;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

      console.log(`[GoogleSTT] Requesting transcription...`);
      console.log(`[GoogleSTT] Model: ${model}`);
      console.log(`[GoogleSTT] URL: ${url.replace(this.apiKey, "REDACTED")}`);
      console.log(`[GoogleSTT] Audio Size: ${buffer.length} bytes`);
      console.log(`[GoogleSTT] MimeType: ${mimeType}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: "Transcrição exata do áudio. Retorne APENAS o texto transcrito, sem comentários.",
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            topP: 1,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(`Google STT Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = (await response.json()) as any;
      const transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const processingTimeMs = Date.now() - startTime;

      return {
        id: `google_${Date.now()}`,
        isFinal: true,
        alternatives: [
          {
            transcript: transcribedText,
            confidence: 1.0,
          },
        ],
        audioDurationMs: 0,
        processingTimeMs,
        timestamp: new Date().toISOString(),
        modelId: env.googleModel,
      };
    } catch (error) {
      console.error("Transcription failed:", error);
      throw error;
    }
  }

  async transcribeChunks(chunks: AudioChunk[], config?: Partial<STTConfig>): Promise<TranscriptionResult> {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk.data), offset);
      offset += chunk.data.byteLength;
    }

    return this.transcribe(combined.buffer, config);
  }

  private getMimeType(encoding: string): string {
    switch (encoding) {
      case "mp3":
        return "audio/mpeg";
      case "wav":
        return "audio/wav";
      case "opus":
        return "audio/webm";
      case "pcm":
        return "audio/l16"; // Note: PCM might need conversion or specific header in real usage
      case "flac":
        return "audio/flac";
      default:
        return "audio/webm";
    }
  }

  // Interface stubs
  async startStreaming(_callback: STTStreamCallback, _config?: Partial<STTConfig>): Promise<string> {
    throw new Error("Streaming not supported in Gemini STT implementation");
  }
  async feedAudioChunk(_sessionId: string, _chunk: AudioChunk): Promise<void> {
    throw new Error("Streaming not supported");
  }
  async endStreaming(_sessionId: string): Promise<TranscriptionResult> {
    throw new Error("Streaming not supported");
  }
  async cancelStreaming(_sessionId: string): Promise<void> {}
  async detectLanguage(_audioData: ArrayBuffer): Promise<{ language: SupportedLanguage; confidence: number }> {
    return { language: "auto" as SupportedLanguage, confidence: 0 };
  }
  async isModelReady(): Promise<boolean> {
    return true;
  }
  async downloadModel(): Promise<void> {}
  async deleteModel(): Promise<void> {}
  async getAvailableModels(): Promise<STTModelInfo[]> {
    return [
      {
        id: env.googleModel,
        name: `Google ${env.googleModel}`,
        version: "2.5",
        languages: ["pt-BR", "en-US", "es-419" as SupportedLanguage],
        sizeBytes: 0,
        isLocal: false,
        supportsStreaming: false,
        estimatedAccuracy: 0.99,
      },
    ];
  }
  async getCurrentModelInfo(): Promise<STTModelInfo | null> {
    return (await this.getAvailableModels())[0] || null;
  }
  getConfig(): STTConfig {
    return this.config;
  }
  async updateConfig(config: Partial<STTConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }
  async dispose(): Promise<void> {}
}
