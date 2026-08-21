import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  checkIpRateLimit,
  checkUserRateLimit,
  checkCheckoutRateLimit,
  checkMemoryRateLimit,
  resetMemoryStore,
  IP_RATE_LIMIT,
  USER_RATE_LIMIT,
} from '../api/_lib/ratelimit';
import * as sentryModule from '../src/lib/sentry';

describe('Server-side Rate Limiter (伺服器端限流模組測試)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetMemoryStore();
    vi.restoreAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('記憶體滑動視窗 (In-Memory Sliding Window) 基礎測試', () => {
    it('IP 限流：每分鐘允許最多 5 次請求，第 6 次遭到拒絕', async () => {
      const ip = '192.168.1.100';
      const baseTime = 1724140000000;

      // 執行 5 次合法請求 (t = 0s, 10s, 20s, 30s, 40s)
      for (let i = 0; i < 5; i++) {
        const result = await checkIpRateLimit(ip, baseTime + i * 10000);
        expect(result.success).toBe(true);
        expect(result.source).toBe('memory');
        expect(result.limit).toBe(5);
        expect(result.remaining).toBe(5 - (i + 1));
      }

      // 第 6 次請求 (t = 50s，仍在 60 秒視窗內) -> 應被拒絕
      const blockedResult = await checkIpRateLimit(ip, baseTime + 50000);
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.source).toBe('memory');
    });

    it('滑動視窗平移：超出 60 秒後，舊請求過期並釋放額度', async () => {
      const ip = '192.168.1.101';
      const baseTime = 1724140000000;

      // 在 t = 0s 填滿 5 次請求
      for (let i = 0; i < 5; i++) {
        await checkIpRateLimit(ip, baseTime);
      }

      // t = 30s 時請求應被拒絕
      const at30s = await checkIpRateLimit(ip, baseTime + 30000);
      expect(at30s.success).toBe(false);

      // t = 61s 時 (第 1 筆至第 5 筆 t=0s 已過期) -> 應重新允許請求
      const at61s = await checkIpRateLimit(ip, baseTime + 61000);
      expect(at61s.success).toBe(true);
      expect(at61s.remaining).toBe(4);
    });

    it('會員限流：每小時允許最多 10 次請求，第 11 次遭到拒絕', async () => {
      const userId = 'usr_test_member_001';
      const baseTime = 1724140000000;

      for (let i = 0; i < 10; i++) {
        const result = await checkUserRateLimit(userId, baseTime + i * 1000);
        expect(result.success).toBe(true);
        expect(result.limit).toBe(10);
        expect(result.remaining).toBe(10 - (i + 1));
      }

      const blockedResult = await checkUserRateLimit(userId, baseTime + 15000);
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it('不同 IP 與不同會員之間的限流計數互相獨立隔離', async () => {
      const baseTime = 1724140000000;
      const ipA = '10.0.0.1';
      const ipB = '10.0.0.2';

      for (let i = 0; i < 5; i++) {
        await checkIpRateLimit(ipA, baseTime);
      }

      expect((await checkIpRateLimit(ipA, baseTime)).success).toBe(false);
      expect((await checkIpRateLimit(ipB, baseTime)).success).toBe(true);
    });
  });

  describe('結帳端點整合限流 (checkCheckoutRateLimit)', () => {
    it('當 IP 與 User ID 均在額度內時回傳 allowed: true', async () => {
      const result = await checkCheckoutRateLimit({
        ip: '114.34.1.1',
        userId: 'usr_valid_01',
      });

      expect(result.allowed).toBe(true);
      expect(result.ipResult?.success).toBe(true);
      expect(result.userResult?.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('當 IP 超出限制時回傳 allowed: false 與對應錯誤訊息', async () => {
      const ip = '114.34.1.2';
      const userId = 'usr_valid_02';

      for (let i = 0; i < 5; i++) {
        await checkIpRateLimit(ip);
      }

      const result = await checkCheckoutRateLimit({ ip, userId });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('IP 限流已達上限');
    });

    it('當會員超出限制時回傳 allowed: false 與對應錯誤訊息', async () => {
      const ip = '114.34.1.3';
      const userId = 'usr_rate_limited_03';

      for (let i = 0; i < 10; i++) {
        await checkUserRateLimit(userId);
      }

      const result = await checkCheckoutRateLimit({ ip, userId });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('會員結帳次數已達每小時上限');
    });
  });

  describe('Upstash Redis 異常與降級可觀測性 (Graceful Fallback & Sentry)', () => {
    it('Redis 未配置時呼叫 captureExceptionSafe 記錄降級並以記憶體模式正常執行', async () => {
      const captureSpy = vi.spyOn(sentryModule, 'captureExceptionSafe');

      const result = await checkIpRateLimit('192.168.1.200');

      expect(result.success).toBe(true);
      expect(result.source).toBe('memory');
      expect(captureSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          source: 'ratelimit',
          fallback: 'in-memory',
        })
      );
    });

    it('Redis 連線失敗或 HTTP 錯誤時，平滑降級至記憶體限流並回報 Sentry', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-endpoint.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake_redis_token';

      const captureSpy = vi.spyOn(sentryModule, 'captureExceptionSafe');

      // 模擬 fetch 拋出網路例外
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Redis connection timeout'))
      );

      const result = await checkRateLimit('test_client_001', IP_RATE_LIMIT);

      expect(result.success).toBe(true);
      expect(result.source).toBe('memory');
      expect(captureSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          source: 'ratelimit',
          fallback: 'in-memory',
        })
      );

      vi.unstubAllGlobals();
    });
  });

  describe('Upstash Redis REST 模式執行 (模擬正常 Redis 回傳)', () => {
    it('當 Upstash 回傳核准結果時正確解析並回傳 source: redis', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'valid_token_xyz';

      const resetTimestamp = 1724140060000;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            result: [1, 4, resetTimestamp], // [allowedFlag=1, remaining=4, resetAt]
          }),
        })
      );

      const result = await checkIpRateLimit('192.168.1.205');

      expect(result.success).toBe(true);
      expect(result.source).toBe('redis');
      expect(result.remaining).toBe(4);
      expect(result.reset).toBe(resetTimestamp);

      vi.unstubAllGlobals();
    });

    it('當 Upstash 回傳限流封鎖 (allowedFlag=0) 時回傳 success: false', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'valid_token_xyz';

      const resetTimestamp = 1724140060000;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            result: [0, 0, resetTimestamp], // [allowedFlag=0, remaining=0, resetAt]
          }),
        })
      );

      const result = await checkIpRateLimit('192.168.1.206');

      expect(result.success).toBe(false);
      expect(result.source).toBe('redis');
      expect(result.remaining).toBe(0);

      vi.unstubAllGlobals();
    });
  });
});
