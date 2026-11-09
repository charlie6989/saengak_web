import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  carrierFromLocationType,
  findShipAnyPickupPoint,
  getShipAnyAccessToken,
  loadPickupIndex,
  normalizeLocationFile,
  openToken,
  resetPickupPointCache,
  sealToken,
  supabaseTokenStore,
  type LocationSource,
  type TokenStore,
} from '../api/_lib/shipany-pickup-points.js';
import { handlePickupPointSearch, isStorePickupEnabled } from '../api/_lib/pickup-points-handler.js';
import { resetMemoryDatabase, setMemorySiteSetting } from '../api/_lib/supabase-admin.js';

const NOW = Date.parse('2026-11-09T02:00:00Z');
const ENV = { SHIPANY_CLIENT_KEY: 'client-key', SHIPANY_MERCHANT_TOKEN: 'boot-access', SHIPANY_REFRESH_TOKEN: 'boot-refresh' };

function memoryTokenStore(initial: Awaited<ReturnType<TokenStore['read']>> = null) {
  let row = initial;
  const store: TokenStore & { current: () => typeof row } = {
    read: vi.fn(async () => row),
    rotate: vi.fn(async (previous, accessToken, accessExpiresAt, refreshToken) => {
      if (previous === null ? row !== null : row?.refreshToken !== previous) return false;
      row = { accessToken, accessExpiresAt, refreshToken };
      return true;
    }),
    current: () => row,
  };
  return store;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** 與 ShipAny 2026-11 門市資料檔相同結構的門市。 */
function shipAnyStore(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-1',
    courier_id: 'courier-1',
    code: '002816',
    api_code: '',
    is_active: true,
    name: '全家板橋板農店',
    name_cht: '全家板橋板農店',
    typ: 'Convenience Store',
    detail_loc_typ: 'Family Mart',
    addr: {
      distr: '板橋區',
      lns: ['新北市板橋區文化路一段２１６巷３１號'],
      lns_cht: ['新北市板橋區文化路一段２１６巷３１號'],
      city: '新北市',
      cnty: 'TWN',
    },
    is_pickup: false,
    is_delivery: true,
    supported_storage_types: ['Normal'],
    ...overrides,
  };
}

const familySource: LocationSource = {
  courierUid: 'fm-uid',
  courierApiType: 'FamilyMart',
  url: 'https://locations.example.com/familymart.json',
  enabledTypes: ['Family Mart'],
};
const sfSource: LocationSource = {
  courierUid: 'sf-uid',
  courierApiType: 'SfExpressV2',
  url: 'https://locations.example.com/sf.json',
  enabledTypes: ['Family Mart (SF Express)', 'Hi-Life (SF Express)', '7-Eleven (SF Express)'],
};

describe('carrierFromLocationType', () => {
  it('recognises the location types ShipAny uses', () => {
    expect(carrierFromLocationType('Family Mart')).toBe('familymart');
    expect(carrierFromLocationType('Family Mart (SF Express)')).toBe('familymart');
    expect(carrierFromLocationType('7-Eleven (SF Express)')).toBe('seven-eleven');
    expect(carrierFromLocationType('7-Eleven (Yamato)')).toBe('seven-eleven');
    expect(carrierFromLocationType('Hi-Life (SF Express)')).toBe('hilife');
    expect(carrierFromLocationType('Yamato Store')).toBeUndefined();
  });
});

