export interface ILLMService {
  generateResponse(prompt: string): Promise<string>;
  getModelInfo(): { provider: string; model: string };
}
