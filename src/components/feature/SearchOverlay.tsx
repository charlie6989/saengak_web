import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const RECENT_SEARCHES_KEY = "lucissi:recent-searches";
const MAX_RECENT_SEARCHES = 5;

function readRecentSearches(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string): string[] {
  const next = [term, ...readRecentSearches().filter((item) => item !== term)].slice(0, MAX_RECENT_SEARCHES);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // 無痕模式或停用儲存時，最近搜尋只是不保留，不影響搜尋本身
  }
  return next;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function SearchOverlay({ isOpen, onClose, initialQuery = "" }: SearchOverlayProps) {
  const [query, setQuery] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // 鎖捲動 + 聚焦輸入
  useEffect(() => {
    document.body.classList.toggle("no-scroll", isOpen);
    if (isOpen) {
      setRecent(readRecentSearches());
      const id = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(id);
    }
    return () => {};
  }, [isOpen]);

  // ESC 關閉
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // 關閉處理
  const handleClose = () => {
    setQuery(''); // 清空搜索内容
    onClose();
  };

  // 送出搜尋：直接接收要搜尋的字，避免點選標籤時讀到尚未更新的 query state
  const submitSearch = (term: string) => {
    const q = term.trim();
    if (q) setRecent(saveRecentSearch(q));
    onClose();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : `/search`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch(query);
  };

  const popular = ["私密清潔", "益生菌", "無痕內褲", "生理褲", "敏感肌"];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          {/* Panel */}
          <motion.div
            className="fixed inset-0 z-[101] flex items-start md:items-center justify-center p-4 md:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              // 點擊外層也關閉
              if (e.target === e.currentTarget) {
                handleClose();
              }
            }}
          >
            <motion.div
              className="w-full max-w-2xl bg-white overflow-hidden"
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 24, scale: 0.98 }}
              transition={{ type: "tween", duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              style={{ borderRadius: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header / Input */}
              <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 md:px-5 py-3 border-b">
                <i className="ri-search-line text-gray-500 text-lg" aria-hidden />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋商品、文章、關鍵字…"
                  aria-label="搜尋商品、文章、關鍵字"
                  className="flex-1 outline-none text-base md:text-lg placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-9 h-9 grid place-items-center hover:bg-gray-200 transition-colors cursor-pointer active:bg-gray-300 rounded-md"
                  aria-label="關閉搜尋"
                >
                  <i className="ri-close-line text-xl text-gray-700" />
                </button>
              </form>

              {/* Suggestions */}
              <div className="px-4 md:px-5 py-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">熱門搜尋</div>
                  <div className="flex flex-wrap gap-2">
                    {popular.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => submitSearch(p)}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                        style={{ borderRadius: 0 }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {recent.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">最近搜尋</div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => submitSearch(r)}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                        style={{ borderRadius: 0 }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 md:px-5 py-3 border-t text-xs text-gray-500 flex items-center justify-between">
                <span>按 Enter 搜尋，或按 Esc 關閉</span>
                <span className="hidden md:block">全站搜尋（商品 / 文章）</span>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
