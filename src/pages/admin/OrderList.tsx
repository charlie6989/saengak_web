import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { captureExceptionSafe } from '../../lib/sentry';

export interface OrderRecord {
  id: string;
  order_number: string;
  shopify_order_gid: string | null;
  total_amount: number;
  currency_code: string;
  status: 'processing' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded' | 'payment_failed';
  payment_status: 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'voided';
  created_at: string;
  updated_at: string;
}

export interface TransactionLogItem {
  idempotency_key: string;
  payload_hash: string;
  status: 'INITIATED' | 'PAYMENT_CAPTURED' | 'ORDER_CREATED' | 'INVOICE_ISSUED' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  tappay_rec_trade_id: string | null;
  shopify_order_id: string | null;
  invoice_id: string | null;
  amount: number;
  customer_email_masked: string;
  created_at: string;
  updated_at: string;
  has_anomaly: boolean;
  anomaly_reason?: string;
}

// 預設示範交易狀態機日誌（用於 Phase 1 查驗狀態機對帳與異常排查展示）
const DEMO_TRANSACTION_LOGS: TransactionLogItem[] = [
  {
    idempotency_key: 'idem_sgk_20260820_001',
    payload_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'COMPLETED',
    tappay_rec_trade_id: 'rec_trade_tp_889911',
    shopify_order_id: 'gid://shopify/Order/552190881',
    invoice_id: 'GW-202608-00918',
    amount: 1360,
    customer_email_masked: 'm***@saengak.com.tw',
    created_at: '2026-08-20T09:15:00Z',
    updated_at: '2026-08-20T09:15:32Z',
    has_anomaly: false,
  },
  {
    idempotency_key: 'idem_sgk_20260820_002',
    payload_hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    status: 'ORDER_CREATED',
    tappay_rec_trade_id: 'rec_trade_tp_889922',
    shopify_order_id: 'gid://shopify/Order/552190882',
    invoice_id: null,
    amount: 680,
    customer_email_masked: 'u***@example.com',
    created_at: '2026-08-20T11:30:00Z',
    updated_at: '2026-08-20T11:30:45Z',
    has_anomaly: false,
  },
  {
    idempotency_key: 'idem_sgk_20260820_003',
    payload_hash: 'c8f7d98342817290d8a87b1c3127819280918230918209381029381029381029',
    status: 'PAYMENT_CAPTURED',
    tappay_rec_trade_id: 'rec_trade_tp_889933',
    shopify_order_id: null,
    invoice_id: null,
    amount: 2040,
    customer_email_masked: 't***@saengak.tw',
    created_at: '2026-08-20T14:10:00Z',
    updated_at: '2026-08-20T14:26:00Z',
    has_anomaly: true,
    anomaly_reason: '扣款已成功但 Shopify 建單逾時（停留逾 15 分鐘，需自動觸發補償重試）',
  },
];

