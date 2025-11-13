import { Embedder } from "./lib/embedder.js";
import { VectorStore } from "./lib/vectorstore.js";

const embedder = new Embedder()
const vectorStore = new VectorStore()
document.getElementById("askBtn").addEventListener("click", async () => {
  const query = document.getElementById("query").value.trim();
  if (!query) return;

  // embed the query
  console.log("Query: ", query)
  const [queryEmbedding] = await embedder.embedTexts ([query]);
  console.log("Embedding: ", queryEmbedding)
  // retrieve top chunks
  const neighbours = await vectorStore.queryIndex(queryEmbedding, 3);
  console.log(neighbours)

  // Prepare prompt for your LLM integration
  const contextText = neighbours.map(n => n.text).join("\n---\n");

  // Example: call your LLM API with prompt including contextText + query
  const prompt = `Context from webpage:\n${contextText}\n\nQuestion: ${query}\nAnswer:`;

  // (You need to implement sendToLLM and handle response)
  const answer = await sendToLLM(prompt);

  // Display results
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = `
    <h4>Answer:</h4><p>${answer}</p>
    <h4>Retrieved passages:</h4>
    <ul>
      ${neighbours.map(n => `<li>${n.text} (score: ${n.score ? n.score.toFixed(4) : "N/A"})</li>`).join("")}
    </ul>
  `;
});

function sendToLLM(prompt){
  console.log(prompt)
}
