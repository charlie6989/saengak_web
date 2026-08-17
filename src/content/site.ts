/**
 * SAENGAK 官方品牌資訊與全站常數設定
 */

export interface SiteConfig {
  brandName: string;
  brandEn: string;
  companyName: string;
  taxId: string;
  supportEmail: string;
  servicePhone: string;
  serviceHours: string;
  companyAddress: string;
  siteUrl: string;
}

export const BRAND_NAME = 'SAENGAK';
export const BRAND_EN = 'SAENGAK';
export const COMPANY_NAME = '拜悠衣品有限公司';
export const TAX_ID = '90014835';
export const SUPPORT_EMAIL = 'support@saengak.com.tw';
export const SERVICE_PHONE = '02-7700-0000';
export const SERVICE_HOURS = '週一至週五 9:30~18:00 (國定例假日除外)';
export const COMPANY_ADDRESS = '台北市信義區忠孝東路五段68號';
export const SITE_URL = 'https://saengak.com.tw';

export const siteConfig: SiteConfig = {
  brandName: BRAND_NAME,
  brandEn: BRAND_EN,
  companyName: COMPANY_NAME,
  taxId: TAX_ID,
  supportEmail: SUPPORT_EMAIL,
  servicePhone: SERVICE_PHONE,
  serviceHours: SERVICE_HOURS,
  companyAddress: COMPANY_ADDRESS,
  siteUrl: SITE_URL,
};
