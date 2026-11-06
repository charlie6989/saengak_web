import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSentryDsn, reportServerFailure, safeErrorCode } from '../api/_lib/server-monitoring.js';

const DSN = 'https://publickey@o123.ingest.us.sentry.io/456';

describe('server monitoring', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('SENTRY_DSN', DSN);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('parses a Sentry DSN into the envelope endpoint', () => {
    expect(parseSentryDsn(DSN)).toEqual({ publicKey: 'publickey', envelopeUrl: 'https://o123.ingest.us.sentry.io/api/456/envelope/' });
    expect(parseSentryDsn('http://key@sentry.example/1')).toBeNull();
    expect(parseSentryDsn('not a url')).toBeNull();
    expect(parseSentryDsn(undefined)).toBeNull();
  });

  it('sends a grouped envelope with the stable code and allowed tags', async () => {
    await reportServerFailure({
      area: 'shopify_webhook',
      failure: 'ORDER_SYNC_FAILED',
      tags: { topic: 'orders/paid', error_code: '23505', webhook_id: 'b54557e4-bdd9' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o123.ingest.us.sentry.io/api/456/envelope/');
    const [, itemHeader, eventLine] = String(init.body).split('\n');
    expect(JSON.parse(itemHeader)).toEqual({ type: 'event' });
    const event = JSON.parse(eventLine);
    expect(event.fingerprint).toEqual(['shopify_webhook', 'ORDER_SYNC_FAILED']);
    expect(event.level).toBe('error');
    expect(event.tags).toEqual({ area: 'shopify_webhook', topic: 'orders/paid', error_code: '23505', webhook_id: 'b54557e4-bdd9' });
  });

  it('drops tag values and failure text that could carry personal data', async () => {
    await reportServerFailure({
      area: 'invoice',
      failure: '王小明 buyer@example.test 失敗',
      tags: { error_code: 'buyer@example.test', outcome: '0912345678 台北市', job_id: 'job-1' },
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = String(init.body);
    expect(body).not.toContain('buyer@example.test');
    expect(body).not.toContain('王小明');
    expect(body).not.toContain('0912345678');
    expect(body).toContain('UNKNOWN_FAILURE');
    expect(body).toContain('job-1');

    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ');
    expect(logged).not.toContain('buyer@example.test');
    expect(logged).not.toContain('王小明');
  });

  it('never reads message or details from an error object', () => {
    expect(safeErrorCode({ code: '23505', message: 'Key (email)=(buyer@example.test) exists' })).toBe('23505');
    expect(safeErrorCode({ code: 'buyer@example.test' })).toBeUndefined();
    expect(safeErrorCode(new Error('buyer@example.test'))).toBeUndefined();
    expect(safeErrorCode(null)).toBeUndefined();
  });

  it('falls back to the frontend DSN variable and logs only when none is configured', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    vi.stubEnv('VITE_PUBLIC_SENTRY_DSN', DSN);
    await reportServerFailure({ area: 'invoice', failure: 'INVOICE_CLAIM_FAILED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    vi.stubEnv('VITE_PUBLIC_SENTRY_DSN', '');
    await reportServerFailure({ area: 'invoice', failure: 'INVOICE_CLAIM_FAILED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('never throws when Sentry is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(reportServerFailure({ area: 'cod_collection', failure: 'COD_COLLECTION_RUN_FAILED' })).resolves.toBeUndefined();
  });
});
