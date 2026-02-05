
import { positionPanelAtPoint, DebugConsole} from "./utils/helpers.js"
import { createGeminiRouter } from "./utils/universal_gemini_router.js"
import Mark from "mark.js";
import { PageTextExtractor } from "./utils/extractMainText.js";

const context = document.body;
const markInstance = new Mark(context);

class StatusClass {
  #status;

  constructor() {
    this.#status = StatusClass.STATUS_DICT.idle;

    // listeners for direct status changes
    this._statusListeners = {};

    // listeners for status_log changes
    this._logListeners = {};

    // listeners for status observer
    this._statusObserverListeners = []

    this.STATUS_LOG = {
      extract: false,
      embed: false,
      buildIndex: false,
      pageIndexed: false
    };
  }

  static STATUS_DICT = {
    idle: "idle",
    extracting: "extracting",
    embedding: "embedding",
    searching: "searching",
    filtering: "filtering"
  };

  static STATUS_LOG_DICT = {
    extract: "extract",
    embed: "embed",
    buildIndex: "buildIndex",
    pageIndexed: "pageIndexed"
  };

  setStatus(status) {
    this.#status = status;
    debugConsole.log("Setting status: ", status)

    // fire listeners attached to the given status value
    const listeners = this._statusListeners[status];
    if (listeners) {
        debugConsole.log("Calling listeners: ", listeners,  "Status: ", status)

      for (const { fn, arg } of listeners) fn(arg);
    }

    //fire observers
    this._statusObserverListeners.forEach(fn =>{
      fn(status)
    })
  }

  getStatus() {
    return this.#status;
  }

  registerForStatusChange(fn, arg, status) {
    if (!this._statusListeners[status]) {
      this._statusListeners[status] = [];
    }
    debugConsole.log("Regitering status change: fn", fn, " arg:", arg, " status:", status)
    this._statusListeners[status].push({ fn, arg });
  }

  // -------- STATUS_LOG support --------

  setLogFlag(flag, value) {
    if (!(flag in this.STATUS_LOG)) return;

    this.STATUS_LOG[flag] = value;
    debugConsole.log("Setting flag: ", flag)

    // fire log listeners attached to this log flag
    const listeners = this._logListeners[flag];
    if (listeners) {
      debugConsole.log("Calling listeners: ", listeners,  "Flag: ", flag)

      for (const { fn, arg } of listeners) fn(arg);
    }
  }

  registerForLogChange(flag, fn, arg) {
    if (!this._logListeners[flag]) {
      this._logListeners[flag] = [];
    }
      debugConsole.log("Registering for log change: fn", fn, " arg:", arg, " flag:", flag)

    this._logListeners[flag].push({ fn, arg });

  }

  registerStatusChangeObserver(fn) {
    this._statusObserverListeners.push(fn);
  }
}

const statusClass = new StatusClass()
statusClass.registerStatusChangeObserver(updateStatusEl)

const geminiRouter = createGeminiRouter()

const DEBUG_MODE = true
const debugConsole = new DebugConsole(DEBUG_MODE)


const PREFIX = 'gsw'; // short prefix to avoid collisions (Gideon Search Widget)
let widgetExists = false;
let resultsContainerRef = null;
let rootContainerId = `${PREFIX}SearchContainer`;
let cssId = `${PREFIX}Styles`;
let lastMousePosition = { x: 0, y: 0 };
let statusBar = null

