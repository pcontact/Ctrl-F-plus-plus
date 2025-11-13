// gemini_offscreen.test.js
import "./gemini_local.js";

// --- Mock Chrome Runtime API ---
global.chrome = {
  runtime: {
    onMessage: {
      addListener: (cb) => { global.__messageHandler = cb; },
    },
    onConnect: {
      addListener: (cb) => { global.__connectHandler = cb; },
    },
    sendMessage: () => {},
  },
};

// --- Mock Language Model API ---
class FakeSession {
  constructor(opts = {}) {
    this.opts = opts;
    this.destroyed = false;
    this.inputUsage = 0;
    this.inputQuota = 100;
  }

  async prompt(messages) {
    this.inputUsage += 10;
    return `[assistant reply to: ${messages.map(m => m.content).join(" ")}]`;
  }

  async *promptStreaming(messages, { signal }) {
    const reply = `[stream reply to: ${messages.map(m => m.content).join(" ")}]`;
    for (const chunk of reply.split(" ")) {
      if (signal.aborted) throw new Error("aborted");
      yield chunk + " ";
      await new Promise(r => setTimeout(r, 5));
    }
  }

  async destroy() {
    this.destroyed = true;
  }
}

const FakeLanguageModel = {
  availability: async () => "available",
  create: async (opts) => new FakeSession(opts),
};

// Inject fake LanguageModel into global scope
global.LanguageModel = FakeLanguageModel;

// --- Test helpers ---
async function triggerAskGeminiLocal(text, conversationId = "conv1") {
  return new Promise((resolve) => {
    const sendResponse = (resp) => resolve(resp);
    const msg = {
      action: "askGeminiLocal",
      text,
      conversationId,
      history: [],
      systemPrompt: "You are a test assistant.",
      persist: true,
    };
    global.__messageHandler(msg, null, sendResponse);
  });
}

async function triggerStreamGemini(text, conversationId = "conv1") {
  const port = {
    name: "gemini-offscreen",
    _messages: [],
    postMessage(data) { this._messages.push(data); },
    onMessage: { addListener: (cb) => (this._listener = cb) },
    onDisconnect: { addListener: () => {} },
  };

  global.__connectHandler(port);
  const id = "req1";
  port._listener({ action: "start", id, text, conversationId, persist: true });
  await new Promise(r => setTimeout(r, 200));
  return port._messages;
}

// --- Actual Tests ---
(async () => {
  console.log("🧩 Test 1: Basic askGeminiLocal...");
  const resp1 = await triggerAskGeminiLocal("Hello Gemini!");
  console.log("Response:", resp1);

  console.log("🧩 Test 2: Streaming mode...");
  const streamData = await triggerStreamGemini("Stream this please.");
  console.log("Stream output:", streamData.map(m => m.chunk || m.reply));

  console.log("🧩 Test 3: Session reuse...");
  const resp2 = await triggerAskGeminiLocal("Continue the chat.", "conv1");
  console.log("Response:", resp2);

  console.log("✅ All tests completed.");
})();
