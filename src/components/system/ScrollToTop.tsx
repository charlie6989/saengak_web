
import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { titleForPath } from "../../lib/pageTitle";

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  // 換頁時先設定固定標題（layout effect 先於頁面的 effect 執行，動態頁可再覆寫）
  useLayoutEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);

  useEffect(() => {
    // 禁用瀏覽器自動還原捲動位置
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    // 只有當沒有 hash 時才回到頁頂（避免使用者刻意導向錨點）
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      // 若有內層滾動容器，可一併歸零
      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.overflowY === "auto" || cs.overflowY === "scroll") el.scrollTop = 0;
      });
    }
  }, [pathname, search, hash]);

  return null;
}
