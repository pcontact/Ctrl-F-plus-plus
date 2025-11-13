import { pipeline, env } from "@xenova/transformers";
import { DebugConsole } from "../utils/helpers.js"

const DEBUG_MODE = true
const debugConsole = new DebugConsole(DEBUG_MODE)
// ――― Setup the pipeline for embeddings ―――
let _extractor = null //global extractor
export class Embedder{
  constructor(){
    debugConsole.log("initializing embedder...")
    env.localModelPath = chrome?.runtime.getURL("../model_files") || "../model_files";
    env.allowRemoteModels = false;
    env.backends.onnx.wasm.wasmPaths = chrome?.runtime.getURL("../wasm/onnx/")
  }
  async initEmbedder(sentences) {
    if(_extractor) return
    _extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { dtype: "fp16" }             // use fp32 for stability
    );
  }

  // ――― Main execution ―――
  async embedTexts(texts) {
    await this.initEmbedder()
    const result  = await _extractor (texts, {
      pooling: "mean",
      normalize: true
    });
    //debugConsole.log("result:", result)
    const vectors = result.tolist();
    return vectors;
  }
}

//const k = new Embedder()
//console.log(await k.embedTexts(["hello joy"]))

