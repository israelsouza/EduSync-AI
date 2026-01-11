import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import supabase from "../lib/supabaseClient";

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

    console.log("Sending to Supabase...");
    await SupabaseVectorStore.fromDocuments(docs, embeddings, {
      client: supabase,
      tableName: "pedagogical_knowledge_v384",
      queryName: "match_documents_v384",
    });

    console.log("✅ Ingest finally with success!");
  } catch (error) {
    console.error("❌ Fatal error trying to do ingestion:", error);
  }
}

runIngestion();