describe('normalizeLocationFile', () => {
  it('reads the ShipAny store format and converts full-width digits', () => {
    expect(normalizeLocationFile(familySource, [shipAnyStore()])).toEqual([
      {
        carrier: 'familymart',
        code: '002816',
        name: '全家板橋板農店',
        address: '新北市板橋區文化路一段216巷31號',
        city: '新北市',
        district: '板橋區',
        courier: 'FamilyMart',
      },
    ]);
  });

  it('skips closed, non-receiving, chilled-only and malformed stores', () => {
    const points = normalizeLocationFile(familySource, [
      shipAnyStore({ code: '000001', is_active: false }),
      shipAnyStore({ code: '000002', is_delivery: false }),
      shipAnyStore({ code: '000003', supported_storage_types: ['Frozen'] }),
      shipAnyStore({ code: 'bad code!' }),
      shipAnyStore({ code: '000005', name: '', name_cht: '' }),
      shipAnyStore({ code: '000006', addr: { lns_cht: ['970花蓮縣花蓮市中福路161號'], city: '花蓮縣', distr: '花蓮市' } }),
    ]);
    expect(points.map((point) => [point.code, point.address])).toEqual([['000006', '花蓮縣花蓮市中福路161號']]);
  });

  it('keeps only the chains this courier is assigned to ship', () => {
    const file = [
      shipAnyStore({ code: '10003', name_cht: '全家延吉店', detail_loc_typ: 'Family Mart (SF Express)' }),
      shipAnyStore({ code: '20001', name_cht: '萊爾富民生店', detail_loc_typ: 'Hi-Life (SF Express)' }),
      shipAnyStore({ code: '30001', name_cht: '7-11 民生門市', detail_loc_typ: '7-Eleven (SF Express)' }),
    ];
    // 全家指定走全家店到店，所以順豐檔案裡的全家門市不收；7-11 與萊爾富走順豐。
    expect(normalizeLocationFile(sfSource, file).map((point) => [point.carrier, point.code])).toEqual([
      ['hilife', '20001'],
      ['seven-eleven', '30001'],
    ]);
    // 物流商沒有啟用的自取點類型一律略過。
    expect(normalizeLocationFile({ ...sfSource, enabledTypes: ['Hi-Life (SF Express)'] }, file).map((point) => point.code)).toEqual(['20001']);
  });
});

