import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

export function EditorSearchBar({
  query,
  matchCount,
  currentMatch,
  onSearchChange,
  onKeyDown,
  onClose,
  onNext,
  onPrev,
}) {
  const matchText = matchCount > 0
    ? `${currentMatch + 1} of ${matchCount}`
    : query
      ? "No matches"
      : "";

  return (
    <div className="editor-search-bar" onClick={(e) => e.stopPropagation()}>
      <Search size={14} className="editor-search-icon" />
      <input
        type="text"
        className="editor-search-input"
        placeholder="Find in editor..."
        value={query}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
      <span className="editor-search-count">{matchText}</span>
      <button className="editor-search-btn" onClick={onPrev} disabled={matchCount === 0} title="Previous (Shift+Enter)">
        <ChevronUp size={15} />
      </button>
      <button className="editor-search-btn" onClick={onNext} disabled={matchCount === 0} title="Next (Enter)">
        <ChevronDown size={15} />
      </button>
      <button className="editor-search-btn editor-search-close" onClick={onClose} title="Close (Esc)">
        <X size={15} />
      </button>
    </div>
  );
}
