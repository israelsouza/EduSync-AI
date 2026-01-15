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
   * @throws {TypeError} If LLM response content is not a string or cannot be converted
   * @throws {Error} If API call fails or response is invalid
   */
  async generateResponse(prompt: string): Promise<string> {
    const messages = [new SystemMessage(SUNITA_SYSTEM_PROMPT), new HumanMessage(prompt)];

    try {
      const response = await this.model.invoke(messages);

      // Validate response exists
      if (!response || response.content === undefined || response.content === null) {
        throw new Error("LLM returned empty or invalid response");
      }

      // Handle different content types
      const { content } = response;

      // String: return directly
      if (typeof content === "string") {
        return content;
      }

      // Array: join into single string
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item !== null && "text" in item) return String(item.text);
            return String(item);
          })
          .join("");
      }

      // Object: extract text field or serialize
      if (typeof content === "object" && "text" in content) {
        return String((content as { text: unknown }).text);
      }

      // Fallback: throw TypeError for unsupported types
      throw new TypeError(`LLM response content must be a string, received ${typeof content}: ${JSON.stringify(content)}`);
    } catch (error) {
      // Rethrow TypeError as-is
      if (error instanceof TypeError) {
        throw error;
      }

      // Wrap other errors with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate LLM response: ${errorMessage}`, { cause: error });
    }
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