// ----------------- CSS Injection -----------------
export function injectCSS() {
  if (document.getElementById(cssId)) return;
  const s = document.createElement('style');
  s.id = cssId;
  s.textContent = `
  .${PREFIX}-highlight {
    background-color: yellow;
  }

  /* Isolation reset for the widget */
  #${rootContainerId}, #${rootContainerId} * { 
    all: unset; 
    box-sizing: border-box; 
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; 
  }

  /* Root container */
  #${rootContainerId} { 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    width: 100%; 
    max-width: 500px; 
  }

  /* --- Search bar and close button container --- */
  #${rootContainerId} .${PREFIX}-search-bar-container {
    display: flex;
    align-items: stretch;
    gap: 6px;
    width: 100%;
  }

  /* Search bar (multiline textarea) */
  #${rootContainerId} .${PREFIX}-search-bar { 
    flex: 1;
    min-height: calc(1.2em * 3 + 16px); 
    max-height: calc(1.2em * 3 + 16px); 
    padding: 10px; 
    border-radius: 8px; 
    resize: none; 
    overflow: auto; 
    line-height: 1.2; 
    border: 1px solid; 
    font-size: 14px;
  }

  #${rootContainerId} .${PREFIX}-search-bar::placeholder { 
    opacity: 0.7; 
  }

  /* Close / Exit Button */
  #${rootContainerId} .${PREFIX}-close-btn {
    width: 36px;
    border-radius: 8px;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid;
    transition: filter 120ms ease, transform 100ms ease;
    user-select: none;
  }

  #${rootContainerId} .${PREFIX}-close-btn:hover {
    filter: brightness(0.85);
    transform: scale(1.05);
  }

  /* Results container */
  #${rootContainerId} .${PREFIX}-results-container { 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    width: 100%; 
    align-items: stretch; 
  }

  /* Individual result */
  #${rootContainerId} .${PREFIX}-result { 
    padding: 10px; 
    border-radius: 8px; 
    cursor: default; 
    transition: transform 120ms ease, filter 120ms ease; 
    word-wrap: break-word; 
    overflow: hidden; 
    width: 100%; 
    border: 1px solid; 
  }

  /* Clamp result text to 3 lines */
  #${rootContainerId} .${PREFIX}-result .text { 
    display: -webkit-box; 
    -webkit-line-clamp: 3; 
    -webkit-box-orient: vertical; 
    overflow: hidden; 
    white-space: normal; 
  }

  /* Hover effect for results */
  #${rootContainerId} .${PREFIX}-result:hover { 
    transform: scale(1.02); 
    filter: brightness(0.92); 
    cursor: pointer; 
  }

  /* --- Light theme --- */
  @media (prefers-color-scheme: light) {
    #${rootContainerId} .${PREFIX}-search-bar { 
      background: #fff; 
      color: #111; 
      border-color: #d0d0d0; 
    }

    #${rootContainerId} .${PREFIX}-result { 
      background: #f4f8ff; 
      color: #04204a; 
      border-color: rgba(4,32,74,0.06); 
    }

    #${rootContainerId} .${PREFIX}-close-btn { 
      background: #fff; 
      color: #333; 
      border-color: #d0d0d0; 
    }
  }

  #${rootContainerId} .${PREFIX}-status-bar {
    display: block;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    border: 1px solid;
    background-color: var(--status-bg, #f0f0f0);
    color: var(--status-color, #111);
    box-shadow: var(--status-shadow, none);
    transition: background 200ms ease, color 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
  }

  /* Light theme */
  @media (prefers-color-scheme: light) {
    #${rootContainerId} .${PREFIX}-status-bar {
      --status-bg: #fafafa;           /* soft, slightly warm */
      --status-color: #111;           /* high contrast text */
      --status-shadow: 0 1px 3px rgba(0,0,0,0.08); /* subtle elevation */
      border-color: #ddd;             /* lighter, soft border */
    }
  }

  /* --- Dark theme --- */
  @media (prefers-color-scheme: dark) {
    #${rootContainerId} .${PREFIX}-status-bar {
      --status-bg: #1e2026;           /* deep, soft dark */
      --status-color: #e6eef8;        /* readable light text */
      --status-shadow: 0 1px 3px rgba(0,0,0,0.5); /* subtle dark shadow */
      border-color: #333;             /* muted border for dark */
    }

    #${rootContainerId} .${PREFIX}-search-bar { 
      background: #0f1113; 
      color: #e6eef8; 
      border-color: #30343a; 
    }

    #${rootContainerId} .${PREFIX}-result { 
      background: #111826; 
      color: #cfe3ff; 
      border-color: rgba(255,255,255,0.04); 
    }

    #${rootContainerId} .${PREFIX}-close-btn { 
      background: #0f1113; 
      color: #e6eef8; 
      border-color: #30343a; 
    }
  }
  `;
  document.head.appendChild(s);
}


