export async function getAndSetWasm(url) {
  const glueModule = await import("../../node_modules/voy-search/voy_search_bg.js");

  const response = await fetch(url);
  const bytes = await response.arrayBuffer();

  const imports = { "./voy_search_bg.js": glueModule };

  const { instance } = await WebAssembly.instantiate(bytes, imports);
  glueModule.__wbg_set_wasm(instance.exports);

  return instance.exports;
}

await getAndSetWasm(chrome.runtime.getURL("wasm/voy-search/voy_search_bg.wasm"));

export * from "../../node_modules/voy-search/voy_search_bg.js";
