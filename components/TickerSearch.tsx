"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  quoteType: string;
}

interface TickerSearchProps {
  onSubmit: (ticker: string) => void;
  disabled?: boolean;
  defaultValue?: string;
  variant: "hero" | "footer" | "header";
}

const RECENTS_KEY = "ticker:recent-searches";
const RECENTS_MAX = 5;

function loadRecents(): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is SearchResult =>
          r &&
          typeof r.symbol === "string" &&
          typeof r.name === "string" &&
          typeof r.exchange === "string"
      )
      .slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

function saveRecents(items: SearchResult[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — ignore
  }
}

const variantStyles = {
  hero: {
    input:
      "bg-white/10 border border-white/20 text-white placeholder-white/35 focus:ring-white/40",
    dropdown: "bg-white border border-white/20 shadow-2xl",
    item: "hover:bg-[#F0F2FF]",
    itemActive: "bg-[#F0F2FF]",
    symbol: "text-[#03065E] font-semibold",
    meta: "text-[#03065E]/60",
    button:
      "bg-white text-[#03065E] hover:bg-[#E8ECFF]",
  },
  header: {
    input:
      "bg-white/15 border border-white/25 text-white placeholder-white/40 focus:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed",
    dropdown: "bg-white border border-white/20 shadow-2xl",
    item: "hover:bg-[#F0F2FF]",
    itemActive: "bg-[#F0F2FF]",
    symbol: "text-[#03065E] font-semibold",
    meta: "text-[#03065E]/60",
    button:
      "bg-white text-[#03065E] hover:bg-[#E8ECFF] disabled:opacity-50 disabled:cursor-not-allowed",
  },
  footer: {
    input:
      "bg-white border border-[#03065E]/15 text-[#03065E] placeholder-[#03065E]/30 focus:ring-[#03065E]/20",
    dropdown: "bg-white border border-[#03065E]/15 text-[#03065E] shadow-lg",
    item: "hover:bg-[#F8F9FF]",
    itemActive: "bg-[#F8F9FF]",
    symbol: "text-[#03065E] font-semibold",
    meta: "text-[#03065E]/50",
    button:
      "bg-[#03065E] text-white hover:bg-[#03065E]/90",
  },
};