// ----------------- HTML Injection -----------------
export function injectHTML(container = document.body) {
  const existing = document.getElementById(rootContainerId);
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = rootContainerId;
  root.className = `${PREFIX}-search-root`;

  // wrap search bar and close button in a flex container
  root.innerHTML = `
    <div
    <div class="${PREFIX}-search-bar-container">
      <textarea class="${PREFIX}-search-bar" placeholder="What are you looking for? Type 5 or more words that make up your query to continue" rows="3"></textarea>
      <button class="${PREFIX}-close-btn" title="Close">&times;</button>
    </div>
  `;

  statusBar = document.createElement("div");
  statusBar.className = `${PREFIX}-status-bar`
  statusBar.textContent = "searching"

  container.appendChild(root);
  root.appendChild(statusBar)
  widgetExists = true;

  const textarea = root.querySelector(`.${PREFIX}-search-bar`);
  const closeBtn = root.querySelector(`.${PREFIX}-close-btn`);

  if (textarea) {
    textarea.addEventListener('input', (e) => {
      const ev = new CustomEvent('search-key', { detail: { value: textarea.value, originalEvent: e }, bubbles: true, composed: true });
      root.dispatchEvent(ev);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const ev = new CustomEvent('search-enter', { detail: { value: textarea.value, originalEvent: e }, bubbles: true, composed: true });
        root.dispatchEvent(ev);
      }
    });
  }

  // handle close
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const ev = new CustomEvent('search-close', { bubbles: true, composed: true });
      root.dispatchEvent(ev);
      root.remove(); // remove widget from DOM
    });
  }
  return root;
}


// ----------------- Results Helpers -----------------
// createResultsFromList(list) => returns a results container DOM node with .${PREFIX}-results-container
export function createResultsFromList(list = []) {
  const container = document.createElement('div');
  container.className = `${PREFIX}-results-container`;
  list.forEach(item => {
    //debugConsole.log(item)
    const r = document.createElement('div');
    r.className = `${PREFIX}-result`;
    // id and data-id set
    if (item && (item.id !== undefined && item.id !== null)) r.setAttribute('data-id', String(item.id));

    const span = document.createElement('div');
    span.className = 'text';
    span.textContent = item && item.text ? item.text : '';
    r.appendChild(span);

    container.appendChild(r);
  });

  // attach delegated click handler for result items
  container.addEventListener('click', (ev) => {
    const target = ev.target;
    const resultEl = target.closest && target.closest(`.${PREFIX}-result`);
    if (!resultEl) return;
    const root = document.getElementById(rootContainerId);
    if (!root) return;
    const id = resultEl.getAttribute('data-id');
    const text = resultEl.textContent || '';
    const clickEv = new CustomEvent('result-click', { detail: { id, text, originalEvent: ev }, bubbles:true, composed:true });
    // dispatch from root so consumer can listen on container
    root.dispatchEvent(clickEv);
  });

  resultsContainerRef = container; // keep reference
  return container;
}

// setResultsContainer(rootEl, resultsContainerNode)
// inserts the results container into the widget root (removes previous if present)
export function setResultsContainer(rootEl, resultsNode) {
  if (!rootEl) rootEl = document.getElementById(rootContainerId);
  if (!rootEl) return false;

  // remove existing
  const existing = rootEl.querySelector(`.${PREFIX}-results-container`);
  if (existing) existing.remove();

  if (resultsNode) {
    rootEl.appendChild(resultsNode);
    resultsContainerRef = resultsNode;
    return true;
  }
  return false;
}

// deleteSearchResultContainer(el) -> removes any results container within given element (or global root if omitted)
export function deleteSearchResultContainer(el = null) {
  const container = el || document.getElementById(rootContainerId);
  if (!container) return false;
  const found = container.querySelectorAll(`.${PREFIX}-results-container`);
  let removed = false;
  found.forEach(n => { n.remove(); removed = true; });
  if (removed) resultsContainerRef = null;
  return removed;
}

// ----------------- Utility / Small API -----------------
export function inject(container = document.body, options={position:"mouse"}) {
  injectCSS();
  const rootEl = injectHTML(container); // returns root element
  if (options.position === 'mouse') {
    positionPanelAtPoint(rootEl, lastMousePosition);
  }
  statusBar.style.display = "none"
  return rootEl;
}

export function getSearchValue() {
  const root = document.getElementById(rootContainerId);
  if (!root) return '';
  const ta = root.querySelector(`.${PREFIX}-search-bar`);
  return ta ? ta.value : '';
}

export function setSearchValue(v) {
  const root = document.getElementById(rootContainerId);
  if (!root) return;
  const ta = root.querySelector(`.${PREFIX}-search-bar`);
  if (ta) ta.value = v;
}

export function focusSearch() {
  const root = document.getElementById(rootContainerId);
  if (!root) return;
  const ta = root.querySelector(`.${PREFIX}-search-bar`);
  if (ta) ta.focus();
}