export const OrderList: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'orders'>('transactions');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [transactionLogs] = useState<TransactionLogItem[]>(DEMO_TRANSACTION_LOGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTx, setSelectedTx] = useState<TransactionLogItem | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        captureExceptionSafe(error, { source: 'AdminOrderList.fetchOrders' });
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminOrderList.fetchOrders.catch' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredTransactions = useMemo(() => {
    return transactionLogs.filter((tx) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ANOMALY') return tx.has_anomaly;
      return tx.status === statusFilter;
    });
  }, [transactionLogs, statusFilter]);

  const statusBadge = (status: TransactionLogItem['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">● 交易完成</span>;
      case 'ORDER_CREATED':
        return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">● 訂單已建</span>;
      case 'PAYMENT_CAPTURED':
        return <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">● 已授權扣款</span>;
      case 'INITIATED':
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 border border-gray-200">● 處理中</span>;
      case 'FAILED':
      case 'EXPIRED':
        return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">● 失敗／過期</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">訂單與交易狀態機對帳管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            整合 Supabase `orders` 投影表與 Phase 2 交易狀態機 (`transaction_logs`) 異常排查。
          </p>
        </div>

        {/* 分頁切換 */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-[#225B4F] text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            交易狀態機日誌 (Transaction Logs)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#225B4F] text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Supabase 訂單投影 ({orders.length})
          </button>
        </div>
      </div>

      {/* 對帳原則提示 */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 leading-5">
        <div className="flex items-start space-x-3">
          <span className="text-lg">⚖️</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-purple-950">分散式交易狀態機與對帳權威 (CHECKOUT_PAYMENT_SPEC §5.1)：</p>
            <p>
              • <strong>狀態機流向</strong>：<code>INITIATED</code> → <code>PAYMENT_CAPTURED</code> → <code>ORDER_CREATED</code> → <code>INVOICE_ISSUED</code> → <code>COMPLETED</code>。<br />
              • <strong>自動補償機制</strong>：若停留於 <code>PAYMENT_CAPTURED</code> 超過 15 分鐘未完成建單，對帳排程將自動排查並發動補償作業。<br />
              • <strong>個資脫敏 (PII Masking)</strong>：管理者介面嚴格遮蔽真實個資與卡號，符合 PCI-DSS SAQ A-EP 與資安防護規範。
            </p>
          </div>
        </div>
      </div>

      {/* 交易狀態機 Tab 內容 */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* 過濾工具列 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-500">狀態篩選：</span>
              {['ALL', 'COMPLETED', 'ORDER_CREATED', 'PAYMENT_CAPTURED', 'ANOMALY'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === filter
                      ? 'bg-[#225B4F] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter === 'ALL'
                    ? '全部'
                    : filter === 'ANOMALY'
                    ? '⚠️ 需排查異常'
                    : filter}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500">
              顯示 <strong>{filteredTransactions.length}</strong> 筆交易日誌
            </div>
          </div>

          {/* 表格清單 */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Idempotency Key / 時間</th>
                    <th className="px-4 py-3">狀態</th>
                    <th className="px-4 py-3">金額 (TWD)</th>
                    <th className="px-4 py-3">TapPay 授權碼</th>
                    <th className="px-4 py-3">Shopify 訂單 GID</th>
                    <th className="px-4 py-3">發票號碼</th>
                    <th className="px-4 py-3">訂購人</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.idempotency_key}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        tx.has_anomaly ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs font-semibold text-gray-900">
                          {tx.idempotency_key}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {new Date(tx.created_at).toLocaleString('zh-TW')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {statusBadge(tx.status)}
                        {tx.has_anomaly && (
                          <div className="mt-1 text-[10px] font-bold text-amber-600">
                            ⚠️ 停留中間態超時
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-900">
                        NT$ {tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
                        {tx.tappay_rec_trade_id || <span className="text-gray-300">尚未授權</span>}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
                        {tx.shopify_order_id ? (
                          <span className="text-blue-600">{tx.shopify_order_id.split('/').pop()}</span>
                        ) : (
                          <span className="text-gray-300">未建單</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
                        {tx.invoice_id || <span className="text-gray-300">未開立</span>}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {tx.customer_email_masked}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTx(tx)}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#225B4F] cursor-pointer"
                        >
                          對帳詳情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supabase 訂單投影 Tab 內容 */}
      {activeTab === 'orders' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-gray-500">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#225B4F] border-t-transparent"></div>
              <p className="mt-2">正在載入 Supabase 訂單資料庫...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              目前無 Supabase 訂單記錄（Phase 1 階段尚未啟用公開自建結帳交易）。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">訂單編號</th>
                    <th className="px-4 py-3">Shopify GID</th>
                    <th className="px-4 py-3">金額</th>
                    <th className="px-4 py-3">訂單狀態</th>
                    <th className="px-4 py-3">付款狀態</th>
                    <th className="px-4 py-3">建立時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{o.order_number}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{o.shopify_order_gid || '-'}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">NT$ {o.total_amount}</td>
                      <td className="px-4 py-3">{o.status}</td>
                      <td className="px-4 py-3">{o.payment_status}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(o.created_at).toLocaleString('zh-TW')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 交易日誌詳情彈窗 */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">交易日誌對帳審查 (Transaction Record)</h2>
                <p className="text-xs text-gray-500 font-mono">{selectedTx.idempotency_key}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">狀態機目前節點</span>
                <div>{statusBadge(selectedTx.status)}</div>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">交易金額</span>
                <span className="font-bold text-gray-900">NT$ {selectedTx.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Payload SHA-256 Hash</span>
                <span className="font-mono text-[11px] text-gray-600 truncate max-w-[280px]" title={selectedTx.payload_hash}>
                  {selectedTx.payload_hash}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">TapPay RecTradeId</span>
                <span className="font-mono text-gray-800">{selectedTx.tappay_rec_trade_id || '無'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Shopify 訂單 GID</span>
                <span className="font-mono text-gray-800">{selectedTx.shopify_order_id || '無'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">光貿發票號碼</span>
                <span className="font-mono text-gray-800">{selectedTx.invoice_id || '尚未開立'}</span>
              </div>

              {selectedTx.has_anomaly && (
                <div className="rounded-lg bg-amber-50 p-3 text-amber-900 border border-amber-200">
                  <div className="font-bold">⚠️ 異常診斷：</div>
                  <div className="mt-1 text-xs leading-5">{selectedTx.anomaly_reason}</div>
                  <div className="mt-2 text-[11px] text-amber-700">
                    建議動作：觸發背景對帳補償 API (Retry Dispatcher) 重新調用 Shopify Create Order。
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