describe('getShipAnyAccessToken', () => {
  it('reuses a stored access token that is still valid', async () => {
    const tokenStore = memoryTokenStore({ accessToken: 'stored-access', accessExpiresAt: '2026-11-09T05:00:00Z', refreshToken: 'stored-refresh' });
    const transport = vi.fn();
    await expect(getShipAnyAccessToken({ env: ENV, tokenStore, transport, now: () => NOW })).resolves.toBe('stored-access');
    expect(transport).not.toHaveBeenCalled();
  });

  it('bootstraps from the environment and stores the rotated pair', async () => {
    const tokenStore = memoryTokenStore(null);
    const transport = vi.fn(async () => json({ data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 14400 } }));
    await expect(getShipAnyAccessToken({ env: ENV, tokenStore, transport, now: () => NOW })).resolves.toBe('new-access');

    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://open-tw.shipany.io/auth/token/refresh');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('client-key');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer boot-access');
    expect(JSON.parse(String(init.body))).toEqual({ refresh_token: 'boot-refresh' });
    expect(tokenStore.current()).toEqual({ accessToken: 'new-access', accessExpiresAt: '2026-11-09T06:00:00.000Z', refreshToken: 'new-refresh' });
  });

  it('rotates with the stored refresh token once the access token is about to expire', async () => {
    const tokenStore = memoryTokenStore({ accessToken: 'old-access', accessExpiresAt: '2026-11-09T02:03:00Z', refreshToken: 'stored-refresh' });
    const transport = vi.fn(async () => json({ data: { access_token: 'next-access', refresh_token: 'next-refresh', expires_in: 14400 } }));
    await expect(getShipAnyAccessToken({ env: ENV, tokenStore, transport, now: () => NOW })).resolves.toBe('next-access');
    expect(tokenStore.rotate).toHaveBeenCalledWith('stored-refresh', 'next-access', '2026-11-09T06:00:00.000Z', 'next-refresh');
  });

  it('fails without credentials instead of calling ShipAny', async () => {
    const transport = vi.fn();
    await expect(getShipAnyAccessToken({ env: {}, tokenStore: memoryTokenStore(null), transport, now: () => NOW }))
      .rejects.toThrow('SHIPANY_PICKUP_CREDENTIALS_UNCONFIGURED');
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('pickup point index', () => {
  const validTokens = { accessToken: 'stored-access', accessExpiresAt: '2026-11-09T05:00:00Z', refreshToken: 'stored-refresh' };

  function shipAnyTransport() {
    return vi.fn(async (url: string) => {
      if (url.endsWith('/v3/courier-service-point-locations')) {
        return json({
          data: {
            locations: [
              {
                courier_uid: 'fm-uid',
                courier_api_type: 'FamilyMart',
                url: 'https://locations.example.com/familymart.json',
                detail_location_types: { 'Family Mart': { enabled: true } },
              },
              {
                courier_uid: 'tcat-uid',
                courier_api_type: 'Yamato',
                url: 'https://locations.example.com/yamato.json',
                detail_location_types: { 'Yamato Store': { enabled: true }, '7-Eleven (Yamato)': { enabled: false } },
              },
            ],
          },
          meta: { request_id: 'req-1' },
        });
      }
      if (url.endsWith('familymart.json')) {
        return json([shipAnyStore()]);
      }
      return json([shipAnyStore({ code: '118040', name_cht: '中福營業所', detail_loc_typ: 'Yamato Store' })]);
    });
  }

  beforeEach(() => resetPickupPointCache());

  it('downloads each courier file once and caches the index', async () => {
    const transport = shipAnyTransport();
    const deps = { env: ENV, tokenStore: memoryTokenStore(validTokens), transport, now: () => NOW };
    const index = await loadPickupIndex(deps);
    expect([...index.keys()]).toEqual(['familymart']);
    await loadPickupIndex(deps);
    expect(transport).toHaveBeenCalledTimes(3);
    await expect(findShipAnyPickupPoint(deps, 'familymart', '002816')).resolves.toMatchObject({ name: '全家板橋板農店' });
    await expect(findShipAnyPickupPoint(deps, 'familymart', '999999')).resolves.toBeUndefined();
  });
});

describe('handlePickupPointSearch', () => {
  const cors = { 'Access-Control-Allow-Origin': 'https://lucissicare.com' };
  const validTokens = { accessToken: 'stored-access', accessExpiresAt: '2026-11-09T05:00:00Z', refreshToken: 'stored-refresh' };

  beforeEach(() => {
    resetMemoryDatabase();
    resetPickupPointCache();
  });

  it('is unavailable while the store pickup switch is off', async () => {
    const response = await handlePickupPointSearch(new Request('https://lucissicare.com/api/pickup-points?carrier=familymart&q=民生'), cors, null);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'STORE_PICKUP_DISABLED' });
  });

  it('turns on only for a Vercel preview deployment with the preview flag', async () => {
    await expect(isStorePickupEnabled({ VERCEL_ENV: 'preview', VITE_STORE_PICKUP_PREVIEW_ENABLED: 'true' })).resolves.toBe(true);
    await expect(isStorePickupEnabled({ VERCEL_ENV: 'production', VITE_STORE_PICKUP_PREVIEW_ENABLED: 'true' })).resolves.toBe(false);
    await expect(isStorePickupEnabled({ VERCEL_ENV: 'preview' })).resolves.toBe(false);
    await expect(isStorePickupEnabled({ VERCEL_ENV: 'preview', VITE_STORE_PICKUP_PREVIEW_ENABLED: 'false' })).resolves.toBe(false);
    await expect(isStorePickupEnabled({})).resolves.toBe(false);
    setMemorySiteSetting('store_pickup_enabled', true);
    await expect(isStorePickupEnabled({ VERCEL_ENV: 'production' })).resolves.toBe(true);
  });

  it('rejects an unknown chain or an empty keyword', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    for (const query of ['carrier=lawson&q=民生', 'carrier=familymart&q=', `carrier=familymart&q=${'長'.repeat(41)}`]) {
      const response = await handlePickupPointSearch(new Request(`https://lucissicare.com/api/pickup-points?${query}`), cors, null);
      expect(response.status).toBe(400);
    }
  });

  it('returns matching stores without courier internals', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    const transport = vi.fn(async (url: string) => url.endsWith('/v3/courier-service-point-locations')
      ? json({ data: { locations: [{ courier_uid: 'fm', courier_api_type: 'FamilyMart', url: 'https://locations.example.com/fm.json', detail_location_types: { 'Family Mart': { enabled: true } } }] } })
      : json([
        shipAnyStore(),
        shipAnyStore({ code: '005678', name_cht: '全家高雄中正店', addr: { lns_cht: ['高雄市苓雅區中正一路1號'], city: '高雄市', distr: '苓雅區' } }),
      ]));
    const deps = { env: ENV, tokenStore: memoryTokenStore(validTokens), transport, now: () => NOW };
    const response = await handlePickupPointSearch(new Request('https://lucissicare.com/api/pickup-points?carrier=familymart&q=' + encodeURIComponent('板橋 216巷')), cors, deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      points: [{ carrier: 'familymart', code: '002816', name: '全家板橋板農店', address: '新北市板橋區文化路一段216巷31號', city: '新北市', district: '板橋區' }],
    });
  });

  it('reports the store list as unavailable when ShipAny cannot be reached', async () => {
    setMemorySiteSetting('store_pickup_enabled', true);
    const deps = { env: ENV, tokenStore: memoryTokenStore(validTokens), transport: vi.fn(async () => json({}, 403)), now: () => NOW };
    const response = await handlePickupPointSearch(new Request('https://lucissicare.com/api/pickup-points?carrier=familymart&q=民生'), cors, deps);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'PICKUP_POINTS_UNAVAILABLE' });
  });
});

