

(  async () => {
  const searchModule = (await import('./searchModule.js'))
  searchModule.init()
  /*
  const embedder = new (await import("./lib/embedder.js")).Embedder()

  const vectorStore = new (await import('./lib/vectorstore.js')).VectorStore()
  
  return
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
    //console.log("sentences: ", sentences)
    const embeddings = await embedder.embedTexts(sentences);
    //console.log(embeddings)
    vectorStore.buildIndex(chunks, embeddings);
  }

  // Trigger indexing when content script loads
  indexPage().catch(console.error);
  */
})()