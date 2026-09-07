import { describe, it, expect } from 'vitest';
import {
  TAIWAN_CITIES,
  getTaiwanCities,
  getTaiwanDistricts,
  getTaiwanZipCode,
  formatTaiwanAddress,
  parseTaiwanAddress,
  toShopifyMailingAddress,
} from './taiwanDistricts';

describe('taiwanDistricts (台灣行政區與 Shopify 地址轉換模組)', () => {
  describe('基礎查詢功能', () => {
    it('應包含全台 22 縣市', () => {
      const cities = getTaiwanCities();
      expect(cities.length).toBe(22);
      expect(cities).toContain('台北市');
      expect(cities).toContain('新北市');
      expect(cities).toContain('台中市');
      expect(cities).toContain('高雄市');
      expect(cities).toContain('花蓮縣');
      expect(cities).toContain('金門縣');
    });

    it('應正確取得指定縣市的行政區與郵遞區號', () => {
      const daanDistricts = getTaiwanDistricts('台北市');
      expect(daanDistricts.length).toBeGreaterThan(0);
      const daan = daanDistricts.find((d) => d.name === '大安區');
      expect(daan).toBeDefined();
      expect(daan?.zip).toBe('106');
    });

    it('支援台/臺字體相容比對', () => {
      const taipei1 = getTaiwanDistricts('台北市');
      const taipei2 = getTaiwanDistricts('臺北市');
      expect(taipei1).toEqual(taipei2);
    });

    it('應正確反查指定縣市與行政區之郵遞區號', () => {
      expect(getTaiwanZipCode('台北市', '大安區')).toBe('106');
      expect(getTaiwanZipCode('新北市', '板橋區')).toBe('220');
      expect(getTaiwanZipCode('台中市', '西屯區')).toBe('407');
      expect(getTaiwanZipCode('高雄市', '左營區')).toBe('813');
      expect(getTaiwanZipCode('未知縣市', '未知區')).toBe('');
    });
  });

  describe('formatTaiwanAddress (地址格式化)', () => {
    it('應正確組裝含有郵遞區號的標準台灣地址字串', () => {
      const formatted = formatTaiwanAddress({
        city: '台北市',
        district: '大安區',
        street: '忠孝東路四段100號5樓',
      });
      expect(formatted).toBe('106 台北市大安區忠孝東路四段100號5樓');
    });

    it('若有自訂 zip 應優先使用', () => {
      const formatted = formatTaiwanAddress({
        city: '新北市',
        district: '板橋區',
        zip: '220',
        street: '縣民大道二段7號',
      });
      expect(formatted).toBe('220 新北市板橋區縣民大道二段7號');
    });

    it('全為空時應回傳空字串', () => {
      expect(formatTaiwanAddress({})).toBe('');
    });
  });

  describe('parseTaiwanAddress (地址智慧逆向解析)', () => {
    it('應能解析標準前導 3 碼郵遞區號地址', () => {
      const parsed = parseTaiwanAddress('106 台北市大安區忠孝東路四段100號');
      expect(parsed.city).toBe('台北市');
      expect(parsed.district).toBe('大安區');
      expect(parsed.zip).toBe('106');
      expect(parsed.street).toBe('忠孝東路四段100號');
    });

    it('應能解析無郵遞區號之標準地址', () => {
      const parsed = parseTaiwanAddress('高雄市左營區博愛二路777號');
      expect(parsed.city).toBe('高雄市');
      expect(parsed.district).toBe('左營區');
      expect(parsed.zip).toBe('813');
      expect(parsed.street).toBe('博愛二路777號');
    });

    it('應支援「臺北市」自動正規化為「台北市」', () => {
      const parsed = parseTaiwanAddress('臺北市信義區市府路1號');
      expect(parsed.city).toBe('台北市');
      expect(parsed.district).toBe('信義區');
      expect(parsed.zip).toBe('110');
      expect(parsed.street).toBe('市府路1號');
    });

    it('若無縣市只有行政區，應能模糊匹配出所屬縣市與郵遞區號', () => {
      const parsed = parseTaiwanAddress('板橋區文化路一段100號');
      expect(parsed.city).toBe('新北市');
      expect(parsed.district).toBe('板橋區');
      expect(parsed.zip).toBe('220');
      expect(parsed.street).toBe('文化路一段100號');
    });

    it('無效輸入應安全回傳空結構', () => {
      expect(parseTaiwanAddress('')).toEqual({ city: '', district: '', zip: '', street: '' });
      expect(parseTaiwanAddress(null as any)).toEqual({ city: '', district: '', zip: '', street: '' });
    });
  });

  describe('toShopifyMailingAddress (對齊 Shopify 官方結帳規格)', () => {
    it('應正確映射為 Shopify MailingAddress 結構', () => {
      const shopifyAddr = toShopifyMailingAddress(
        {
          city: '台北市',
          district: '大安區',
          zip: '106',
          street: '忠孝東路四段100號5樓',
        },
        {
          name: '王小明',
          phone: '0912345678',
        },
      );

      expect(shopifyAddr.countryCode).toBe('TW');
      expect(shopifyAddr.country).toBe('Taiwan');
      expect(shopifyAddr.province).toBe('台北市');
      expect(shopifyAddr.city).toBe('大安區');
      expect(shopifyAddr.zip).toBe('106');
      expect(shopifyAddr.address1).toBe('忠孝東路四段100號5樓');
      expect(shopifyAddr.lastName).toBe('王');
      expect(shopifyAddr.firstName).toBe('小明');
      expect(shopifyAddr.phone).toBe('+886912345678');
    });

    it('應能正確處理英文姓名與無電話情況', () => {
      const shopifyAddr = toShopifyMailingAddress(
        {
          city: '台中市',
          district: '西屯區',
          zip: '407',
          street: '台灣大道三段99號',
        },
        {
          name: 'John Doe',
        },
      );

      expect(shopifyAddr.firstName).toBe('John');
      expect(shopifyAddr.lastName).toBe('Doe');
      expect(shopifyAddr.phone).toBeUndefined();
    });
  });
});
