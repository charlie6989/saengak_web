import { useEffect, useRef, useState } from 'react';
import {
  PICKUP_CARRIERS,
  PICKUP_CARRIER_LABELS,
  describePickupPoint,
  type DeliveryMethod,
  type PickupCarrier,
  type PickupPoint,
} from '../../domain/pickupPoints';
import { PickupSearchError, searchPickupPoints } from '../../lib/pickupPoints';

const fontStyle = { fontFamily: 'Noto Sans TC, sans-serif' };
const formatTwd = (value: number) => `NT$${value.toLocaleString('zh-TW')}`;

interface PickupPointSelectorProps {
  method: DeliveryMethod;
  pickupPoint: PickupPoint | null;
  homeShippingFee: number;
  pickupShippingFee: number;
  onMethodChange: (method: DeliveryMethod) => void;
  onPickupPointChange: (point: PickupPoint | null) => void;
  /** 測試用：注入搜尋函式 */
  search?: typeof searchPickupPoints;
}

/**
 * 購物車的配送方式選擇：宅配到府，或到全家、7-11、萊爾富門市取件。
 * 只有 site_settings.store_pickup_enabled 為 true 時才會顯示；門市由 ShipAny 門市清單搜尋。
 */
export default function PickupPointSelector({
  method,
  pickupPoint,
  homeShippingFee,
  pickupShippingFee,
  onMethodChange,
  onPickupPointChange,
  search = searchPickupPoints,
}: PickupPointSelectorProps) {
  const [carrier, setCarrier] = useState<PickupCarrier>(pickupPoint?.carrier ?? 'familymart');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickupPoint[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isChanging, setIsChanging] = useState(!pickupPoint);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runSearch = async () => {
    const keyword = query.trim();
    if (!keyword) {
      setSearchError('請輸入門市名稱、路名或區域。');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setSearchError('');
    try {
      const points = await search(carrier, keyword, controller.signal);
      setResults(points);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      setResults(null);
      setSearchError(error instanceof PickupSearchError ? error.message : '門市清單暫時無法讀取，請稍後再試。');
    } finally {
      if (abortRef.current === controller) setIsSearching(false);
    }
  };

  const choosePoint = (point: PickupPoint) => {
    onPickupPointChange(point);
    setIsChanging(false);
    setResults(null);
  };

  const methodButton = (value: DeliveryMethod, label: string, fee: number) => (
    <button
      type="button"
      role="radio"
      aria-checked={method === value}
      onClick={() => onMethodChange(value)}
      className={`flex-1 min-h-[44px] rounded-md border px-3 py-2 text-left text-sm transition-colors ${
        method === value ? 'border-brand bg-blush text-brand font-semibold' : 'border-gray-300 text-gray-700 hover:border-brand'
      }`}
      data-testid={`delivery-method-${value}`}
    >
      <span className="block">{label}</span>
      <span className="block text-[11px] font-normal text-gray-500">運費 {formatTwd(fee)}，達免運門檻免運</span>
    </button>
  );

  return (
    <div className="space-y-3 pt-4 pb-2 border-t border-gray-100" data-testid="delivery-method-section">
      <h3 className="text-sm font-bold text-gray-900" style={fontStyle}>配送方式</h3>
      <div className="flex gap-2" role="radiogroup" aria-label="配送方式">
        {methodButton('home', '宅配到府', homeShippingFee)}
        {methodButton('pickup', '超商取貨', pickupShippingFee)}
      </div>

      {method === 'pickup' && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3" data-testid="pickup-point-panel">
          {pickupPoint && !isChanging ? (
            <div className="flex items-start justify-between gap-3" data-testid="pickup-point-selected">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{describePickupPoint(pickupPoint)}</p>
                <p className="text-xs text-gray-500">{pickupPoint.address}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCarrier(pickupPoint.carrier);
                  setIsChanging(true);
                }}
                className="shrink-0 min-h-[44px] px-2 text-sm font-semibold text-brand hover:underline"
              >
                更換
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2" role="radiogroup" aria-label="超商">
                {PICKUP_CARRIERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={carrier === value}
                    onClick={() => {
                      setCarrier(value);
                      setResults(null);
                      setSearchError('');
                    }}
                    className={`flex-1 min-h-[44px] rounded-md border px-2 text-sm ${
                      carrier === value ? 'border-brand bg-blush text-brand font-semibold' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    {PICKUP_CARRIER_LABELS[value]}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSearch();
                }}
              >
                <label htmlFor="pickup-point-query" className="sr-only">搜尋門市</label>
                <input
                  id="pickup-point-query"
                  type="search"
                  value={query}
                  maxLength={40}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="門市名稱、路名或區域，例如：民生東路"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="shrink-0 min-h-[44px] rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSearching ? '搜尋中' : '搜尋'}
                </button>
              </form>
              {searchError && (
                <p className="text-xs text-amber-700" role="alert" data-testid="pickup-point-error">{searchError}</p>
              )}
              {results && results.length === 0 && (
                <p className="text-xs text-gray-500" data-testid="pickup-point-empty">找不到符合的門市，請換個關鍵字，例如路名或行政區。</p>
              )}
              {results && results.length > 0 && (
                <ul className="max-h-60 space-y-1 overflow-y-auto" data-testid="pickup-point-results">
                  {results.map((point) => (
                    <li key={`${point.carrier}-${point.code}`}>
                      <button
                        type="button"
                        onClick={() => choosePoint(point)}
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-left hover:border-brand"
                      >
                        <span className="block text-sm font-semibold text-gray-900">{point.name}</span>
                        <span className="block text-xs text-gray-500">{point.address}（{point.code}）</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pickupPoint && (
                <button
                  type="button"
                  onClick={() => setIsChanging(false)}
                  className="min-h-[44px] text-sm text-gray-600 hover:underline"
                >
                  取消，保留 {describePickupPoint(pickupPoint)}
                </button>
              )}
            </>
          )}
          <p className="text-[11px] leading-5 text-gray-500">
            結帳頁的收件地址會自動帶入門市，請勿修改，以免無法配送。可在結帳頁選擇線上付款或取貨付款；收件人姓名須與取件時出示的證件相同。
          </p>
        </div>
      )}
    </div>
  );
}
