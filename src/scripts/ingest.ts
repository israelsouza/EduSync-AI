import { createHash } from "crypto";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import supabase from "../lib/supabaseClient";

/**
 * Generates a deterministic UUID from source, page, and chunk index.
 * This ensures repeated ingestion runs update existing rows instead of creating duplicates.
 */
function generateDeterministicId(source: string, page: number, chunkIndex: number): string {
  const input = `${source}_page_${page}_chunk_${chunkIndex}`;
  const hash = createHash("sha256").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function runIngestion() {
  try {
    console.log("Loading PDF...");
    const loader = new PDFLoader("uploads/manual_exemplo.pdf");
    const rawDocs = await loader.load();
    console.log(`Pages loaded: ${rawDocs.length}`);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 600,
      chunkOverlap: 100,
    });

    console.log("Truncating text into chunks...");
    const docs = await splitter.splitDocuments(rawDocs);
    console.log(`Generated documents: ${docs.length}`);

    console.log(`Initializing local AI...`);
    const embeddings = new HuggingFaceTransformersEmbeddings({
      model: "Xenova/all-MiniLM-L6-v2", // O nome do modelo pode variar conforme o modelo baixado
    });

    const ids = docs.map((doc, idx) => {
      const source = (doc.metadata["source"] as string) || "unknown";
      const page = (doc.metadata["loc"]?.pageNumber as number) ?? 0;
      return generateDeterministicId(source, page, idx);
    });
    console.log(`Generated ${ids.length} deterministic IDs`);

    console.log("Sending to Supabase...");
    // Create vector store instance first, then add documents with custom IDs
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: "pedagogical_knowledge_v384",
      queryName: "match_documents_v384",
    });
    await vectorStore.addDocuments(docs, { ids });

    console.log("✅ Ingest finally with success!");
  } catch (error) {
    console.error("❌ Fatal error trying to do ingestion:", error);
  }
}

runIngestion();
