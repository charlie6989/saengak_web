import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  carrierFromLocationType,
  findShipAnyPickupPoint,
  getShipAnyAccessToken,
  loadPickupIndex,
  normalizeLocationFile,
  resetPickupPointCache,
  type LocationSource,
  type TokenStore,
} from '../api/_lib/shipany-pickup-points.js';
import { handlePickupPointSearch } from '../api/_lib/pickup-points-handler.js';
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

const familySource: LocationSource = {
  courierUid: 'fm-uid',
  courierApiType: 'FamilyMart',
  url: 'https://locations.example.com/familymart.json',
  enabledTypes: ['FamilyMart'],
};

describe('carrierFromLocationType', () => {
  it('recognises the three convenience store chains', () => {
    expect(carrierFromLocationType('FamilyMart')).toBe('familymart');
    expect(carrierFromLocationType('全家便利店')).toBe('familymart');
    expect(carrierFromLocationType('7-ELEVEN')).toBe('seven-eleven');
    expect(carrierFromLocationType('seven_eleven')).toBe('seven-eleven');
    expect(carrierFromLocationType('Hi-Life')).toBe('hilife');
    expect(carrierFromLocationType('萊爾富便利店')).toBe('hilife');
    expect(carrierFromLocationType('黑貓營業所')).toBeUndefined();
  });
});

describe('normalizeLocationFile', () => {
  it('reads a plain array and assigns the only enabled chain', () => {
    const points = normalizeLocationFile(familySource, [
      { store_id: 'F001234', store_name: '全家台北民生店', address: '台北市松山區民生東路四段1號', city: '台北市', district: '松山區' },
      { store_id: 'bad code!', store_name: '格式錯誤', address: '某處' },
      { store_id: 'F009999', store_name: '', address: '缺名稱' },
    ]);
    expect(points).toEqual([
      {
        carrier: 'familymart',
        code: 'F001234',
        name: '全家台北民生店',
        address: '台北市松山區民生東路四段1號',
        city: '台北市',
        district: '松山區',
        courier: 'FamilyMart',
      },
    ]);
  });

  it('splits a multi-chain file by each store type and skips disabled chains and chilled-only stores', () => {
    const sfSource: LocationSource = { ...familySource, courierApiType: 'SfExpress', enabledTypes: ['7-ELEVEN', 'Hi-Life'] };
    const points = normalizeLocationFile(sfSource, {
      data: {
        locations: [
          { code: '123456', name: '7-11 民生門市', address: '台北市民生東路1號', type: '7-ELEVEN' },
          { code: 'H1234', name: '萊爾富民生店', address: '台北市民生東路2號', type: 'Hi-Life' },
          { code: 'F7777', name: '全家某店', address: '台北市某路', type: 'FamilyMart' },
          { code: '654321', name: '7-11 冷凍專門', address: '台北市某路3號', type: '7-ELEVEN', storage_types: ['Frozen'] },
        ],
      },
    });
    expect(points.map((point) => [point.carrier, point.code])).toEqual([
      ['seven-eleven', '123456'],
      ['hilife', 'H1234'],
    ]);
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
                detail_location_types: { FamilyMart: { enabled: true } },
              },
              {
                courier_uid: 'tcat-uid',
                courier_api_type: 'TCat',
                url: 'https://locations.example.com/tcat.json',
                detail_location_types: { 'TCat Office': { enabled: true }, '7-ELEVEN': { enabled: false } },
              },
            ],
          },
          meta: { request_id: 'req-1' },
        });
      }
      if (url.endsWith('familymart.json')) {
        return json([{ store_id: 'F001234', store_name: '全家台北民生店', address: '台北市松山區民生東路四段1號' }]);
      }
      return json([{ code: 'T1', name: '黑貓營業所', address: '台北市某路', type: 'TCat Office' }]);
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
    await expect(findShipAnyPickupPoint(deps, 'familymart', 'F001234')).resolves.toMatchObject({ name: '全家台北民生店' });
    await expect(findShipAnyPickupPoint(deps, 'familymart', 'F999999')).resolves.toBeUndefined();
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
      ? json({ data: { locations: [{ courier_uid: 'fm', courier_api_type: 'FamilyMart', url: 'https://locations.example.com/fm.json', detail_location_types: { FamilyMart: { enabled: true } } }] } })
      : json([
        { store_id: 'F001234', store_name: '全家台北民生店', address: '台北市松山區民生東路四段1號' },
        { store_id: 'F005678', store_name: '全家高雄中正店', address: '高雄市苓雅區中正一路1號' },
      ]));
    const deps = { env: ENV, tokenStore: memoryTokenStore(validTokens), transport, now: () => NOW };
    const response = await handlePickupPointSearch(new Request('https://lucissicare.com/api/pickup-points?carrier=familymart&q=民生'), cors, deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      points: [{ carrier: 'familymart', code: 'F001234', name: '全家台北民生店', address: '台北市松山區民生東路四段1號' }],
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
