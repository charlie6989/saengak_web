import { describe, it, expect, vi } from 'vitest';
import {
  DENIED_KEYS,
  PII_KEYS,
  REDACTED_SENSITIVE,
  REDACTED_PII,
  REDACTED_CIRCULAR,
  isDeniedKey,
  isPiiKey,
  maskName,
  maskPhone,
  maskEmail,
  maskAddress,
  sanitizeString,
  sanitizeObject,
  sanitizeBreadcrumb,
  sanitizeEvent,
  captureExceptionSafe,
  generateShortEventId,
} from '../src/lib/sentry';

describe('Sentry Sanitizer & Security Redaction (資安脫敏測試)', () => {
  describe('機密欄位判定與脫敏 (Denied Keys)', () => {
    it('應正確識別所有機密欄位 (不區分大小寫與底線/駝峰命名)', () => {
      expect(isDeniedKey('prime')).toBe(true);
      expect(isDeniedKey('card_number')).toBe(true);
      expect(isDeniedKey('cardNumber')).toBe(true);
      expect(isDeniedKey('CARD_NUMBER')).toBe(true);
      expect(isDeniedKey('cvv')).toBe(true);
      expect(isDeniedKey('CVV')).toBe(true);
      expect(isDeniedKey('cvc')).toBe(true);
      expect(isDeniedKey('expiry')).toBe(true);
      expect(isDeniedKey('password')).toBe(true);
      expect(isDeniedKey('secret')).toBe(true);
      expect(isDeniedKey('token')).toBe(true);
      expect(isDeniedKey('access_token')).toBe(true);
      expect(isDeniedKey('accessToken')).toBe(true);
      expect(isDeniedKey('refresh_token')).toBe(true);
      expect(isDeniedKey('authorization')).toBe(true);
      expect(isDeniedKey('Authorization')).toBe(true);
      expect(isDeniedKey('product_title')).toBe(false);
      expect(isDeniedKey('order_id')).toBe(false);
    });

    it('將卡號、CVV、prime、token、密碼等欄位替換為 [REDACTED_SENSITIVE]', () => {
      const sensitiveData = {
        prime: 'prime_test_tok_1234567890abcdef',
        card_number: '4311952222222222',
        cvv: '123',
        expiry: '12/28',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae9oGA',
        access_token: 'acctok_xyz123456789',
        authorization: 'Bearer secret_auth_token_999',
        public_info: 'SAENGAK Organic Store',
      };

      const sanitized = sanitizeObject(sensitiveData);

      expect(sanitized.prime).toBe(REDACTED_SENSITIVE);
      expect(sanitized.card_number).toBe(REDACTED_SENSITIVE);
      expect(sanitized.cvv).toBe(REDACTED_SENSITIVE);
      expect(sanitized.expiry).toBe(REDACTED_SENSITIVE);
      expect(sanitized.password).toBe(REDACTED_SENSITIVE);
      expect(sanitized.token).toBe(REDACTED_SENSITIVE);
      expect(sanitized.access_token).toBe(REDACTED_SENSITIVE);
      expect(sanitized.authorization).toBe(REDACTED_SENSITIVE);
      expect(sanitized.public_info).toBe('SAENGAK Organic Store');
    });
  });

  describe('個人識別資訊脫敏 (PII Keys)', () => {
    it('姓名脫敏規則測試 (2字、3字、4字以上)', () => {
      expect(maskName('王明')).toBe('王*');
      expect(maskName('王小明')).toBe('王*明');
      expect(maskName('歐陽小明')).toBe('歐**明');
      expect(maskName('諸葛孔明先生')).toBe('諸****生');
      expect(maskName('John Doe')).toBe('J******e');
      expect(maskName('')).toBe(REDACTED_PII);
    });

    it('手機與電話脫敏規則測試', () => {
      expect(maskPhone('0912345678')).toBe('0912***678');
      expect(maskPhone('0912-345-678')).toBe('0912***678');
      expect(maskPhone('0912 345 678')).toBe('0912***678');
      expect(maskPhone('+886912345678')).toMatch(/^[0-9+]{2,4}\*+[0-9]{2,4}$/);
      expect(maskPhone('123')).toBe(REDACTED_PII);
    });

    it('電子郵件 Email 脫敏規則測試', () => {
      expect(maskEmail('alice@example.com')).toBe('a***@example.com');
      expect(maskEmail('master@saengak.com.tw')).toBe('m***@saengak.com.tw');
      expect(maskEmail('service@saengak.tw')).toBe('s***@saengak.tw');
      expect(maskEmail('invalid-email')).toBe(REDACTED_PII);
    });

    it('地址脫敏規則測試', () => {
      expect(maskAddress('台北市大安區信義路三段100號5樓')).toBe('台北市大安區***');
      expect(maskAddress('台中市西屯區台灣大道二段99號')).toBe('台中市西屯區***');
      expect(maskAddress('台北市')).toBe(REDACTED_PII);
    });

    it('透過 sanitizeObject 處理 PII 欄位', () => {
      const piiData = {
        name: '王小明',
        receiver_name: '李美麗',
        phone: '0912345678',
        receiver_phone: '0988111222',
        email: 'customer@gmail.com',
        address: '新北市板橋區縣民大道二段7號',
        receiver_address: '高雄市苓雅區四維三路2號',
        item_count: 3,
      };

      const sanitized = sanitizeObject(piiData);

      expect(sanitized.name).toBe('王*明');
      expect(sanitized.receiver_name).toBe('李*麗');
      expect(sanitized.phone).toBe('0912***678');
      expect(sanitized.receiver_phone).toBe('0988***222');
      expect(sanitized.email).toBe('c***@gmail.com');
      expect(sanitized.address).toBe('新北市板橋區***');
      expect(sanitized.receiver_address).toBe('高雄市苓雅區***');
      expect(sanitized.item_count).toBe(3);
    });
  });

  describe('深層巢狀結構與邊界情況過濾', () => {
    it('正確過濾多層巢狀物件與陣列中的敏感資料', () => {
      const complexPayload = {
        transaction: {
          id: 'tx_987654',
          payment: {
            method: 'direct_pay',
            card_number: '4000123456789010',
            cvv: '999',
            auth_token: 'secret_token_val',
          },
          items: [
            {
              sku: 'SGK-OR-01',
              qty: 2,
              customer_note: '請寄給 receiver_name: 張*芬',
            },
          ],
          shipping: {
            receiver_name: '張淑芬',
            receiver_phone: '0933444555',
            receiver_address: '台南市安平區平通路123號',
          },
        },
      };

      const sanitized = sanitizeObject(complexPayload);

      expect(sanitized.transaction.payment.card_number).toBe(REDACTED_SENSITIVE);
      expect(sanitized.transaction.payment.cvv).toBe(REDACTED_SENSITIVE);
      expect(sanitized.transaction.payment.auth_token).toBe(REDACTED_SENSITIVE);
      expect(sanitized.transaction.shipping.receiver_name).toBe('張*芬');
      expect(sanitized.transaction.shipping.receiver_phone).toBe('0933***555');
      expect(sanitized.transaction.shipping.receiver_address).toBe('台南市安平區***');
      expect(sanitized.transaction.id).toBe('tx_987654');
    });

    it('安全處理循環引用 (Circular Reference) 不造成 Stack Overflow', () => {
      const circularObj: any = { name: '循環測試' };
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj };

      const sanitized = sanitizeObject(circularObj);

      expect(sanitized.name).toBe('循**試');
      expect(sanitized.self).toBe(REDACTED_CIRCULAR);
      expect(sanitized.nested.parent).toBe(REDACTED_CIRCULAR);
    });

    it('正確處理 null, undefined, 數字, 布林值等基本型別', () => {
      expect(sanitizeObject(null)).toBeNull();
      expect(sanitizeObject(undefined)).toBeUndefined();
      expect(sanitizeObject(12345)).toBe(12345);
      expect(sanitizeObject(true)).toBe(true);
    });

    it('正確脫敏 Error 物件的 message 與 stack', () => {
      const error = new Error('Payment failed with prime_secret_tappay_token_12345678 and card 4111222233334444');
      const sanitized = sanitizeObject(error);

      expect(sanitized.name).toBe('Error');
      expect(sanitized.message).not.toContain('prime_secret_tappay_token_12345678');
      expect(sanitized.message).not.toContain('4111222233334444');
      expect(sanitized.message).toContain(REDACTED_SENSITIVE);
    });
  });

  describe('字串正規表達式內容掃描 (sanitizeString)', () => {
    it('應主動遮蔽字串中夾帶的信用卡卡號、JWT 與 Prime', () => {
      const logString = 'Error occurred during auth with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae9oGA and card 4222-2222-2222-2222 and prime_999888777666555';
      const sanitized = sanitizeString(logString);

      expect(sanitized).not.toContain('4222-2222-2222-2222');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).not.toContain('prime_999888777666555');
      expect(sanitized).toContain(REDACTED_SENSITIVE);
    });
  });

  describe('Sentry 鉤子函式 (sanitizeBreadcrumb & sanitizeEvent)', () => {
    it('sanitizeBreadcrumb 能有效過濾 breadcrumb.data 內機密', () => {
      const breadcrumb = {
        category: 'checkout',
        message: 'User clicked submit payment',
        data: {
          card_number: '5555444433332222',
          cvv: '456',
          email: 'payer@example.com',
        },
      };

      const sanitized = sanitizeBreadcrumb(breadcrumb);

      expect(sanitized.data.card_number).toBe(REDACTED_SENSITIVE);
      expect(sanitized.data.cvv).toBe(REDACTED_SENSITIVE);
      expect(sanitized.data.email).toBe('p***@example.com');
    });

    it('sanitizeEvent 能有效過濾 event payload 內的敏感資訊', () => {
      const event = {
        event_id: 'abc123456',
        level: 'error',
        extra: {
          request_body: {
            prime: 'prime_xyz987654321',
            password: 'mypassword',
            receiver_phone: '0911222333',
          },
        },
      };

      const sanitized = sanitizeEvent(event);

      expect(sanitized.extra.request_body.prime).toBe(REDACTED_SENSITIVE);
      expect(sanitized.extra.request_body.password).toBe(REDACTED_SENSITIVE);
      expect(sanitized.extra.request_body.receiver_phone).toBe('0911***333');
    });
  });

  describe('captureExceptionSafe 安全例外捕捉與短碼產生', () => {
    it('產生格式符合 #xxxxxx 格式之 short eventId', () => {
      const id = generateShortEventId();
      expect(id).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('captureExceptionSafe 執行時安全脫敏 context 並回傳 eventId', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Checkout API Timeout');
      const context = {
        card_number: '4311952222222222',
        email: 'tester@example.com',
      };

      const eventId = captureExceptionSafe(error, context);

      expect(eventId).toMatch(/^#[0-9a-f]{6}$/);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('captureExceptionSafe 應主動過濾 PGRST205 / schema cache 錯誤且不發送至 Sentry', () => {
      const mockCapture = vi.fn();
      (globalThis as any).window = {
        Sentry: {
          captureException: mockCapture,
        },
      };

      const pgrstError = {
        code: 'PGRST205',
        details: null,
        hint: "Perhaps you meant the table 'public.promotions'",
        message: "Could not find the table 'public.product_reviews' in the schema cache",
      };

      const eventId = captureExceptionSafe(pgrstError);
      expect(eventId).toMatch(/^#[0-9a-f]{6}$/);
      expect(mockCapture).not.toHaveBeenCalled();

      delete (globalThis as any).window;
    });

    it('captureExceptionSafe 遇非 Error 純物件時應正規化為 Error 實例以避免 Sentry 警告', () => {
      const mockCapture = vi.fn();
      (globalThis as any).window = {
        Sentry: {
          captureException: mockCapture,
        },
      };

      const rawErrorObj = {
        code: 'NETWORK_TIMEOUT',
        message: '連線逾時',
      };

      captureExceptionSafe(rawErrorObj);
      expect(mockCapture).toHaveBeenCalledTimes(1);
      const sentArg = mockCapture.mock.calls[0][0];
      expect(sentArg).toBeInstanceOf(Error);
      expect(sentArg.message).toContain('[NETWORK_TIMEOUT] 連線逾時');

      delete (globalThis as any).window;
    });
  });

  describe('ErrorBoundary 邏輯測試', () => {
    it('getDerivedStateFromError 正確設置 hasError 與 error 物件', async () => {
      const { ErrorBoundary } = await import('../src/components/system/ErrorBoundary');
      const testErr = new Error('Render Error');
      const state = ErrorBoundary.getDerivedStateFromError(testErr);

      expect(state.hasError).toBe(true);
      expect(state.error).toBe(testErr);
    });

    it('resetError 能正確呼叫 setState 與 onReset 回調', async () => {
      const { ErrorBoundary } = await import('../src/components/system/ErrorBoundary');
      const onResetMock = vi.fn();
      const boundary = new ErrorBoundary({ children: null, onReset: onResetMock });
      const setStateSpy = vi.spyOn(boundary, 'setState').mockImplementation(() => {});

      boundary.resetError();

      expect(setStateSpy).toHaveBeenCalledWith({
        hasError: false,
        error: null,
        eventId: null,
      });
      expect(onResetMock).toHaveBeenCalledTimes(1);
    });
  });
});
