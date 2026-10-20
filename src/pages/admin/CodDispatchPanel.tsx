import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type DispatchStatus = {
  confirmationId?: string; trackingNumber?: string; status?: string; invoiceNumber?: string;
  paymentStatus?: string; enabled?: boolean; error?: string; operation?: string;
  reviewRequired?: boolean; approvalExpiresAt?: string; approvalExpired?: boolean; fulfillmentBlocked?: boolean;
};

export function CodDispatchPanel({ order, onClose }: {
  order: { shopify_order_gid: string | null; order_number: string; total_amount: number; shopify_updated_at: string };
  onClose: () => void;
}) {
  const [confirmationId, setConfirmationId] = useState<string>(() => crypto.randomUUID());
  const [tracking, setTracking] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<DispatchStatus | null>(null);
  async function run(confirm: boolean) {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('請重新登入管理員帳號');
      const response = await fetch(confirm ? '/api/invoice/cod-dispatch'
        : `/api/invoice/cod-dispatch?order=${encodeURIComponent(order.shopify_order_gid ?? '')}`, {
        method: confirm ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' },
        ...(confirm ? { body: JSON.stringify({ orderGid: order.shopify_order_gid, confirmationId,
          expectedUpdatedAt: order.shopify_updated_at, expectedTotal: Number(order.total_amount),
          trackingNumber: tracking, carrier: 'black_cat_ambient', wholeOrder: checked }) } : {}),
      });
      const next = await response.json() as DispatchStatus | null;
      if (!next) throw new Error('查無訂單，請重新載入');
      setResult(next);
      if (response.ok) setLoaded(true);
      if (next.confirmationId) setConfirmationId(next.confirmationId);
      if (next.trackingNumber) setTracking(next.trackingNumber);
    } catch (error) { setResult({ error: error instanceof Error ? error.message : '操作失敗，請重新查詢' }); }
    finally { setBusy(false); }
  }
  const approved = Boolean(result?.confirmationId);
  return <section className="border border-gray-300 p-5 space-y-3" aria-label="黑貓 COD 整單出貨">
    <h2 className="font-semibold">黑貓 COD 整單出貨 · {order.order_number}</h2>
    <p>請先查詢現況，核對 Shopify 最新品項及整單金額 NT$ {order.total_amount}。完成開票確認後再交運。</p>
    <p>若 ShipAny／waaship 已建立 Shopify 履約，請停止操作並查核流程順序；不要刪除履約或偽改狀態來通過檢查。</p>
    <p>已開票不代表顧客已付款；ShipAny 匯款另行對帳。分批出貨、部分預收及例外請交人工處理。</p>
    <label className="block">黑貓常溫託運單號
      <input className="border p-2 ml-2" value={tracking} disabled={busy || approved}
        onChange={(e) => setTracking(e.target.value.trim())} inputMode="numeric" />
    </label>
    <label className="block"><input type="checkbox" checked={checked} disabled={busy}
      onChange={(e) => setChecked(e.target.checked)} /> 我已核對全量品項、金額及黑貓常溫包裹，本次整單交運，沒有部分付款或分批出貨。</label>
    {result?.reviewRequired && <p role="alert">核准後訂單內容已變更。即使已有發票號碼，也請勿直接交運；須人工核對原發票、訂單及實際出貨內容，依會計規則處理。</p>}
    {result?.approvalExpiresAt && <p>核准期限：{new Date(result.approvalExpiresAt).toLocaleString('zh-TW')}。期限後只可查回既有結果，不能重新開立；以伺服器時間判定。</p>}
    {result?.fulfillmentBlocked && <p>已存在履約狀態：首次核准已阻擋；已有核准僅能依原工作查回，不表示允許新的開票。</p>}
    {result && <div role="status">
      {result.error ? `需處理：${result.error}。請勿直接交運；查清狀態後再操作。`
        : <>發票：{result.status ?? '尚未核准'} {result.invoiceNumber ?? ''}；付款：{result.paymentStatus ?? '待確認'}；入帳：另表對帳。
          {result.status !== 'issued' && <p>尚未確認開票成功，請勿將排入工作視為已開立。超過核准有效時間或狀態異常須人工處理。</p>}</>}
    </div>}
    <div className="flex gap-3">
      <button type="button" disabled={busy} onClick={() => run(false)}>查詢／重新查詢</button>
      <button type="button" disabled={busy || !loaded || !result?.enabled || !checked
        || !/^[0-9]{10,20}$/.test(tracking) || (!approved && result?.fulfillmentBlocked)
        || result?.operation === 'void' || ['issued','void_review','voided','cancelled','failed_terminal','manual_review'].includes(result?.status ?? '')} onClick={() => run(true)}>
        {approved ? (result?.approvalExpired ? '查回同一筆結果（不重新開立）' : '重試同一筆開票工作') : '確認整單出貨並開票'}
      </button>
      <button type="button" disabled={busy} onClick={onClose}>關閉</button>
    </div>
  </section>;
}
