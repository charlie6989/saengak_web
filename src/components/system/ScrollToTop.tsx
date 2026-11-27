
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { applyRouteSeo } from "../../lib/documentMeta";
import { PAGE_VIEW_DELAY_MS, initAnalytics, trackPageView } from "../../lib/analytics";
import { syncPosthog } from "../../lib/posthog";

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  const initialRender = useRef(true);

  // 換頁時依路由表（src/lib/seo.ts，與伺服器共用）設定標題、說明、robots 與 canonical。
  // layout effect 先於頁面的 effect 執行，商品、文章與搜尋頁載入資料後可再覆寫。
  useLayoutEffect(() => {
    applyRouteSeo(pathname, search, { initial: initialRender.current });
    initialRender.current = false;
  }, [pathname, search]);

  // PostHog：第一次在允許的瀏覽器載入（自己記錄換頁），之後依頁面開關畫面錄影
  useEffect(() => {
    syncPosthog(pathname, search);
  }, [pathname, search]);

  // GA4：只在正式網域載入；換頁後稍等再送 page_view，讓頁面載入資料後的標題被記到
  useEffect(() => {
    if (!initAnalytics()) return undefined;
    const timer = setTimeout(() => trackPageView(pathname, search), PAGE_VIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, search]);

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
