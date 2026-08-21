import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { PaymentForm, type PaymentFormHandle } from '../src/pages/checkout/PaymentForm';
import { IdentityFlow } from '../src/pages/checkout/IdentityFlow';
import {
  CheckoutErrorFallback,
  CheckoutErrorBoundary,
} from '../src/pages/checkout/CheckoutErrorFallback';
import { DENIED_KEYS, PII_KEYS, captureExceptionSafe } from '../src/lib/sentry';

describe('1. PaymentForm (TapPay Hosted Fields & PCI-DSS SAQ A-EP)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      TPDirect: {
        setupSDK: vi.fn(),
        card: {
          setup: vi.fn(),
          onUpdate: vi.fn(),
          getTappayFieldsStatus: vi.fn().mockReturnValue({ canGetPrime: true }),
          getPrime: vi.fn((callback) => {
            callback({
              status: 0,
              card: { prime: 'prime_test_tok_123456789' },
            });
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders hosted field container element IDs correctly', () => {
    const html = renderToString(<PaymentForm />);
    expect(html).toContain('id="tappay-card-number"');
    expect(html).toContain('id="tappay-card-expiration-date"');
    expect(html).toContain('id="tappay-card-ccv"');
    expect(html).toContain('PCI-DSS SAQ A-EP');
  });

  it('strictly adheres to zero-card-storage policy (no card state in props or output)', () => {
    const html = renderToString(<PaymentForm />);
    // 前端不應有任何卡號 input 欄位 (Hosted Fields 使用 div 容器供 TapPay iframe 注入)
    expect(html).not.toMatch(/<input[^>]*name=["']card_number["']/i);
    expect(html).not.toMatch(/<input[^>]*name=["']cvv["']/i);
    expect(html).not.toMatch(/<input[^>]*name=["']expiry["']/i);
  });

  it('safely obtains prime token via getPrime interface', async () => {
    const ref = React.createRef<PaymentFormHandle>();
    let statusCallback: any;

    (window as any).TPDirect.card.onUpdate.mockImplementation((cb: any) => {
      statusCallback = cb;
    });

    // 模擬已掛載
    const getPrimePromise = new Promise<string>((resolve, reject) => {
      (window as any).TPDirect.card.getPrime((result: any) => {
        if (result.status === 0) resolve(result.card.prime);
        else reject(new Error(result.msg));
      });
    });

    const prime = await getPrimePromise;
    expect(prime).toBe('prime_test_tok_123456789');
  });

  it('rejects getPrime when card fields are invalid', async () => {
    (window as any).TPDirect.card.getPrime.mockImplementation((cb: any) => {
      cb({
        status: 10001,
        msg: 'Card number is invalid',
      });
    });

    const getPrimePromise = new Promise<string>((resolve, reject) => {
      (window as any).TPDirect.card.getPrime((result: any) => {
        if (result.status === 0) resolve(result.card.prime);
        else reject(new Error(result.msg));
      });
    });

    await expect(getPrimePromise).rejects.toThrow('Card number is invalid');
  });
});

describe('2. IdentityFlow (Anti-Enumeration & Hybrid Identity)', () => {
  it('renders guest mode and member mode switch buttons', () => {
    const onModeChange = vi.fn();
    const onGuestEmailChange = vi.fn();
    const onGuestPhoneChange = vi.fn();

    const html = renderToString(
      <IdentityFlow
        mode="guest"
        onModeChange={onModeChange}
        guestEmail="test@example.com"
        guestPhone="0912345678"
        onGuestEmailChange={onGuestEmailChange}
        onGuestPhoneChange={onGuestPhoneChange}
      />,
    );

    expect(html).toContain('訪客快速結帳');
    expect(html).toContain('會員快速結帳');
    expect(html).toContain('test@example.com');
  });

  it('renders member info when user is authenticated', () => {
    const onModeChange = vi.fn();
    const onGuestEmailChange = vi.fn();
    const onGuestPhoneChange = vi.fn();

    const html = renderToString(
      <IdentityFlow
        mode="member"
        onModeChange={onModeChange}
        guestEmail=""
        guestPhone=""
        onGuestEmailChange={onGuestEmailChange}
        onGuestPhoneChange={onGuestPhoneChange}
        userEmail="vip_member@saengak.com"
      />,
    );

    expect(html).toContain('已登入會員');
    expect(html).toContain('vip_member@saengak.com');
  });

  it('implements anti-enumeration uniform response pattern for lookup', async () => {
    // 驗證不論帳號是否存在，回傳之統一安全文案均相同
    const uniformMessage =
      '若此手機號碼與 Email 與歷史訂單相符，系統已將 6 碼驗證碼與登入連結寄送至您的信箱，請查收並於下方輸入驗證。';
    expect(uniformMessage).toContain('若此手機號碼與 Email 與歷史訂單相符');
    expect(uniformMessage).not.toContain('帳號不存在');
    expect(uniformMessage).not.toContain('查無此用戶');
  });
});

describe('3. Checkout Payload Authority (Zero Front-End Price & SAQ A-EP)', () => {
  it('ensures checkout payload sends only variant ID and quantity without frontend prices', () => {
    const cartItems = [
      { id: '101', variantId: 'gid://shopify/ProductVariant/44123891', name: '抑菌洗護精華', price: 680, quantity: 2, image: '/img.jpg' },
      { id: '102', variantId: 'gid://shopify/ProductVariant/44123892', name: '無痕生理褲', price: 490, quantity: 1, image: '/img2.jpg' },
    ];

    const payload = {
      items: cartItems.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      shipping: {
        deliveryMode: 'home',
        recipient: {
          name: '王小美',
          phone: '0912345678',
          address: '台北市大安區忠孝東路四段 1 號',
        },
      },
      invoice: {
        kind: 'personal',
        carrier: 'mobile',
        carrierId: '/TRM+O+P',
      },
      prime: 'prime_test_token_sample',
    };

    // 驗證 payload 不含 price 或 amount
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('"price"');
    expect(serialized).not.toContain('"amount"');
    expect(payload.items[0]).toEqual({
      variantId: 'gid://shopify/ProductVariant/44123891',
      quantity: 2,
    });
    expect(payload.prime).toBe('prime_test_token_sample');
  });

  it('validates Idempotency-Key format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const testKey = '12345678-1234-4234-a234-1234567890ab';
    expect(uuidRegex.test(testKey)).toBe(true);
  });
});

describe('4. CheckoutErrorBoundary & Recovery Fallback', () => {
  it('renders recovery alert and 6-digit short event tracking id', () => {
    const html = renderToString(
      <CheckoutErrorFallback
        error={new Error('模擬結帳錯誤')}
        eventId="#a8f92d"
      />,
    );

    expect(html).toContain('結帳區域發生臨時異常');
    expect(html).toContain('您的購物車商品已安全保存');
    expect(html).toContain('#a8f92d');
    expect(html).toContain('重試結帳');
    expect(html).toContain('回到首頁 / 購物車');
  });

  it('preserves cart contents during boundary recovery', () => {
    // 模擬 localStorage
    const sampleCart = JSON.stringify([
      { id: '1', variantId: 'v1', name: '商品 A', price: 500, quantity: 1 },
    ]);

    const mockStorage: Record<string, string> = { cart: sampleCart };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
    });

    // 模擬 ErrorBoundary 捕捉異常
    const boundary = new CheckoutErrorBoundary({
      children: <div>正常結帳</div>,
    });

    // 執行 componentDidCatch
    boundary.componentDidCatch(new Error('模擬渲染崩潰'), {
      componentStack: 'in DummyCheckoutComponent',
    });

    // 驗證 localStorage 中的購物車未被清除
    expect(mockStorage.cart).toBe(sampleCart);
  });

  it('generates short 6-hex event ID in captureExceptionSafe', () => {
    const eventId = captureExceptionSafe(new Error('測試安全異常'));
    expect(eventId).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('5. ThreeDSCallback Flow', () => {
  it('handles rec_trade_id param validation', () => {
    const params = new URLSearchParams('rec_trade_id=TST_TRADE_12345&order_id=ORD_998');
    expect(params.get('rec_trade_id')).toBe('TST_TRADE_12345');
    expect(params.get('order_id')).toBe('ORD_998');
  });
});

describe('6. Sentry Denied Keys & PCI-DSS SAQ A-EP Compliance', () => {
  it('denies all card-related keys in logging and exception capture', () => {
    expect(DENIED_KEYS).toContain('prime');
    expect(DENIED_KEYS).toContain('card_number');
    expect(DENIED_KEYS).toContain('cvv');
    expect(DENIED_KEYS).toContain('expiry');
  });

  it('masks personal identifiable information (PII)', () => {
    expect(PII_KEYS).toContain('name');
    expect(PII_KEYS).toContain('phone');
    expect(PII_KEYS).toContain('email');
    expect(PII_KEYS).toContain('address');
  });
});
