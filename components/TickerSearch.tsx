"use client";

import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";

// useLayoutEffect can't run on the server; fall back to useEffect there so
// Next's SSR pass of this client component doesn't warn. In the browser we
// need the layout variant to position the dropdown before the first paint.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
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
    input: "",
    dropdown: "bg-white border border-[var(--site-border,#E7E8F2)] rounded-xl shadow-lg",
    item: "hover:bg-[var(--surface-muted,#F4F5FB)]",
    itemActive: "bg-[var(--surface-muted,#F4F5FB)]",
    symbol: "text-[var(--site-ink,#16193A)] font-semibold",
    meta: "text-[var(--site-ink-3,#797D99)]",
    button: "",
  },
  header: {
    input:
      "bg-transparent border-0 border-b border-white/30 rounded-none text-white placeholder-white/45 focus:border-white disabled:opacity-50 disabled:cursor-not-allowed",
    dropdown: "bg-[var(--ivory)] border border-[var(--ink)]",
    item: "hover:bg-[var(--navy-050)]",
    itemActive: "bg-[var(--navy-050)]",
    symbol: "text-[var(--ink)] font-medium font-mono",
    meta: "text-[var(--ink-3)]",
    button:
      "bg-[var(--gold)] text-[var(--ink)] hover:bg-[var(--gold-soft)] rounded-none disabled:opacity-50 disabled:cursor-not-allowed",
  },
  footer: {
    input: "",
    dropdown: "bg-white border border-[var(--site-border,#E7E8F2)] rounded-xl shadow-lg",
    item: "hover:bg-[var(--surface-muted,#F4F5FB)]",
    itemActive: "bg-[var(--surface-muted,#F4F5FB)]",
    symbol: "text-[var(--site-ink,#16193A)] font-semibold",
    meta: "text-[var(--site-ink-3,#797D99)]",
    button: "",
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
  const [portalReady, setPortalReady] = useState(false);

  const styles = variantStyles[variant];
  // header = navbar oscuro de /analyze (estilo legacy intacto); hero/footer = sitio moderno.
  const isModern = variant !== "header";

  // Defer portal rendering until after mount so we don't try to portal into
  // a DOM that doesn't exist yet during SSR. The lint rule prefers derived
  // state but the whole point is "is this paint client-side?" — only an
  // effect can answer that without hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  // Position the portaled dropdown under the input by writing styles straight
  // to the node instead of through React state — and crucially, choose the
  // anchoring scheme from the input's real scroll context so the browser keeps
  // the two glued together NATIVELY, with no per-frame JS in the scroll path.
  //
  // A `position: fixed` dropdown that we re-place on every scroll event always
  // trails the input: the compositor paints the scrolled frame before the main
  // thread runs our handler, so on a fast flick the dropdown visibly lags ~a
  // frame (hundreds of px) behind before snapping back. The fix is to stop
  // fighting the scroll:
  //   • input in normal flow (hero, footer) → anchor to the DOCUMENT with
  //     `position: absolute` at page coordinates. It then scrolls with the page
  //     on the compositor exactly like the input does — zero lag, zero JS.
  //   • input pinned by a sticky/fixed ancestor (header) → anchor to the
  //     VIEWPORT with `position: fixed`. The input never moves on screen, so
  //     the dropdown never needs to either — also zero lag.
  // We keep position/top/left/width OUT of the JSX style so React never
  // clobbers these imperative writes on re-render (it only reconciles keys it
  // owns).
  const positionDropdown = useCallback(() => {
    const input = inputRef.current;
    const dropdown = dropdownRef.current;
    if (!input || !dropdown) return;
    const rect = input.getBoundingClientRect();

    let viewportAnchored = false;
    for (let el = input.parentElement; el; el = el.parentElement) {
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") {
        viewportAnchored = true;
        break;
      }
    }

    const s = dropdown.style;
    s.width = `${Math.round(rect.width)}px`;
    if (viewportAnchored) {
      s.position = "fixed";
      s.left = `${Math.round(rect.left)}px`;
      s.top = `${Math.round(rect.bottom + 4)}px`;
    } else {
      s.position = "absolute";
      s.left = `${Math.round(rect.left + window.scrollX)}px`;
      s.top = `${Math.round(rect.bottom + window.scrollY + 4)}px`;
    }
  }, []);

  // Place the dropdown before the browser paints it — on open and whenever its
  // contents change — so it never flashes at the top-left origin.
  useIsomorphicLayoutEffect(() => {
    if (isOpen) positionDropdown();
  }, [isOpen, showRecents, noResults, results, recents, positionDropdown]);

  // Re-anchor on resize (layout moved) and cover edge cases the native anchor
  // can't — a nested scroll container, or a sticky ancestor mid-transition.
  // `capture: true` catches scrolls anywhere in the ancestor chain. In the
  // common document/viewport-anchored cases each write just re-computes the
  // same coordinates (a cheap no-op), so this never reintroduces scroll lag;
  // the rAF throttle keeps it to one pass per frame.
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        positionDropdown();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isOpen, positionDropdown]);

  // Load recents from localStorage on mount. Lazy useState init isn't safe
  // here (server has no localStorage → hydration mismatch), so a one-shot
  // mount effect is the right fit despite the lint rule.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    if (val.length < 1) {
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
          className={
            isModern
              ? `ui-input ${disabled ? "opacity-50 cursor-not-allowed" : ""}`
              : `w-full px-0 py-3 font-mono text-sm focus:outline-none uppercase tracking-[0.04em] ${styles.input}`
          }
          style={isModern ? undefined : { fontFamily: "var(--font-mono)" }}
        />

        {/* Dropdown — portaled to body so it escapes any ancestor `overflow-hidden` */}
        {portalReady && isOpen && (results.length > 0 || noResults || (showRecents && recents.length > 0)) && createPortal(
          <div
            ref={dropdownRef}
            // Position (absolute/fixed + coords + width) is written imperatively
            // by positionDropdown and kept out of this style object on purpose,
            // so re-renders can't clobber it. A layout effect sets it before the
            // first paint, so there's no flash at the static origin.
            className={`overflow-hidden z-[100] ${styles.dropdown}`}
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
                      <span className={`text-xs ${isModern ? "" : "font-mono"} ${styles.symbol}`}>
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
                  <span className={`text-xs ${isModern ? "" : "font-mono"} ${styles.symbol}`}>
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
        className={
          isModern
            ? `ui-btn shrink-0 ${variant === "hero" ? "ui-btn-on-navy" : "ui-btn-primary"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`
            : `px-5 sm:px-7 py-3 font-medium text-sm transition-colors shrink-0 uppercase tracking-[0.08em] ${styles.button}`
        }
        style={isModern ? undefined : { fontFamily: "var(--font-sans)" }}
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
