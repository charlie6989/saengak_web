/**
 * SAENGAK 伺服器端限流模組 (Rate Limiter)
 * 實作 Upstash Redis REST Sliding Window 演算法，支援高並發結帳與測卡防護。
 * 若 Redis 未配置或連線異常，平滑降級至 in-memory sliding window 並安全回報 Sentry。
 *
 * 規範依據：docs/CHECKOUT_PAYMENT_SPEC.md §7.2
 */

import { captureExceptionSafe } from '../../src/lib/sentry.js';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // 毫秒時間戳記 (Unix Timestamp in ms)
  source: 'redis' | 'memory';
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  prefix?: string;
}

/**
 * 預設限流閾值
 * - IP 限流：每分鐘最多 5 次
 * - 會員限流：每小時最多 10 次
 */
export const IP_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 分鐘 (60,000 ms)
  prefix: 'rl:ip',
};

export const USER_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 小時 (3,600,000 ms)
  prefix: 'rl:user',
};

// 記憶體滑動視窗儲存 (In-Memory Fallback Cache)
const memoryStore = new Map<string, number[]>();

/**
 * 重置記憶體快取 (主要供測試或清理使用)
 */
export function resetMemoryStore(): void {
  memoryStore.clear();
}

/**
 * 記憶體 Sliding Window 限流核心邏輯
 */
export function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now()
): RateLimitResult {
  const { maxRequests, windowMs } = config;
  const windowStart = now - windowMs;
  const existing = memoryStore.get(key) || [];
  
  // 過濾掉視窗外的過期請求時間戳記
  const validTimestamps = existing.filter((ts) => ts > windowStart);

  if (validTimestamps.length < maxRequests) {
    validTimestamps.push(now);
    memoryStore.set(key, validTimestamps);
    const oldest = validTimestamps[0] || now;
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - validTimestamps.length,
      reset: oldest + windowMs,
      source: 'memory',
    };
  }

  memoryStore.set(key, validTimestamps);
  const oldest = validTimestamps[0] || now;
  return {
    success: false,
    limit: maxRequests,
    remaining: 0,
    reset: oldest + windowMs,
    source: 'memory',
  };
}

/**
 * Lua 腳本：Redis 原子滑動視窗計算
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 10)
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetAt = now + windowMs
  if oldest and #oldest >= 2 then
    resetAt = tonumber(oldest[2]) + windowMs
  end
  return { 1, limit - currentCount - 1, resetAt }
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetAt = now + windowMs
  if oldest and #oldest >= 2 then
    resetAt = tonumber(oldest[2]) + windowMs
  end
  return { 0, 0, resetAt }
end
`;

/**
 * 執行 Upstash Redis REST Sliding Window 限流
 */
async function executeUpstashRedis(
  key: string,
  config: RateLimitConfig,
  now: number,
  url: string,
  token: string
): Promise<RateLimitResult> {
  const { maxRequests, windowMs } = config;
  const member = `${now}:${Math.random().toString(36).substring(2, 9)}`;
  const cleanUrl = url.replace(/\/$/, '');

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      'EVAL',
      SLIDING_WINDOW_LUA,
      1,
      key,
      now.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      member,
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash Redis HTTP error: status ${response.status}`);
  }

  const data = (await response.json()) as { result?: [number, number, number]; error?: string };
  if (data.error) {
    throw new Error(`Upstash Redis error: ${data.error}`);
  }

  if (!data.result || !Array.isArray(data.result)) {
    throw new Error('Upstash Redis invalid response payload');
  }

  const [allowedFlag, remaining, resetAt] = data.result;

  return {
    success: allowedFlag === 1,
    limit: maxRequests,
    remaining: Number(remaining),
    reset: Number(resetAt),
    source: 'redis',
  };
}

/**
 * 通用限流入口函式
 * 優先使用 Upstash Redis REST，若失敗或未設定則平滑降級至 in-memory 並記錄 Sentry
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  customNow: number = Date.now()
): Promise<RateLimitResult> {
  const prefix = config.prefix || 'rl';
  const key = `${prefix}:${identifier}`;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      return await executeUpstashRedis(key, config, customNow, redisUrl, redisToken);
    } catch (err) {
      captureExceptionSafe(err, {
        source: 'ratelimit',
        fallback: 'in-memory',
        key,
        limit: config.maxRequests,
        windowMs: config.windowMs,
      });
      return checkMemoryRateLimit(key, config, customNow);
    }
  }

  // 若 Redis 未設定，平滑降級至 in-memory 並記錄脫敏降級警示
  captureExceptionSafe(new Error('Upstash Redis 未設定 (UPSTASH_REDIS_REST_URL/TOKEN 缺失)'), {
    source: 'ratelimit',
    fallback: 'in-memory',
    key,
  });

  return checkMemoryRateLimit(key, config, customNow);
}

/**
 * IP 速率限制檢查 (≤ 5 次/分鐘)
 */
export async function checkIpRateLimit(
  ip: string,
  customNow?: number
): Promise<RateLimitResult> {
  const cleanIp = ip.trim() || 'unknown-ip';
  return checkRateLimit(cleanIp, IP_RATE_LIMIT, customNow);
}

/**
 * 會員速率限制檢查 (≤ 10 次/小時)
 */
export async function checkUserRateLimit(
  userId: string,
  customNow?: number
): Promise<RateLimitResult> {
  const cleanUserId = userId.trim() || 'anonymous';
  return checkRateLimit(cleanUserId, USER_RATE_LIMIT, customNow);
}

/**
 * 結帳整體限流檢查 (同時核對 IP 與會員帳號)
 */
export async function checkCheckoutRateLimit(
  params: { ip?: string; userId?: string },
  customNow?: number
): Promise<{
  allowed: boolean;
  ipResult?: RateLimitResult;
  userResult?: RateLimitResult;
  error?: string;
}> {
  const { ip, userId } = params;

  let ipResult: RateLimitResult | undefined;
  if (ip) {
    ipResult = await checkIpRateLimit(ip, customNow);
    if (!ipResult.success) {
      return {
        allowed: false,
        ipResult,
        error: '結帳請求過於頻繁，請稍後再試 (IP 限流已達上限)。',
      };
    }
  }

  let userResult: RateLimitResult | undefined;
  if (userId) {
    userResult = await checkUserRateLimit(userId, customNow);
    if (!userResult.success) {
      return {
        allowed: false,
        ipResult,
        userResult,
        error: '會員結帳次數已達每小時上限，請稍後再試。',
      };
    }
  }

  return {
    allowed: true,
    ipResult,
    userResult,
  };
}
