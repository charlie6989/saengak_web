import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { captureExceptionSafe } from '../../lib/sentry';

export type OrderInvoiceStatus = 'awaiting-provider' | 'issued' | 'voided' | 'allowance-issued' | 'failed';

export interface OrderInvoiceProjection {
  status: OrderInvoiceStatus;
  invoice_number: string | null;
  issued_at: string | null;
}

export type OrderStatus =
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'payment_failed';

export interface OrderRecord {
  id: string;
  order_number: string;
  shopify_order_gid: string | null;
  total_amount: number;
  currency_code: string;
  status: OrderStatus;
  payment_status: 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'voided';
  created_at: string;
  updated_at: string;
  order_invoices: OrderInvoiceProjection[] | null;
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  processing: '處理中',
  paid: '已付款',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
  payment_failed: '付款失敗',
};

const INVOICE_STATUS_LABEL: Record<OrderInvoiceStatus, string> = {
  'awaiting-provider': '等待光貿回讀',
  issued: '已開立',
  voided: '已作廢',
  'allowance-issued': '已折讓',
  failed: '開立失敗',
};

export const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

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
        .select('*, order_invoices(status, invoice_number, issued_at)')
        .order('created_at', { ascending: false });

      if (error) {
        captureExceptionSafe(error, { source: 'AdminOrderList.fetchOrders' });
        setOrders([]);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      captureExceptionSafe(err, { source: 'AdminOrderList.fetchOrders.catch' });
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const invoiceMetrics = useMemo(() => {
    let issued = 0;
    let awaiting = 0;
    let failed = 0;
    for (const order of orders) {
      const invStatus = order.order_invoices?.[0]?.status;
      if (invStatus === 'issued') issued++;
      else if (invStatus === 'awaiting-provider') awaiting++;
      else if (invStatus === 'failed') failed++;
    }
    return { issued, awaiting, failed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      const matchesSearch =
        searchTerm === '' ||
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.shopify_order_gid && order.shopify_order_gid.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchTerm]);

  const orderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">● {ORDER_STATUS_LABEL[status]}</span>;
      case 'paid':
      case 'shipped':
        return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">● {ORDER_STATUS_LABEL[status]}</span>;
      case 'processing':
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 border border-gray-200">● {ORDER_STATUS_LABEL[status]}</span>;
      case 'cancelled':
      case 'refunded':
      case 'payment_failed':
        return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">● {ORDER_STATUS_LABEL[status]}</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{status}</span>;
    }
  };

  const invoiceStatusBadge = (invoice?: OrderInvoiceProjection) => {
    if (!invoice) {
      return <span className="text-[11px] text-gray-300">尚無發票紀錄</span>;
    }
    switch (invoice.status) {
      case 'issued':
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">● {INVOICE_STATUS_LABEL[invoice.status]}</span>;
      case 'allowance-issued':
        return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">● {INVOICE_STATUS_LABEL[invoice.status]}</span>;
      case 'awaiting-provider':
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 border border-gray-200">● {INVOICE_STATUS_LABEL[invoice.status]}</span>;
      case 'voided':
      case 'failed':
        return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">● {INVOICE_STATUS_LABEL[invoice.status]}</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{invoice.status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">訂單與發票狀態管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            Shopify 訂單透過簽章 Webhook 投影至 Supabase <code>orders</code>；發票狀態依光貿 (Amego) 回讀之 <code>order_invoices</code> 呈現。
          </p>
        </div>
        <div className="text-xs text-gray-500">
          顯示 <strong>{filteredOrders.length}</strong> / {orders.length} 筆訂單
        </div>
      </div>

      {/* 發票與訂單狀態總覽指標 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-medium text-gray-500">總訂單數</div>
          <div className="mt-1 text-xl font-bold text-gray-900">{orders.length} 筆</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-medium text-gray-500">發票已開立</div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{invoiceMetrics.issued} 筆</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-medium text-gray-500">發票等待回讀 (Outbox)</div>
          <div className="mt-1 text-xl font-bold text-amber-600">{invoiceMetrics.awaiting} 筆</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-medium text-gray-500">發票開立失敗 / 需人工檢核</div>
          <div className="mt-1 text-xl font-bold text-red-600">{invoiceMetrics.failed} 筆</div>
        </div>
      </div>

      {/* 資料權威提示 */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 leading-5">
        <div className="flex items-start space-x-3">
          <span className="text-lg">⚖️</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-purple-950">訂單與發票資料權威 (00_DECISION_LOG.md §2)：</p>
            <p>
              • <strong>訂單主檔</strong>：結帳於 Shopify Checkout 完成後，由簽章 Webhook 投影至本表，Shopify Admin 為唯一權威來源。<br />
              • <strong>發票狀態</strong>：光貿電子發票採 Outbox 模式派送，「已付款」不代表「已開立」——狀態須以 <code>invoice_status=99</code> 之回讀事件為準，未回讀前維持「等待光貿回讀」。<br />
              • <strong>個資脫敏</strong>：本頁僅顯示訂單彙總與狀態，不呈現完整收件地址或卡號等敏感欄位。
            </p>
          </div>
        </div>
      </div>

      {/* 過濾與搜尋工具列 */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">狀態篩選：</span>
            {(['ALL', ...Object.keys(ORDER_STATUS_LABEL)] as Array<'ALL' | OrderStatus>).map((filter) => (
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
                {filter === 'ALL' ? '全部' : ORDER_STATUS_LABEL[filter]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '同步中...' : '🔄 重新載入'}
          </button>
        </div>

        <div>
          <input
            type="text"
            placeholder="搜尋訂單編號或 Shopify GID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs focus:border-[#225B4F] focus:outline-none"
          />
        </div>
      </div>

      {/* 訂單表格 */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#225B4F] border-t-transparent"></div>
            <p className="mt-2">正在載入 Supabase 訂單資料庫...</p>
          </div>
        ) : !isSupabaseConfigured ? (
          <div className="p-12 text-center text-sm text-gray-500">
            本機開發環境尚未設定 Supabase 金鑰，無法讀取訂單資料。
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            目前查無符合篩選條件之訂單紀錄。
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
                  <th className="px-4 py-3">發票狀態</th>
                  <th className="px-4 py-3">建立時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{order.order_number}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {order.shopify_order_gid ? order.shopify_order_gid.split('/').pop() : '-'}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      NT$ {order.total_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{orderStatusBadge(order.status)}</td>
                    <td className="px-4 py-3">{order.payment_status}</td>
                    <td className="px-4 py-3">{invoiceStatusBadge(order.order_invoices?.[0])}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(order.created_at).toLocaleString('zh-TW')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderList;
