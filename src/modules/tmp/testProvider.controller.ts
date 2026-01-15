import { Request, Response } from "express";
import { GoogleLLMService } from "../../services/GoogleLLMService.js";
import { env } from "../../config/env.js";

export async function testGoogleLLMController(req: Request, res: Response) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
        example: {
          prompt: "Como ensinar subtração com zero?",
        },
      });
    }

    const llmService = new GoogleLLMService(env.googleApiKey);

    const startTime = Date.now();
    const response = await llmService.generateResponse(prompt);
    const latency = Date.now() - startTime;

    return res.json({
      success: true,
      model: llmService.getModelInfo(),
      latency_ms: latency,
      prompt,
      response,
    });
  } catch (error) {
    console.error("❌ Erro no teste Google LLM:", error);
    return res.status(500).json({
      error: "Failed to generate response",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