export function TickerSearch({
  onSubmit,
  disabled = false,
  defaultValue = "",
  variant,
}: TickerSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const [showRecents, setShowRecents] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const styles = variantStyles[variant];

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updateDropdownPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPos();
    const handler = () => updateDropdownPos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [isOpen, updateDropdownPos]);

  // Load recents from localStorage on mount
  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  const addRecent = useCallback((item: SearchResult) => {
    setRecents((prev) => {
      const next = [item, ...prev.filter((r) => r.symbol !== item.symbol)].slice(
        0,
        RECENTS_MAX
      );
      saveRecents(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((symbol: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r.symbol !== symbol);
      saveRecents(next);
      return next;
    });
  }, []);

  // Set default value when it changes (for URL-param initialization)
  useEffect(() => {
    if (defaultValue && inputRef.current) {
      inputRef.current.value = defaultValue;
    }
  }, [defaultValue]);

  const search = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (!controller.signal.aborted) {
        const items: SearchResult[] = data.results ?? [];
        setResults(items);
        setNoResults(items.length === 0);
        setIsOpen(true);
        setActiveIndex(-1);
      }
    } catch {
      // Aborted or network error — ignore
    }
  }, []);

  function handleInput() {
    const val = inputRef.current?.value.trim() ?? "";
    clearTimeout(debounceRef.current);
    setNoResults(false);

    if (val.length < 2) {
      setResults([]);
      // Keep recents visible if input is empty
      setShowRecents(val.length === 0 && recents.length > 0);
      setIsOpen(val.length === 0 && recents.length > 0);
      return;
    }

    setShowRecents(false);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function selectResult(item: SearchResult) {
    if (inputRef.current) inputRef.current.value = item.symbol;
    setIsOpen(false);
    setShowRecents(false);
    setResults([]);
    addRecent(item);
    onSubmit(item.symbol);
  }

  async function resolveAndSubmit(query: string) {
    abortRef.current?.abort();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const items: SearchResult[] = data.results ?? [];
      const exact = items.find(
        (r) => r.symbol.toUpperCase() === query.toUpperCase()
      );
      if (exact) {
        selectResult(exact);
      } else if (items.length > 0) {
        selectResult(items[0]);
      } else {
        // No results — show "not found" instead of submitting
        setResults([]);
        setNoResults(true);
        setIsOpen(true);
      }
    } catch {
      // Network error — ignore silently
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // If a recent is highlighted, allow submitting even with empty input
    if (isOpen && showRecents && activeIndex >= 0 && recents[activeIndex]) {
      selectResult(recents[activeIndex]);
      return;
    }

    const val = inputRef.current?.value.trim();
    if (!val) return;

    // If "no results" is showing, block submission
    if (noResults && results.length === 0) return;

    // If an item is highlighted in the dropdown, select it
    if (isOpen && activeIndex >= 0 && results[activeIndex]) {
      selectResult(results[activeIndex]);
      return;
    }

    // If dropdown has results, pick the exact symbol match or first result
    if (results.length > 0) {
      const exact = results.find(
        (r) => r.symbol.toUpperCase() === val.toUpperCase()
      );
      selectResult(exact ?? results[0]);
      return;
    }

    // No results loaded yet — resolve via search API before submitting
    // (handles fast Enter before debounce completes)
    clearTimeout(debounceRef.current);
    resolveAndSubmit(val);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const list = showRecents ? recents : results;
    if (!isOpen || list.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < list.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : list.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleBlur() {
    // Delay to allow click on dropdown items to fire first
    setTimeout(() => setIsOpen(false), 150);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full relative">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar ticker o empresa…"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            const val = inputRef.current?.value.trim() ?? "";
            if (val.length === 0 && recents.length > 0) {
              setShowRecents(true);
              setIsOpen(true);
              setActiveIndex(-1);
            } else if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          className={`w-full rounded-xl px-4 sm:px-5 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:border-transparent ${styles.input}`}
        />

        {/* Dropdown — portaled to body so it escapes any ancestor `overflow-hidden` */}
        {portalReady && isOpen && dropdownPos && (results.length > 0 || noResults || (showRecents && recents.length > 0)) && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              left: dropdownPos.left,
              top: dropdownPos.top,
              width: dropdownPos.width,
            }}
            className={`rounded-xl overflow-hidden z-[100] ${styles.dropdown}`}
          >
            {showRecents && results.length === 0 && !noResults ? (
              <>
                <div className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-widest text-[#03065E]/50">
                  Búsquedas recientes
                </div>
                {recents.map((item, i) => (
                  <div
                    key={item.symbol}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`group w-full flex items-center text-sm transition-colors ${
                      i === activeIndex ? styles.itemActive : styles.item
                    }`}
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectResult(item);
                      }}
                      className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3 cursor-pointer"
                    >
                      <span className={`font-mono text-xs ${styles.symbol}`}>
                        {item.symbol}
                      </span>
                      <span className={`truncate ${styles.meta}`}>
                        {item.name}
                      </span>
                      <span className={`ml-auto text-xs shrink-0 ${styles.meta}`}>
                        {item.exchange}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar ${item.symbol} de recientes`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeRecent(item.symbol);
                      }}
                      className="px-3 py-3 text-[#03065E]/30 hover:text-[#03065E]/70 cursor-pointer transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            ) : noResults && results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#03065E]/40 text-center">
                No se encontraron resultados
              </div>
            ) : (
              results.map((item, i) => (
                <button
                  key={item.symbol}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectResult(item);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors cursor-pointer ${
                    i === activeIndex ? styles.itemActive : styles.item
                  }`}
                >
                  <span className={`font-mono text-xs ${styles.symbol}`}>
                    {item.symbol}
                  </span>
                  <span className={`truncate ${styles.meta}`}>
                    {item.name}
                  </span>
                  <span className={`ml-auto text-xs shrink-0 ${styles.meta}`}>
                    {item.exchange}
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body
        )}
      </div>

      <button
        type="submit"
        disabled={disabled}
        aria-label="Analizar"
        className={`px-4 sm:px-6 py-3 font-semibold rounded-xl text-sm transition-colors shrink-0 ${styles.button}`}
      >
        <span className="hidden sm:inline">Analizar</span>
        <svg
          className="sm:hidden"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
