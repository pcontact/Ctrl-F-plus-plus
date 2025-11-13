

(  async () => {
  const embedder = new (await import("./lib/embedder.js")).Embedder()

  const vectorStore = new (await import('./lib/vectorstore.js')).VectorStore()
  const searchModule = (await import('./searchModule.js'))
  searchModule.init()

  async function extractChunksFromPage() {
    const paragraphs = Array.from(document.querySelectorAll("p"))
      .map(p => p.innerText.trim())
      .filter(t => t.length > 50);
    const chunks = paragraphs.map((text,i) => ({
      id: `chunk‑${i}`,
      text,
      metadata: { url: window.location.href, index: i }
    }));
    return chunks;
  }

  async function indexPage() {
    const chunks = await extractChunksFromPage();
    const sentences = chunks.map(c => c.text);
    console.log("sentences: ", sentences)
    const embeddings = await embedder.embedTexts(sentences);
    console.log(embeddings)
    vectorStore.buildIndex(chunks, embeddings);
  }

  // Trigger indexing when content script loads
  indexPage().catch(console.error);
})()
/*
class ContentScript {
  constructor() {
    this.initialize();
  }

  initialize() {
    console.log('Semantic Search content script loaded');
    return
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.indexPage());
    } else {
      this.indexPage();
    }

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
    });
  }

  // Index the page content
  async indexPage() {
    const pageText  = PageTextExtractor.extractMainTextFromDocument(document);
    const chunks =  pageText;
    const sentences = chunks.map(c => c.text);
    const embeddings = pagetex .embedTexts(sentences);
    buildIndex(chunks, embeddings);

    try {
      console.log('Starting page indexing...');
      
      //this.chunks = this.chunker.extractTextChunks();
      this.isIndexed = true;
      
      // Send indexed chunks to background script for storage
      chrome.runtime.sendMessage({
        type: 'PAGE_INDEXED',
        data: {
          url: window.location.href,
          chunks: this.chunks,
          chunkCount: this.chunks.length
        }
      });

      console.log(`Page indexed with ${this.chunks.length} chunks`);
      
    } catch (error) {
      console.error('Error indexing page:', error);
    }
  }

  // Handle messages from other parts of the extension
  handleMessage(request, sender, sendResponse) {
    switch (request.type) {
      case 'GET_PAGE_CHUNKS':
        sendResponse({
          success: true,
          chunks: this.chunks,
          isIndexed: this.isIndexed,
          url: window.location.href
        });
        break;

      case 'HIGHLIGHT_CHUNK':
        if (request.chunkIndex >= 0 && request.chunkIndex < this.chunks.length) {
          const chunk = this.chunks[request.chunkIndex];
          this.chunker.highlightChunk(chunk.element);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid chunk index' });
        }
        break;

      case 'REMOVE_HIGHLIGHTS':
        this.chunker.removeHighlights();
        sendResponse({ success: true });
        break;

      case 'REINDEX_PAGE':
        this.indexPage();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep message channel open for async response
  }

  // Get chunk statistics
  getStats() {
    return {
      chunkCount: this.chunks.length,
      isIndexed: this.isIndexed,
      url: window.location.href
    };
  }
}

// Initialize content script
const contentScript = new ContentScript();
*/