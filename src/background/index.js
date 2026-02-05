import "./gemini.js";

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: path,
      reasons: ['WORKERS'],
      justification: 'Run embedding and vector search off the main thread'
    });
  }
}

// Initialize offscreen document
setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

// Listen for messages from content scripts and forward to offscreen document
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  //console.log("Background received message:", message);
  if (message.type === "PERFORM_SEARCH" || message.type === "INDEX_PAGE" || message.type === "INIT_EMBEDDER") {
    console.log("Background forwarding message to offscreen document:", message);
    await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH); // Ensure it's open
    chrome.runtime.sendMessage(message); // Forward to offscreen.js
  }
  if(message.type === "SET_VECTOR_INDEX"){
    chrome.storage.local.set({ vectorIndex: message.vectorIndex, chunksMeta: message.chunksMeta }, () => {
      console.log("Vector index and metadata stored in local storage.");
    });
  }
  
  if (message.type === "CLEAR_VECTOR_INDEX") {
    chrome.storage.local.clear(() => {
      console.log("Vector index and metadata cleared from local storage.");
    });
  }

  if (message.type === "REQUEST_VECTOR_INDEX") {
    chrome.storage.local.get(['vectorIndex', 'chunksMeta'], (result) => {
      console.log("Vector index and metadata retrieved from local storage:", result);
      chrome.runtime.sendMessage({ type: "VECTOR_STORE_RESPONSE", payload: { vectorIndex: result.vectorIndex, chunksMeta: result.chunksMeta } });
    });
  }

  if((message.type === "STATUS_UPDATE" || message.type === "SEARCH_RESULTS" || message.type === "PAGE_INDEXED") && message.tabId) {
    console.log(message)
    chrome.tabs.sendMessage(message?.tabId, message);
  }

});

console.log("🔧 Unified background initialized: Semantic + Gemini active");