// Small convenience to build-and-set results in one call
export function populateResults(list) {
  const root = document.getElementById(rootContainerId);
  if (!root) return null;
  const rc = createResultsFromList(list);
  setResultsContainer(root, rc);
  return rc;
}

// Expose a tiny debug helper
export function hasWidget() { return !!document.getElementById(rootContainerId); }

// Default export (optional) — keep named exports primary
export default {
  injectCSS,
  injectHTML,
  inject,
  createResultsFromList,
  setResultsContainer,
  deleteSearchResultContainer,
  populateResults,
  getSearchValue,
  setSearchValue,
  focusSearch,
  hasWidget,
};

export function init(){
  //debugConsole.log("search module ready")
  window.addEventListener('mousemove', (e) => {
    lastMousePosition = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  let keyStack = []
  let timerId = null
  window.addEventListener("keydown", (e)=>{
    //debugConsole.log(e)
    keyStack.push(e.key)
    if(keyStack.length > 3)keyStack.slice(keyStack.length - 3)
    //debugConsole.log(keyStack.length)
    if(keyStack.length == 3 && keyStack[0] == "Control" && keyStack[1] == "Shift" && keyStack[2].toLowerCase() == "f"){
      e.stopPropagation()
      inject();
      focusSearch()
      keyStack = []
      //debugConsole.log(keyStack)
      return
    }
    //if(timerId != null) clearTimeout(timerId)
    timerId = setTimeout(() => {
      keyStack.shift()
      //debugConsole.log(keyStack)
    }, 1000);
  })

  window.addEventListener('search-key', (e)=>{
    removeHighlights()
  })

  window.addEventListener("search-enter", async (e)=>{
    const query = getSearchValue()
    await performSearch(query)
    
    return
    debugConsole.log("search enter presed")

    const result = createResultsFromList([{id:"1", text:"hello helem=n"},{id:"2", text:"hello james"}])
    const rootContainer = document.getElementById(rootContainerId)
    rootContainer.appendChild(result)
  })

  window.addEventListener("result-click", (e)=>{
    const searchText = e.detail.text;

    const matches = [];

    markInstance.mark(searchText, {
      element: "span",
      className: `${PREFIX}-highlight`,
      separateWordSearch: false,
      acrossElements: true,

      // Use exclude to skip entire containers
      exclude: [
        "#gswSearchContainer",   // skip by ID
        "[class^='gsw']"         // skip any element whose class begins with "gsw"
      ],

      each: function(node) {
        matches.push(node);
      },

      done: function(totalMatches) {
        console.log("Total matches (excluding gsw nodes):", totalMatches);
        console.log("Matched nodes:", matches);
        if (matches.length > 0) {
          const first = matches[0];
          console.log("First match element:", first);
          console.log("OffsetTop:", first.offsetTop);

          // Give the browser a moment to render
          setTimeout(() => {
            first.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);  
        }
      },

      noMatch: function(term) {
        console.log("No matches for:", term);
      },

      debug: false
    });

  })

  window.addEventListener("search-close", ()=>{
    removeHighlights()
  })
}

  
async function performSearch(query){
  if (!query) return;
  if (!statusClass.STATUS_LOG.pageIndexed) {
    statusClass.registerForLogChange(StatusClass.STATUS_LOG_DICT.pageIndexed, performSearch, query);
    statusClass.registerForStatusChange((e) => { console.log(e.toUpperCase()) }, "status change", StatusClass.STATUS_DICT.embedding);
    indexPage();
    return;
  }
  // remove previous highlights:
  removeHighlights();

  // Send message to background script to perform search
  chrome.runtime.sendMessage({ type: "PERFORM_SEARCH", payload: { query } });
}

async function sendToLLM(query, results){
  const prompt = `
  You are an expert assistant. Your task is to analyze the user's query and the provided top results, and respond **only** in a strict format. Follow these steps exactly:

  1. Identify which results directly answer the user query.
    - A result **directly answers** the query if it contains explicit instructions, facts, or steps that fully satisfy the query.
    - Include partial matches **only if they provide significant context directly related to the query** (e.g., mention key entities or actions from the query). Do not include irrelevant, general, or metadata content.

  2. Respond strictly with **two sections in this order**:

  ## results
  - A JSON array of the IDs of all results that meet the criteria above. Example:
  ["chunk-1", "chunk-3"]

  ## insight
  - A single, concise, one-sentence insight. Follow these rules:
    * If one or more results directly answer the query, write: "Relevant results matching the query were found in the top results."
    * If no results directly answer the query, write: "No relevant results matching the query were found in the top results."
    * If only partial matches exist, write: "Only partial context was found; no direct answers were identified."

  **Important rules:**
  - Only include the two sections (## results and ## insight) in your output. No extra commentary or text.
  - Ensure JSON is valid, parsable, and properly quoted.
  - Do not infer answers beyond what is explicitly stated in the results.

  **User query format:**
  "This can be any user query"

  **Result format:**
  [
    { "id": "chunk-1", "text": "some text", "metadata": { "url": "...", "index": 1 } },
    ...
  ]

  **Example:**

  User query:
  "How do I save my work in Krita?"

  Top 3 results:
  [
    { "id": "chunk-2", "text": "Click on File from the application menu at the top.", "metadata": { "url": "...", "index": 2 } },
    { "id": "chunk-15", "text": "© Copyright licensed under the GNU Free Documentation License.", "metadata": { "url": "...", "index": 15 } },
    { "id": "chunk-12", "text": "The save option is in the top-menu of File, then Save. Select folder and file format.", "metadata": { "url": "...", "index": 12 } }
  ]

  Expected output:
  ## results
  ["chunk-2", "chunk-12"]

  ## insight
  "Relevant results matching the query were found in the top results."

  ---

  User query:
  "${query}"

  Top ${results.length} results:
  ${JSON.stringify(results)}

  Respond now in the required format, strictly following the rules above.
  `;

  //debugConsole.log(prompt)
  //return
  const result = await geminiRouter.ask({
    text: prompt,
    history:[],
    persistSession:false
  })
  console.log("rESULT:", result)
}


async function extractChunksFromPage() {
  statusClass.setStatus(StatusClass.STATUS_DICT.extracting)
  const paragraphs = Array.from(document.querySelectorAll("p"))
    .map(p => p.innerText.trim())
    .filter(t => t.length > 50);
  const chunks = paragraphs.map((text,i) => ({
    id: `chunk‑${i}`,
    text,
    metadata: { url: window.location.href, index: i }
  }));
  statusClass.setLogFlag(StatusClass.STATUS_LOG_DICT.extract, true)
  return chunks;
}

async function indexPage() {
  if(statusClass.STATUS_LOG.pageIndexed) return // only index if pageIndexed is false

  const chunks = await extractChunksFromPage();
  const sentences = chunks.map(c => c.text);
  
  // Send message to background script to index the page
  chrome.runtime.sendMessage({ type: "INDEX_PAGE", payload: { chunks, sentences } });
}

function updateStatusEl(status){
  if(statusBar.style.display == "none") statusBar.style.display = "block"
  statusBar.textContent = status + "..."
}

function removeHighlights() {
  markInstance.unmark({
    element: "span",
    className: `${PREFIX}-highlight`,
    done: function() {
      console.log("Removed only the highlight spans.");
    }
  });
}

// Listen for messages from the background script (which forwards from the offscreen document)
chrome.runtime.onMessage.addListener((message) => {
  const { type, status, results, success, error } = message;

  switch (type) {
    case "STATUS_UPDATE":
      statusClass.setStatus(status);
      break;
    case "PAGE_INDEXED":
      if (success) {
        statusClass.setLogFlag(StatusClass.STATUS_LOG_DICT.embed, true);
        statusClass.setLogFlag(StatusClass.STATUS_LOG_DICT.buildIndex, true);
        statusClass.setLogFlag(StatusClass.STATUS_LOG_DICT.pageIndexed, true);
        debugConsole.log("Main: Page indexed successfully.");
      } else {
        debugConsole.error("Main: Page indexing failed:", error);
      }
      break;
    case "SEARCH_RESULTS":
      if (results) {
        debugConsole.log("Main: Search results received:", results);
        statusBar.style.display = "none";
        populateResults(results);
        statusClass.setStatus(StatusClass.STATUS_DICT.idle); // Set status back to idle after search
      } else {
        debugConsole.error("Main: Error receiving search results:", error);
      }
      break;
    default:
      debugConsole.warn("Main: Unknown message type from background:", type);
  }
});

// Initialize embedder in offscreen document when the module loads
chrome.runtime.sendMessage({ type: "INIT_EMBEDDER" });
