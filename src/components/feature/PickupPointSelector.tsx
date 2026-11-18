import { useEffect, useRef, useState } from 'react';
import {
  PICKUP_CARRIER_LABELS,
  describePickupPoint,
  type DeliveryMethod,
  type PickupCarrier,
  type PickupPoint,
} from '../../domain/pickupPoints';
import { PickupSearchError, searchPickupPoints } from '../../lib/pickupPoints';
import {
  formatTwd,
  sortedHomeMethods,
  type HomeMethodId,
  type ShippingMethods,
} from '../../domain/shippingMethods';

const fontStyle = { fontFamily: 'Noto Sans TC, sans-serif' };

interface PickupPointSelectorProps {
  method: DeliveryMethod;
  pickupPoint: PickupPoint | null;
  /** 目前可用的配送方式與運費（resolveShippingMethods）；pickupMethods 為空代表超商取貨未開放 */
  shippingMethods: ShippingMethods;
  homeMethod: HomeMethodId;
  /** 已達免運：運費顯示刪除線與 NT$0 */
  isFreeShipping?: boolean;
  onMethodChange: (method: DeliveryMethod) => void;
  onHomeMethodChange: (method: HomeMethodId) => void;
  onPickupPointChange: (point: PickupPoint | null) => void;
  /** 測試用：注入搜尋函式 */
  search?: typeof searchPickupPoints;
}

function FeeLabel({ fee, isFree }: { fee: number; isFree: boolean }) {
  if (!isFree) return <span>{formatTwd(fee)}</span>;
  return (
    <span>
      <span className="mr-1 text-gray-400 line-through">{formatTwd(fee)}</span>
      <span className="font-semibold text-brand">NT$0</span>
    </span>
  );
}

/**
 * 購物車的配送方式選擇（比照 LUCISSI）：宅配選黑貓宅配或順豐宅配；超商取貨選 7-11、全家、萊爾富門市。
 * 超商取貨只有 site_settings.store_pickup_enabled 為 true 時才會出現；門市由 ShipAny 門市清單搜尋。
 * 建立結帳時伺服器會依這裡的選擇預選同名的 Shopify 運費。
 */
export default function PickupPointSelector({
  method,
  pickupPoint,
  shippingMethods,
  homeMethod,
  isFreeShipping = false,
  onMethodChange,
  onHomeMethodChange,
  onPickupPointChange,
  search = searchPickupPoints,
}: PickupPointSelectorProps) {
  const pickupMethods = shippingMethods.pickupMethods;
  const pickupAvailable = pickupMethods.length > 0;
  const homeMethods = sortedHomeMethods(shippingMethods);
  const [carrier, setCarrier] = useState<PickupCarrier>(pickupPoint?.carrier ?? pickupMethods[0]?.carrier ?? 'seven-eleven');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickupPoint[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isChanging, setIsChanging] = useState(!pickupPoint);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const showingSelected = Boolean(pickupPoint && !isChanging);
  const activeCarrier = showingSelected && pickupPoint ? pickupPoint.carrier : carrier;
  const activePickup = pickupMethods.find((item) => item.carrier === activeCarrier) ?? pickupMethods[0];
  const selectedHome = homeMethods.find((item) => item.id === homeMethod) ?? homeMethods[0];

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
      setSearchError(error instanceof PickupSearchError ? error.message : '門市清單暫時無法讀取，請稍後再試或改選宅配。');
    } finally {
      if (abortRef.current === controller) setIsSearching(false);
    }
  };

  const choosePoint = (point: PickupPoint) => {
    onPickupPointChange(point);
    setIsChanging(false);
    setResults(null);
  };

  const methodButton = (value: DeliveryMethod, label: string, feeText: string) => (
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
      <span className="block text-[11px] font-normal text-gray-500">{feeText}</span>
    </button>
  );

  const lowestHomeFee = homeMethods[0]?.fee ?? 0;
  const lowestPickupFee = pickupAvailable ? Math.min(...pickupMethods.map((item) => item.fee)) : 0;
  const feeHint = (fee: number, many: boolean) =>
    isFreeShipping ? '已達免運門檻，運費 NT$0' : `運費 ${formatTwd(fee)}${many ? ' 起' : ''}，達免運門檻免運`;

  return (
    <div className="space-y-3 pt-4 pb-2 border-t border-gray-100" data-testid="delivery-method-section">
      <h3 className="text-sm font-bold text-gray-900" style={fontStyle}>配送方式</h3>
      {pickupAvailable && (
        <div className="flex gap-2" role="radiogroup" aria-label="配送方式">
          {methodButton('home', '宅配到府', feeHint(lowestHomeFee, homeMethods.length > 1 && homeMethods[0].fee !== homeMethods[homeMethods.length - 1].fee))}
          {methodButton('pickup', '超商取貨', feeHint(lowestPickupFee, false))}
        </div>
      )}

      {method === 'home' && (
        <div className="space-y-2" data-testid="home-method-panel">
          <div className="space-y-1.5" role="radiogroup" aria-label="宅配方式">
            {homeMethods.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selectedHome?.id === item.id}
                onClick={() => onHomeMethodChange(item.id)}
                className={`flex w-full min-h-[44px] items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  selectedHome?.id === item.id ? 'border-brand bg-blush text-brand font-semibold' : 'border-gray-300 text-gray-700 hover:border-brand'
                }`}
                data-testid={`home-method-${item.id}`}
              >
                <span>{item.label}</span>
                <FeeLabel fee={item.fee} isFree={isFreeShipping} />
              </button>
            ))}
          </div>
          {selectedHome && (
            <p className="text-[11px] leading-5 text-gray-500">
              結帳頁會預先選好「{selectedHome.label}」，也可以在結帳頁改選其他宅配。
            </p>
          )}
        </div>
      )}

      {method === 'pickup' && pickupAvailable && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3" data-testid="pickup-point-panel">
          {showingSelected && pickupPoint ? (
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
                {pickupMethods.map((item) => (
                  <button
                    key={item.carrier}
                    type="button"
                    role="radio"
                    aria-checked={carrier === item.carrier}
                    onClick={() => {
                      setCarrier(item.carrier);
                      setResults(null);
                      setSearchError('');
                    }}
                    className={`flex-1 min-h-[44px] rounded-md border px-2 py-1 text-sm ${
                      carrier === item.carrier ? 'border-brand bg-blush text-brand font-semibold' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="block">{PICKUP_CARRIER_LABELS[item.carrier]}</span>
                    <span className="block text-[11px] font-normal"><FeeLabel fee={item.fee} isFree={isFreeShipping} /></span>
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
          {activePickup && (
            <div className="space-y-1 text-[11px] leading-5 text-gray-500" data-testid="pickup-method-notes">
              <p>取件時需出示與姓名相符的證件。{activePickup.sizeNote}。</p>
              <p>前往結帳後，請選擇「{activePickup.label}」運送方式，地址會自動帶入，請勿修改。可在結帳頁選擇線上付款或取貨付款。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
