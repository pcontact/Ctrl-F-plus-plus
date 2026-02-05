import { Voy } from "./voy-search-wrapper.js";

let _voyClient = null;
let _chunksMetadata = [];

// Deferred promise state
let _indexLoadPromise = null;
let _indexLoadResolver = null;

export class VectorStore {
  constructor(messenger = null) {
    this._messenger = messenger; // To be set by consumer for message passing
    if (this._messenger) {
      this._messenger({ type: "VECTOR_STORE_READY" });
    }
  }
  /* -----------------------------
   * Build & persist index
   * ----------------------------- */
  async buildIndex(chunks, embeddings) {
    const records = chunks.map((c, i) => ({
      id: c.id,
      title: c.id,
      url: c.metadata.url,
      embeddings: Array.from(embeddings[i])
    }));

    const resource = { embeddings: records };
    _voyClient = new Voy(resource);
    _chunksMetadata = chunks;

    const serialized = _voyClient.serialize();

    if (this._messenger) {
      this._messenger({
        type: "SET_VECTOR_INDEX",
        vectorIndex: serialized,
        chunksMeta: _chunksMetadata
      });
    } else {
      console.warn("No messenger set for VectorStore, cannot persist index");
    }
  }

  /* -----------------------------
   * Request index via postMessage
   * ----------------------------- */
  async loadIndex() {
    // If a load is already in flight, await it
    if (_indexLoadPromise) {
      await _indexLoadPromise;
      return;
    }

    _indexLoadPromise = new Promise(resolve => {
      _indexLoadResolver = resolve;
    });

    if(this._messenger) {
      this._messenger({ type: "REQUEST_VECTOR_INDEX" });
    } else {
      console.warn("No messenger set for VectorStore, cannot request index");
      _voyClient = null;
      _chunksMetadata = [];
      _indexLoadResolver();
    }

    await _indexLoadPromise;

    _indexLoadPromise = null;
    _indexLoadResolver = null;
  }

  /* -----------------------------
   * Query (waits until index exists)
   * ----------------------------- */
  async queryIndex(queryEmbedding, k = 3) {
    if (!_voyClient) {
      await this.loadIndex();
      if (!_voyClient) {
        throw new Error("Index not built");
      }
    }

    const queryVec = Float32Array.from(queryEmbedding);
    const result = _voyClient.search(queryVec, k);

    return result.neighbors.map(n => {
      const chunkMeta = _chunksMetadata.find(c => c.id === n.id);
      return {
        id: n.id,
        text: chunkMeta?.text ?? null,
        metadata: chunkMeta?.metadata ?? null,
        score: n.score
      };
    });
  }

  /* -----------------------------
   * Message handler (MUST be wired)
   * ----------------------------- */
  _handleMessage(event) {
    const msg = event.data;

    if (msg.type === "VECTOR_INDEX_RESPONSE") {
      if (msg.vectorIndex) {
        _voyClient = Voy.deserialize(msg.vectorIndex);
        _chunksMetadata = msg.chunksMeta || [];
      } else {
        _voyClient = null;
        _chunksMetadata = [];
      }

      if (_indexLoadResolver) {
        _indexLoadResolver();
      }
    }
  }


}
