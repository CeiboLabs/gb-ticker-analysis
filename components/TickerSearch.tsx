"use client";

import { useRef, useState, useEffect, useCallback } from "react";

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

  const styles = variantStyles[variant];

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
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function selectResult(symbol: string) {
    if (inputRef.current) inputRef.current.value = symbol;
    setIsOpen(false);
    setResults([]);
    onSubmit(symbol);
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
        selectResult(exact.symbol);
      } else if (items.length > 0) {
        selectResult(items[0].symbol);
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
    const val = inputRef.current?.value.trim();
    if (!val) return;

    // If "no results" is showing, block submission
    if (noResults && results.length === 0) return;

    // If an item is highlighted in the dropdown, select it
    if (isOpen && activeIndex >= 0 && results[activeIndex]) {
      selectResult(results[activeIndex].symbol);
      return;
    }

    // If dropdown has results, pick the exact symbol match or first result
    if (results.length > 0) {
      const exact = results.find(
        (r) => r.symbol.toUpperCase() === val.toUpperCase()
      );
      selectResult(exact ? exact.symbol : results[0].symbol);
      return;
    }

    // No results loaded yet — resolve via search API before submitting
    // (handles fast Enter before debounce completes)
    clearTimeout(debounceRef.current);
    resolveAndSubmit(val);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
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
          placeholder="Buscar empresa o ticker…"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className={`w-full rounded-xl px-5 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:border-transparent ${styles.input}`}
        />

        {/* Dropdown */}
        {isOpen && (results.length > 0 || noResults) && (
          <div
            ref={dropdownRef}
            className={`absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 ${styles.dropdown}`}
          >
            {noResults && results.length === 0 ? (
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
                    selectResult(item.symbol);
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
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className={`px-6 py-3 font-semibold rounded-xl text-sm transition-colors ${styles.button}`}
      >
        Analizar
      </button>
    </form>
  );
}
