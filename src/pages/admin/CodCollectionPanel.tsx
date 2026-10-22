import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type CollectionStatus = {
  trackingNumber?: string; status?: string; invoiceNumber?: string;
  paymentStatus?: string; paymentProjection?: string; enabled?: boolean; error?: string;
  reviewRequired?: boolean; reviewReason?: string; lastError?: string;
  collectedAt?: string; lastCheckedAt?: string;
};
const statuses: Record<string,string> = { pending:'待處理', processing:'處理中', issued:'已確認開立', failed:'等待重試',
  failed_terminal:'需要處理', manual_review:'需要查核', void_review:'作廢待查核', voided:'已作廢', cancelled:'已取消',
  paid:'已付款', partially_paid:'部分付款', refunded:'已退款', synced:'已同步', retry:'等待重試' };
const reasons: Record<string,string> = {
  COD_COLLECTION_NOT_DELIVERED:'等待物流完成送達', COD_COLLECTION_MAPPING_UNVERIFIED:'物流與代收金額對應尚未驗證',
  COD_COLLECTION_WHOLE_ORDER_REQUIRED:'目前只支援單一貨件完整送達整筆訂單', COD_COLLECTION_SERVICE_MISMATCH:'物流服務或託運資料不符合已驗證設定',
  COD_COLLECTION_PREFERENCE_REQUIRED:'缺少原始發票資料，需查核', COD_COLLECTION_SOURCE_UNAVAILABLE:'暫時無法讀取最新物流資料，系統會重試',
  COD_COLLECTION_ORDER_CHANGED:'收款證據建立後，訂單內容有變更', COD_COLLECTION_EVENT_DELETED:'物流送達通知已撤回',
  COD_COLLECTION_AMOUNT_MISMATCH:'訂單金額或付款狀態需要查核', COD_COLLECTION_PAYMENT_UNCONFIRMED:'付款狀態尚未確認同步，系統會重試',
};
export function CodCollectionPanel({ order, onClose }: {
  order: { shopify_order_gid: string | null; order_number: string; total_amount: number };
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CollectionStatus | null>(null);
  async function refresh() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('請重新登入管理員帳號');
      const response = await fetch(`/api/invoice/cod-dispatch?order=${encodeURIComponent(order.shopify_order_gid ?? '')}`, {
        headers: { authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) throw new Error('暫時無法查詢進度，請稍後重試');
      const next = await response.json() as CollectionStatus | null;
      if (!next) throw new Error('查無訂單');
      setResult(next);
    } catch (error) { setResult({ error: error instanceof Error ? error.message : '查詢失敗' }); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [order.shopify_order_gid]);
  const reason = result?.reviewReason || result?.lastError;
  return <section className="border border-gray-300 p-5 space-y-3" aria-label="貨到付款與發票進度">
    <h2 className="font-semibold">貨到付款／發票進度 · {order.order_number}</h2>
    <p>整筆訂單 NT$ {order.total_amount.toLocaleString()}。系統依已驗證的黑貓送達資料確認代收款，再自動開立發票。</p>
    <p>ShipAny 匯款入帳仍須另行對帳。</p>
    {result?.error ? <p role="alert">{result.error}</p> : result && <div role="status" className="space-y-2">
      {!result.enabled && <p>自動處理尚未啟用或已暫停。</p>}
      <p>代收款：{result.collectedAt ? `已依物流送達確認（${new Date(result.collectedAt).toLocaleString('zh-TW')}）` : '等待確認'}</p>
      {result.trackingNumber && <p>託運單號：{result.trackingNumber}</p>}
      <p>發票：{statuses[result.status ?? ''] ?? '等待收款證據'} {result.invoiceNumber ?? ''}</p>
      <p>Shopify 付款：{statuses[result.paymentStatus ?? ''] ?? '待確認'}；同步：{statuses[result.paymentProjection ?? ''] ?? '尚未開始'}</p>
      {result.reviewRequired && <p role="alert">資料有變動，已停止新增付款與開票操作，請查核原訂單及發票。</p>}
      {reason && <p>{reasons[reason] ?? '資料需要查核，請聯絡管理人員'}<span className="block text-xs text-gray-500">參考代碼：{reason}</span></p>}
      {result.lastCheckedAt && <p>最後檢查：{new Date(result.lastCheckedAt).toLocaleString('zh-TW')}</p>}
    </div>}
    <div className="flex gap-3">
      <button type="button" disabled={busy} onClick={refresh}>{busy ? '查詢中…' : '重新查詢'}</button>
      <button type="button" onClick={onClose}>關閉</button>
    </div>
  </section>;
}
