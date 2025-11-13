import {Voy} from "./voy-search-wrapper.js";
import { silentImport } from "../utils/helpers";

let wasm = null


let _voyClient = null;
let _chunksMetadata = [];
export class VectorStore{
  async buildIndex(chunks, embeddings) {
    /*
    if(!false){ // ignore
      wasm = await silentImport("../wasm/voy-search/voy_search_bg.wasm").then((e)=>{
        console.log(e)
      });
      console.log(wasm)
      __wbg_set_wasm(wasm)
    }*/
    const records = chunks.map((c,i) => ({
      id: c.id,
      title: c.id,            // you can map id→title if you like
      url: c.metadata.url,
      embeddings: Array.from(embeddings[i])
    }));
    const resource = { embeddings: records };
    _voyClient = new Voy(resource);

    _chunksMetadata = chunks;
    // persist the serialized index (via Voy.serialize()) & metadata
    const serialized = _voyClient.serialize();
    chrome.storage.local.set({
      vectorIndex: serialized,
      chunksMeta: _chunksMetadata
    });
  }

  async loadIndex() {
    const data = await new Promise(resolve => {
      chrome.storage.local.get(["vectorIndex","chunksMeta"], resolve);
    });
    if (data.vectorIndex) {
      _voyClient = Voy.deserialize(data.vectorIndex);
    } else {
      _voyClient = null;
    }
    _chunksMetadata = data.chunksMeta || [];
  }

  async queryIndex(queryEmbedding, k=3) {
    if (!_voyClient) {
      await this.loadIndex();
      if (!_voyClient) throw new Error("Index not built");
    }
    const queryVec = Float32Array.from(queryEmbedding);
    const result = _voyClient.search(queryVec, k);
    console.log("Search reult: ", result)
    return result.neighbors.map(n => {
      const chunkMeta = _chunksMetadata.find(c => c.id === n.id);
      console.log("ChunkMeta: ", chunkMeta)
      return {
        id: n.id,
        text: chunkMeta ? chunkMeta.text : null,
        metadata: chunkMeta ? chunkMeta.metadata : null,
        score: n.score
      };
    });
  } 
}
