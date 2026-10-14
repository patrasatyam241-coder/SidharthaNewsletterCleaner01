import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cleanNewsletterHtml, cleanNewsletterHtml2 } from "./lib/cleanHtml.js";
import {
  loadHistory,
  saveHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
  createHistoryEntry,
} from "./lib/history.js";
import { SAMPLE_HTML } from "./lib/sampleHtml.js";
import { HistoryModal } from "./components/HistoryModal.jsx";
import { EditorSearchBar } from "./components/EditorSearch.jsx";
import { useEditorSearch } from "./lib/useEditorSearch.js";
import "./App.css";

const CLEANER1_OPTIONS = {
  href: true,
  src: true,
  businessEmails: true,
  personalEmails: true,
  numbers: true,
};

const CLEANER1_LABELS = [
  { key: "href", label: "Hrefs", icon: "\u{1F517}", desc: "Strip domain from href links" },
  { key: "src", label: "Srcs", icon: "\u{1F4F7}", desc: "Strip domain from src images" },
  { key: "businessEmails", label: "Business Emails", icon: "\u{1F4E7}", desc: "Remove @ only" },
  { key: "personalEmails", label: "Personal Emails", icon: "\u{1F464}", desc: "Remove @ and dots" },
  { key: "numbers", label: "Numbers", icon: "\u{1F522}", desc: "Remove phone numbers" },
];

const CLEANER2_OPTIONS = {
  removeLinks: false,
  removeSrc: false,
  removeText: false,
  removeNumbers: false,
};

const CLEANER2_LABELS = [
  { key: "removeLinks", label: "Remove Links", icon: "\u{1F517}", desc: "href \u2192 #" },
  { key: "removeSrc", label: "Remove SRC", icon: "\u{1F4F7}", desc: "src \u2192 #" },
  { key: "removeText", label: "Remove Text", icon: "\u{1F4DD}", desc: "Strip visible text" },
  { key: "removeNumbers", label: "Remove Numbers", icon: "\u{1F522}", desc: "Remove phone numbers" },
];

function cleanAll(html, opts1, opts2) {
  let result1 = cleanNewsletterHtml(html, opts1);
  let result2 = cleanNewsletterHtml2(result1.html, opts2);
  return {
    html: result2.html,
    stats: {
      hrefs: result1.stats.hrefs,
      srcs: result1.stats.srcs,
      emails: result1.stats.emails,
      numbers: result1.stats.numbers + result2.stats.numbers,
      links: result2.stats.links,
      text: result2.stats.text,
    },
  };
}

const EMPTY_PREVIEW = "<div style='color:#999;font-family:sans-serif;padding:40px;text-align:center'>Your newsletter preview will appear here...</div>";

function safeHtml(html) {
  if (!html || !html.trim()) return "";
  return html;
}

