import { Embedder } from "./src/lib/embedder.js";
import { VectorStore } from "./src/lib/vectorstore.js";
import { DebugConsole } from "./src/utils/helpers.js";

const DEBUG_MODE = true;
const debugConsole = new DebugConsole(DEBUG_MODE);

const vectorStoreMessenger = (msg) => {
  debugConsole.log("VectorStore sending message:", msg);
  chrome.runtime.sendMessage({ type: "VECTOR_STORE_RESPONSE", payload: msg });
}

const embedder = new Embedder();
const vectorStore = new VectorStore(vectorStoreMessenger);



console.log("Background: Initializing search handler...");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    console.log("Background: Received message:", message);

    const { type, payload } = message;

    switch (type) {
    case "VECTOR_STORE_RESPONSE":
        vectorStore._handleMessage({ data: payload });
        debugConsole.log("Received vector store data:", payload);
        break;
          
      case "INIT_EMBEDDER":
        debugConsole.log("Initializing embedder...");
        await embedder.initEmbedder();

        chrome.runtime.sendMessage({ type: "EMBEDDER_INITIALIZED" });
        debugConsole.log("Sent EMBEDDER_INITIALIZED");
        break;

      case "INDEX_PAGE":
        debugConsole.log("Indexing page...");
        try {
          const { chunks, sentences } = payload;

          chrome.runtime.sendMessage({
            type: "STATUS_UPDATE",
            status: "embedding",
            tabId: sender.tab?.id
          });


          const embeddings = await embedder.embedTexts(sentences);

          console.log("Embeddings obtained:", embeddings);

          chrome.runtime.sendMessage({
            type: "STATUS_UPDATE",
            status: "buildingIndex",
            tabId: sender.tab?.id
          });
          let k = await vectorStore.buildIndex(chunks, embeddings);
          console.log("Index built:", k);

          chrome.runtime.sendMessage({
            type: "PAGE_INDEXED",
            success: true,
            tabId: sender.tab?.id
          });

          debugConsole.log("PAGE_INDEXED (success)");
        } catch (error) {
          debugConsole.error("Error indexing page:", error);

          chrome.runtime.sendMessage({
            type: "PAGE_INDEXED",
            success: false,
            error: error.message,
            tabId: sender.tab?.id

          });
        }
        break;

      case "PERFORM_SEARCH":
        debugConsole.log("Performing search...");
        try {
          const { query } = payload;

          chrome.runtime.sendMessage({
            type: "STATUS_UPDATE",
            status: "searching",
            tabId: sender.tab?.id
          });

          const [queryEmbedding] = await embedder.embedTexts([query]);
          const neighbours = await vectorStore.queryIndex(queryEmbedding, 3);

          chrome.runtime.sendMessage({
            type: "SEARCH_RESULTS",
            results: neighbours,
            tabId: sender.tab?.id
          });

          debugConsole.log("SEARCH_RESULTS sent");
        } catch (error) {
          debugConsole.error("Search error:", error);

          chrome.runtime.sendMessage({
            type: "SEARCH_RESULTS",
            results: [],
            error: error.message,
            tabId: sender.tab?.id
          });
        }
        break;

      default:
        debugConsole.warn("Unknown message type:", type);
    }
  })();

  // Tell Chrome this listener is async
  return true;
});

