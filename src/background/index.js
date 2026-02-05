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
  if (message.type === "PERFORM_SEARCH" || message.type === "INDEX_PAGE" || message.type === "INIT_EMBEDDER") {
    console.log("Background forwarding message to offscreen document:", message);
    await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH); // Ensure it's open
    chrome.runtime.sendMessage(message); // Forward to offscreen.js
  }
});

console.log("🔧 Unified background initialized: Semantic + Gemini active");
