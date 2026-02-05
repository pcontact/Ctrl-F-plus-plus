import { Embedder } from "../lib/embedder.js";
import { VectorStore } from "../lib/vectorstore.js";
import { DebugConsole } from "../utils/helpers.js";

const DEBUG_MODE = true;
const debugConsole = new DebugConsole(DEBUG_MODE);

const embedder = new Embedder();
const vectorStore = new VectorStore();

console.log("Worker: Initializing search worker...");
// Listen for messages from the main thread
self.onmessage = async (event) => {
  console.log("Worker: Received message from offscreen:", event.data);
  const { type, payload } = event.data;

  switch (type) {
    case "INIT_EMBEDDER":
      debugConsole.log("Worker: Initializing embedder...");
      await embedder.initEmbedder();
      self.postMessage({ type: "EMBEDDER_INITIALIZED" });
      debugConsole.log("Worker: Posted EMBEDDER_INITIALIZED message.");
      break;

    case "INDEX_PAGE":
      debugConsole.log("Worker: Indexing page...");
      try {
        const { chunks, sentences } = payload;
        self.postMessage({ type: "STATUS_UPDATE", status: "embedding" });
        const embeddings = await embedder.embedTexts(sentences);
        self.postMessage({ type: "STATUS_UPDATE", status: "buildingIndex" });
        vectorStore.buildIndex(chunks, embeddings);
        self.postMessage({ type: "PAGE_INDEXED", success: true });
        debugConsole.log("Worker: Posted PAGE_INDEXED message (success).");
      } catch (error) {
        debugConsole.error("Worker: Error indexing page:", error);
        self.postMessage({ type: "PAGE_INDEXED", success: false, error: error.message });
        debugConsole.log("Worker: Posted PAGE_INDEXED message (error).");
      }
      break;

    case "PERFORM_SEARCH":
      debugConsole.log("Worker: Performing search...");
      try {
        const { query } = payload;
        self.postMessage({ type: "STATUS_UPDATE", status: "searching" });
        const [queryEmbedding] = await embedder.embedTexts([query]);
        const neighbours = await vectorStore.queryIndex(queryEmbedding, 3);
        self.postMessage({ type: "SEARCH_RESULTS", results: neighbours });
        debugConsole.log("Worker: Posted SEARCH_RESULTS message.");
      } catch (error) {
        debugConsole.error("Worker: Error performing search:", error);
        self.postMessage({ type: "SEARCH_RESULTS", results: [], error: error.message });
        debugConsole.log("Worker: Posted SEARCH_RESULTS message (error).");
      }
      break;

    default:
      debugConsole.warn("Worker: Unknown message type:", type);
  }
};
