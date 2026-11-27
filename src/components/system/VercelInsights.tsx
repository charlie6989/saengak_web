import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useLocation } from 'react-router-dom';
import { beforeSendInsights, insightsEnabled, insightsPath, insightsRoute } from '../../lib/vercelInsights';

/** Vercel Web Analytics 與 Speed Insights；規則見 src/lib/vercelInsights.ts。 */
export default function VercelInsights() {
  // 傳入 route 時 Analytics 改由這裡在換頁時送 pageview；網址在 beforeSend 去掉查詢字串
  const { pathname, search } = useLocation();
  const route = insightsRoute(pathname);
  // 切換商品分類（?category=）也要送 pageview；只帶分類參數，其他查詢字串不進路徑
  const path = insightsPath(pathname, search);
  if (typeof window === 'undefined' || !insightsEnabled(window.location.hostname)) return null;
  return (
    <>
      <Analytics mode="production" route={route} path={path} beforeSend={beforeSendInsights} />
      <SpeedInsights route={route} beforeSend={beforeSendInsights} />
    </>
  );
}
