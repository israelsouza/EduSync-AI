import { IVectorService, SearchResult } from "../interface/IVectorService.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import supabase from "../lib/supabaseClient.js";

export class LocalVectorService implements IVectorService {
  private vectorStore: SupabaseVectorStore;

  constructor() {
    const embeddings = new HuggingFaceTransformersEmbeddings({
      model: "Xenova/all-MiniLM-L6-v2",
    });

    this.vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: "pedagogical_knowledge_v384",
      queryName: "match_documents",
    });
  }

  async search(query: string, limit = 3): Promise<SearchResult[]> {
    const results = await this.vectorStore.similaritySearchWithScore(query, limit);

    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score,
    }));
  }
}