describe('encrypted token store', () => {
  it('round-trips tokens and never stores them in plain text', () => {
    const sealed = sealToken('client-key', 'secret-refresh');
    expect(sealed).not.toContain('secret-refresh');
    expect(sealed).not.toBe(sealToken('client-key', 'secret-refresh'));
    expect(openToken('client-key', sealed)).toBe('secret-refresh');
    expect(() => openToken('other-key', sealed)).toThrow('SHIPANY_PICKUP_TOKEN_STORE_UNREADABLE');
  });

  it('rotates using the exact ciphertext it read', async () => {
    let row: Record<string, unknown> | null = null;
    const db = {
      rpc: vi.fn(async (fn: string, args?: Record<string, unknown>) => {
        if (fn === 'get_shipany_api_tokens') return { data: row ? [row] : [], error: null };
        const previous = args?.p_previous_refresh;
        const allowed = previous === null ? row === null : row?.refresh_token === previous;
        if (allowed) row = { access_token: args?.p_access_token, access_expires_at: args?.p_access_expires_at, refresh_token: args?.p_refresh_token };
        return { data: allowed, error: null };
      }),
    };
    const store = supabaseTokenStore(db, 'client-key');
    await expect(store.read()).resolves.toBeNull();
    await expect(store.rotate(null, 'access-1', '2026-11-09T06:00:00.000Z', 'refresh-1')).resolves.toBe(true);
    expect(JSON.stringify(row)).not.toContain('refresh-1');
    await expect(store.read()).resolves.toEqual({ accessToken: 'access-1', accessExpiresAt: '2026-11-09T06:00:00.000Z', refreshToken: 'refresh-1' });
    await expect(store.rotate('refresh-1', 'access-2', '2026-11-09T10:00:00.000Z', 'refresh-2')).resolves.toBe(true);
    await expect(store.rotate('refresh-1', 'access-x', '2026-11-09T10:00:00.000Z', 'refresh-x')).resolves.toBe(false);
  });
});

describe('admin diagnosis', () => {
  const cors = { 'Access-Control-Allow-Origin': 'https://lucissicare.com' };
  const validTokens = { accessToken: 'stored-access', accessExpiresAt: '2026-11-09T05:00:00Z', refreshToken: 'stored-refresh' };

  beforeEach(() => {
    resetMemoryDatabase();
    resetPickupPointCache();
  });

  it('refuses anyone who is not an admin, even when the switch is off', async () => {
    const response = await handlePickupPointSearch(
      new Request('https://lucissicare.com/api/pickup-points?diagnose=1'), cors, null, async () => false,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('describes each store file for an admin without exposing tokens', async () => {
    const transport = vi.fn(async (url: string) => url.endsWith('/v3/courier-service-point-locations')
      ? json({ data: { locations: [{ courier_uid: 'fm', courier_api_type: 'FamilyMart', url: 'https://locations.example.com/fm.json', detail_location_types: { 'Family Mart': { enabled: true } } }] } })
      : json([shipAnyStore()]));
    const deps = { env: ENV, tokenStore: memoryTokenStore(validTokens), transport, now: () => NOW };
    const response = await handlePickupPointSearch(
      new Request('https://lucissicare.com/api/pickup-points?diagnose=1'), cors, deps, async () => true,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sources[0]).toMatchObject({
      courierApiType: 'FamilyMart',
      urlHost: 'locations.example.com',
      shape: 'array',
      topLevelKeys: [],
      recordCount: 1,
      typeValues: ['Family Mart'],
      normalizedByCarrier: { familymart: 1 },
    });
    expect(JSON.stringify(body)).not.toContain('stored-access');
  });
});
