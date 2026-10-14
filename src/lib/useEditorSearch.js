import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Provides in-textarea Ctrl+F search with match highlighting
 * and Enter/Shift+Enter navigation. Only activates when the
 * associated textarea is focused.
 */
export function useEditorSearch() {
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [searchFocus, setSearchFocus] = useState(false);

  const textareaRef = useRef(null);
  const overlayRef = useRef(null);
  const searchInputRef = useRef(null);

  const highlightRanges = matches.map((m, i) => ({
    start: m.start,
    end: m.end,
    active: i === currentMatch,
  }));

  const computeMatches = useCallback((text, q) => {
    if (!q) return [];
    const lower = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    const result = [];
    let pos = 0;
    while (true) {
      const idx = lower.indexOf(lowerQ, pos);
      if (idx === -1) break;
      result.push({ start: idx, end: idx + q.length });
      pos = idx + q.length;
    }
    return result;
  }, []);

  const scrollToMatch = useCallback((matchIndex) => {
    const ta = textareaRef.current;
    if (!ta || matches.length === 0) return;
    const m = matches[matchIndex];
    if (!m) return;

    ta.focus();
    ta.setSelectionRange(m.start, m.end);

    const text = ta.value;
    const beforeMatch = text.substring(0, m.start);
    const linesBefore = beforeMatch.split("\n").length - 1;

    const computedStyle = window.getComputedStyle(ta);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const taHeight = ta.clientHeight;

    const targetScroll = linesBefore * lineHeight - paddingTop - taHeight / 3;
    ta.scrollTop = Math.max(0, targetScroll);
  }, [matches]);

  const openSearch = useCallback(() => {
    setSearchVisible(true);
    setSearchFocus(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setQuery("");
    setMatches([]);
    setCurrentMatch(0);
    setSearchFocus(false);
  }, []);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatch((prev) => {
      const next = (prev + 1) % matches.length;
      scrollToMatch(next);
      return next;
    });
  }, [matches, scrollToMatch]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatch((prev) => {
      const next = (prev - 1 + matches.length) % matches.length;
      scrollToMatch(next);
      return next;
    });
  }, [matches, scrollToMatch]);

  const handleSearchChange = useCallback((value) => {
    setQuery(value);
    const ta = textareaRef.current;
    if (!ta) return;
    const newMatches = computeMatches(ta.value, value);
    setMatches(newMatches);
    setCurrentMatch(0);
    if (newMatches.length > 0) {
      setTimeout(() => {
        const ta2 = textareaRef.current;
        if (ta2) {
          ta2.focus();
          ta2.setSelectionRange(newMatches[0].start, newMatches[0].end);
        }
      }, 0);
    }
  }, [computeMatches]);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      const ta = textareaRef.current;
      if (ta) ta.focus();
    }
  }, [nextMatch, prevMatch, closeSearch]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      const ta = textareaRef.current;
      if (ta && document.activeElement === ta) {
        e.preventDefault();
        e.stopPropagation();
        openSearch();
      }
    }
  }, [openSearch]);

  const attach = useCallback((node) => {
    textareaRef.current = node;
  }, []);

  useEffect(() => {
    if (searchFocus && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
      setSearchFocus(false);
    }
  }, [searchFocus]);

  useEffect(() => {
    if (searchVisible && currentMatch >= 0 && matches.length > 0) {
      scrollToMatch(currentMatch);
    }
  }, [searchVisible, currentMatch, matches, scrollToMatch]);

  return {
    attach,
    overlayRef,
    searchInputRef,
    searchVisible,
    query,
    matches,
    currentMatch,
    highlightRanges,
    handleSearchChange,
    handleSearchKeyDown,
    closeSearch,
    nextMatch,
    prevMatch,
    handleKeyDown,
  };
}
