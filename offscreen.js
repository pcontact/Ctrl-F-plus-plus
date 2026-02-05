const path = chrome.runtime.getURL("src/searchWorker.js");
console.log("searchWorker path:", path);
const worker = new Worker(path, {
  type: "module"
});

console.log("worker created:", worker);

chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log("Offscreen received message from background:", msg);
  worker.postMessage(msg);
  console.log("Offscreen posted message to worker:", msg);
});

worker.onmessage = (e) => {
    console.log("Offscreen received message from worker:", e.data);
    chrome.runtime.sendMessage(e.data);
};

console.log(worker)