function App() {
  const [inputHtml, setInputHtml] = useState("");
  const [outputHtml, setOutputHtml] = useState("");
  const [options1, setOptions1] = useState(CLEANER1_OPTIONS);
  const [options2, setOptions2] = useState(CLEANER2_OPTIONS);
  const [stats, setStats] = useState({ hrefs: 0, srcs: 0, emails: 0, numbers: 0, links: 0, text: 0 });
  const [hasCleaned, setHasCleaned] = useState(false);
  const [message, setMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const [viewMode, setViewMode] = useState("preview");
  const messageTimer = useRef(null);

  // ─── In-editor search for both textareas ───────────────────────
  const inputSearch = useEditorSearch();
  const codeSearch = useEditorSearch();

  // Global keydown: only intercept Ctrl+F when a textarea is focused
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        const el = document.activeElement;
        if (el && el.tagName === "TEXTAREA") {
          if (el === inputSearch.textareaRef.current) {
            e.preventDefault();
            inputSearch.handleKeyDown(e);
          } else if (el === codeSearch.textareaRef.current) {
            e.preventDefault();
            codeSearch.handleKeyDown(e);
          }
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [inputSearch, codeSearch]);

  const showMessage = useCallback((text, type = "success") => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage({ text, type });
    messageTimer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  const runClean = useCallback(
    (html, opts1, opts2, saveHist = false) => {
      if (!html.trim()) {
        setOutputHtml("");
        setStats({ hrefs: 0, srcs: 0, emails: 0, numbers: 0, links: 0, text: 0 });
        setHasCleaned(false);
        return;
      }
      try {
        const result = cleanAll(html, opts1, opts2);
        setOutputHtml(result.html);
        setStats(result.stats);
        setHasCleaned(true);

        if (saveHist) {
          const entry = createHistoryEntry(html, result.html, result.stats, { ...opts1, ...opts2 });
          const updated = saveHistoryEntry(entry);
          if (updated) setHistory(updated);
        }
      } catch (err) {
        setOutputHtml(html);
        setHasCleaned(true);
        showMessage("Could not clean HTML — showing original instead.", "error");
      }
    },
    [showMessage]
  );

  // ─── Live auto-clean: runs automatically whenever input or options change ───
  useEffect(() => {
    if (!inputHtml.trim()) {
      setOutputHtml("");
      setStats({ hrefs: 0, srcs: 0, emails: 0, numbers: 0, links: 0, text: 0 });
      setHasCleaned(false);
      return;
    }
    const timer = setTimeout(() => {
      runClean(inputHtml, options1, options2, false);
    }, 150);
    return () => clearTimeout(timer);
  }, [inputHtml, options1, options2, runClean]);

  const handleClean = useCallback(() => {
    if (!inputHtml.trim()) {
      showMessage("Please paste some newsletter HTML to clean.", "error");
      return;
    }
    runClean(inputHtml, options1, options2, true);
    showMessage("HTML cleaned successfully!", "success");
  }, [inputHtml, options1, options2, runClean, showMessage]);

  const handleToggleOption1 = useCallback(
    (key) => {
      setOptions1((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const handleToggleOption2 = useCallback(
    (key) => {
      setOptions2((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const previewSrcDoc = useMemo(() => {
    const content = outputHtml || inputHtml;
    if (!content || !content.trim()) return EMPTY_PREVIEW;
    return content;
  }, [outputHtml, inputHtml]);

  const handleCopy = useCallback(async () => {
    if (!outputHtml) {
      showMessage("Nothing to copy yet. Clean some HTML first.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(outputHtml);
      showMessage("Cleaned HTML copied to clipboard!", "success");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = outputHtml;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showMessage("Cleaned HTML copied to clipboard!", "success");
      } catch {
        showMessage("Failed to copy. Please try manually.", "error");
      }
    }
  }, [outputHtml, showMessage]);

  const handleDownload = useCallback(() => {
    if (!outputHtml) {
      showMessage("Nothing to download yet. Clean some HTML first.", "error");
      return;
    }
    try {
      const blob = new Blob([outputHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cleaned-newsletter.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage("HTML file downloaded!", "success");
    } catch {
      showMessage("Failed to download file.", "error");
    }
  }, [outputHtml, showMessage]);

  const handleClear = useCallback(() => {
    setInputHtml("");
    setOutputHtml("");
    setStats({ hrefs: 0, srcs: 0, emails: 0, numbers: 0, links: 0, text: 0 });
    setHasCleaned(false);
    showMessage("Input and output cleared.", "success");
  }, [showMessage]);

  const handleLoadSample = useCallback(() => {
    setInputHtml(SAMPLE_HTML);
    showMessage("Sample newsletter loaded. Preview is live — toggle options to clean.", "success");
  }, [showMessage]);

  const handleRestoreFromHistory = useCallback(
    (entry) => {
      setInputHtml(entry.original);
      setOutputHtml(entry.cleaned);
      setStats(entry.stats);
      if (entry.options) {
        const {
          href, src, businessEmails, personalEmails, numbers,
          removeLinks, removeSrc, removeText, removeNumbers,
        } = entry.options;
        setOptions1({ href, src, businessEmails, personalEmails, numbers });
        setOptions2({ removeLinks, removeSrc, removeText, removeNumbers });
      }
      setHasCleaned(true);
      setShowHistory(false);
      showMessage("History entry restored.", "success");
    },
    [showMessage]
  );

  const handleDeleteHistory = useCallback((id) => {
    const updated = deleteHistoryEntry(id);
    if (updated) setHistory(updated);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  const allSelected1 = Object.values(options1).every(Boolean);
  const allSelected2 = Object.values(options2).every(Boolean);

  const handleToggleAll1 = useCallback(() => {
    const nextVal = !allSelected1;
    setOptions1(Object.fromEntries(Object.keys(CLEANER1_OPTIONS).map((k) => [k, nextVal])));
  }, [allSelected1]);

  const handleToggleAll2 = useCallback(() => {
    const nextVal = !allSelected2;
    setOptions2(Object.fromEntries(Object.keys(CLEANER2_OPTIONS).map((k) => [k, nextVal])));
  }, [allSelected2]);

  const activeOptionCount1 = Object.values(options1).filter(Boolean).length;
  const activeOptionCount2 = Object.values(options2).filter(Boolean).length;

  // Editing the code view updates outputHtml directly; preview stays in sync via srcDoc
  const handleCodeEdit = useCallback((e) => {
    setOutputHtml(e.target.value);
    setHasCleaned(true);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-wrap">
            <span className="logo-icon">&#9993;</span>
            <div>
              <h1>Newsletter Cleaner <span className="dev-credit">Developed by Sidhartha</span></h1>
              <p className="subtitle">Clean URLs, emails, and numbers from your newsletter HTML</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowHistory(true)}>
            View History ({history.length})
          </button>
        </div>
      </header>

      <main className="app-main">
        {message && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}

        <div className="cleaner-container">
          <div className="options-section">
            <div className="options-group">
              <div className="options-group-header">
                <span className="options-group-title">Cleaner 1 — Domain &amp; Email Stripper</span>
                <div className="options-group-right">
                  <span className="options-group-hint">{activeOptionCount1} active</span>
                  <label className="select-all-chip">
                    <input
                      type="checkbox"
                      checked={allSelected1}
                      onChange={handleToggleAll1}
                    />
                    <span>Select All</span>
                  </label>
                </div>
              </div>
              <div className="options-grid options-grid-5">
                {CLEANER1_LABELS.map((opt) => (
                  <label
                    key={opt.key}
                    data-key={opt.key}
                    className={`option-chip compact-chip ${options1[opt.key] ? "active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={options1[opt.key]}
                      onChange={() => handleToggleOption1(opt.key)}
                    />
                    <span className="option-icon compact-icon">{opt.icon}</span>
                    <span className="option-text">
                      <span className="option-label">{opt.label}</span>
                      <span className="option-desc">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="options-group">
              <div className="options-group-header">
                <span className="options-group-title">Cleaner 2 — Link &amp; Text Remover</span>
                <div className="options-group-right">
                  <span className="options-group-hint">{activeOptionCount2} active</span>
                  <label className="select-all-chip">
                    <input
                      type="checkbox"
                      checked={allSelected2}
                      onChange={handleToggleAll2}
                    />
                    <span>Select All</span>
                  </label>
                </div>
              </div>
              <div className="options-grid options-grid-4">
                {CLEANER2_LABELS.map((opt) => (
                  <label
                    key={opt.key}
                    data-key={opt.key}
                    className={`option-chip compact-chip ${options2[opt.key] ? "active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={options2[opt.key]}
                      onChange={() => handleToggleOption2(opt.key)}
                    />
                    <span className="option-icon compact-icon">{opt.icon}</span>
                    <span className="option-text">
                      <span className="option-label">{opt.label}</span>
                      <span className="option-desc">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-icon" data-stat-idx={0}>{"\u{1F517}"}</span>
              <span className="stat-value">{stats.hrefs + stats.links}</span>
              <span className="stat-label">Links</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon" data-stat-idx={1}>{"\u{1F4F7}"}</span>
              <span className="stat-value">{stats.srcs}</span>
              <span className="stat-label">Srcs</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon" data-stat-idx={2}>{"\u{1F4E7}"}</span>
              <span className="stat-value">{stats.emails}</span>
              <span className="stat-label">Emails</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon" data-stat-idx={3}>{"\u{1F522}"}</span>
              <span className="stat-value">{stats.numbers}</span>
              <span className="stat-label">Numbers</span>
            </div>
          </div>

          <div className="editor-grid">
            <div className="editor-panel">
              <div className="panel-header">
                <label htmlFor="input-html">Paste Newsletter HTML</label>
                <button className="btn btn-link" onClick={handleLoadSample}>
                  Load Sample
                </button>
              </div>
              <div className="editor-textarea-wrap">
                <textarea
                  id="input-html"
                  className="html-textarea"
                  placeholder="Paste your newsletter HTML here..."
                  value={inputHtml}
                  onChange={(e) => setInputHtml(e.target.value)}
                  spellCheck={false}
                  ref={inputSearch.attach}
                />
                {inputSearch.searchVisible && (
                  <EditorSearchBar
                    query={inputSearch.query}
                    matchCount={inputSearch.matches.length}
                    currentMatch={inputSearch.currentMatch}
                    onSearchChange={inputSearch.handleSearchChange}
                    onKeyDown={inputSearch.handleSearchKeyDown}
                    onClose={inputSearch.closeSearch}
                    onNext={inputSearch.nextMatch}
                    onPrev={inputSearch.prevMatch}
                  />
                )}
              </div>
              <div className="panel-actions">
                <button className="btn btn-primary" onClick={handleClean}>
                  Clean HTML
                </button>
                <button className="btn btn-secondary" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </div>

            <div className="editor-panel output-panel">
              <div className="panel-header">
                <label>Cleaned Output</label>
                <div className="view-toggle">
                  <button
                    className={`toggle-btn ${viewMode === "preview" ? "active" : ""}`}
                    onClick={() => setViewMode("preview")}
                  >
                    Preview
                  </button>
                  <button
                    className={`toggle-btn ${viewMode === "code" ? "active" : ""}`}
                    onClick={() => setViewMode("code")}
                  >
                    Code
                  </button>
                </div>
              </div>

              {viewMode === "preview" ? (
                <div className="preview-container">
                  <iframe
                    title="Newsletter Preview"
                    className="preview-iframe"
                    srcDoc={previewSrcDoc}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="editor-textarea-wrap">
                  <textarea
                    className="html-textarea code-output"
                    placeholder="Your cleaned HTML code will appear here..."
                    value={outputHtml || inputHtml}
                    onChange={handleCodeEdit}
                    spellCheck={false}
                    ref={codeSearch.attach}
                  />
                  {codeSearch.searchVisible && (
                    <EditorSearchBar
                      query={codeSearch.query}
                      matchCount={codeSearch.matches.length}
                      currentMatch={codeSearch.currentMatch}
                      onSearchChange={codeSearch.handleSearchChange}
                      onKeyDown={codeSearch.handleSearchKeyDown}
                      onClose={codeSearch.closeSearch}
                      onNext={codeSearch.nextMatch}
                      onPrev={codeSearch.prevMatch}
                    />
                  )}
                </div>
              )}

              <div className="panel-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleCopy}
                  disabled={!hasCleaned}
                >
                  Copy Cleaned HTML
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownload}
                  disabled={!hasCleaned}
                >
                  Download HTML
                </button>
              </div>
            </div>
          </div>

          {!hasCleaned && !inputHtml && (
            <div className="empty-state">
              <span className="empty-icon">&#9993;</span>
              <h3>Get Started</h3>
              <p>Paste your newsletter HTML on the left, or click "Load Sample" to try it out.</p>
            </div>
          )}
        </div>
      </main>

      {showHistory && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestoreFromHistory}
          onDelete={handleDeleteHistory}
          onClearAll={handleClearHistory}
        />
      )}
    </div>
  );
}

export default App;
