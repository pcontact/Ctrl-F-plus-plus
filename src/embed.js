import { pipeline, env } from "@xenova/transformers";

// ――― Setup the pipeline for embeddings ―――
async function embedSentences(sentences) {
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    { dtype: "fp16" }             // use fp32 for stability
  );

  const result = await extractor(sentences, {
    pooling: "mean",
    normalize: true
  });

  // convert tensor → nested JS arrays
  const vectors = result.tolist();
  return vectors;
}

// ――― Cosine similarity function ―――
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ――― Build top-k neighbours for each sentence ―――
async function topKNeighbours(embeddings, queries, k = 2) {
  const queryEmbeddings = await embedSentences(queries)
  //console.log(queryEmbeddings)

  const n = embeddings.length;
  const m = queryEmbeddings.length;
  const result = [];

  for (let j=0; j< m; j++){
    const sims = []
    for(let i=0; i<n; i++){
      const sim = cosineSimilarity(embeddings[i], queryEmbeddings[j])
      sims.push({index:j, query:queries[j], similarity:sim})
    }
     sims.sort((a, b) => b.similarity - a.similarity);
    result.push({
      query: queries[j],
      neighbours: sims.slice(0, k)
    });
  }
  return result;
}

// ――― Main execution ―――
async function main() {
  const sentences = [
    "Hello, how are you?",
    "Hi there, how’s it going?",
    "This is a test of embeddings.",
    "I’m just checking similarity of sentences.",
    "lost data are kept in the cloud for backup"
  ];
  const queries = ["how doe this document deal with lost data?"]

  const embeddings = await embedSentences(sentences);
  const neighbours = await topKNeighbours(embeddings, queries, 2);
  //console.log(neighbours)
  //return

  neighbours.forEach(item => {
    console.log(`\nQuery: “${item.query}”`);
    item.neighbours.forEach(n => {
      console.log(`  ↳ Neighbour: “${n.sentence}” — similarity: ${n.similarity.toFixed(4)}`);
    });
  });
}

// ――― Optional environment config for local models ―――
(function setupEnv() {
  env.localModelPath = "./model_files";
  env.allowRemoteModels = false;
})();

main().catch(err => {
  console.error("Error in embedding pipeline:", err);
});
