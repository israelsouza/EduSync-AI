import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ILLMService } from "../interface/ILLMService.js";
import { SUNITA_SYSTEM_PROMPT } from "../prompts/systemPrompt.js";

/**
 * Google Gemini LLM Service Implementation
 *
 * Uses ChatGoogleGenerativeAI from LangChain to generate responses
 * with the Sunita pedagogical assistant persona.
 */
export class GoogleLLMService implements ILLMService {
  private model: ChatGoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName = "gemini-2.5-flash") {
    this.modelName = modelName;
    this.model = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: this.modelName,
      temperature: 1.0,
      maxOutputTokens: 1024,
      maxRetries: 3,
    });
  }

  /**
   * Generate a response using Google's Gemini model
   *
   * @param prompt - The formatted prompt with context and query
   * @returns Generated response text
   * @throws {TypeError} If LLM response content is not a string
   */
  async generateResponse(prompt: string): Promise<string> {
    const messages = [new SystemMessage(SUNITA_SYSTEM_PROMPT), new HumanMessage(prompt)];

    const response = await this.model.invoke(messages);

    if (typeof response.content !== "string") {
      throw new TypeError("LLM response content must be a string");
    }

    return response.content;
  }

  /**
   * Get information about the current model configuration
   */
  getModelInfo(): { provider: string; model: string } {
    return {
      provider: "google",
      model: this.modelName,
    };
  }
}
