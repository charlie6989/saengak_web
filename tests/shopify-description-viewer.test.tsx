import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ShopifyDescriptionViewer from '../src/components/feature/ShopifyDescriptionViewer';

/**
 * 回歸測試：ShopifyDescriptionViewer 的「跨品類自適應卡」與「使用方式與保存注意事項」
 * 兩個區塊，對於「非服飾、非 SAENGAK 自有保養品」之第三方配件／工具（例如除毛刀、
 * 護衣袋、洗衣袋），必須套用萬用通用商品模板，絕不可落回保養品專屬的預設文案
 * （例如「專利益生菌發酵濾液」「韓國 (Made in Korea) 原裝進口」）。
 */

describe('ShopifyDescriptionViewer 跨品類自適應卡（萬用通用商品模板）', () => {
  it('SAENGAK 自有保養品類（無 careSpecs）維持既有保養規格卡預設文案', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="深層修護私密清潔露"
        category="女性護理"
      />
    );

    expect(html).toContain('護理規格與成分參數卡');
    expect(html).toContain('專利益生菌發酵濾液');
    expect(html).toContain('韓國 (Made in Korea) 原裝進口');
  });

  it('服飾／內著類商品維持既有版型與尺碼卡，不受本次修復影響', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="無痕生理褲"
        category="舒適穿著"
      />
    );

    expect(html).toContain('版型與著感指標');
    expect(html).toContain('實測尺碼對照指南');
    expect(html).not.toContain('商品規格卡 (Product Specifications)');
  });

  it('回歸測試：非服飾、非自有品牌的第三方配件（除毛刀，無 careSpecs）改用萬用通用商品模板，不再誤植保養品文案', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="專業美體除毛刀"
        category="生活配件"
      />
    );

    expect(html).toContain('商品規格卡 (Product Specifications)');
    expect(html).not.toContain('護理規格與成分參數卡');
    expect(html).not.toContain('專利益生菌發酵濾液');
    expect(html).not.toContain('韓國 (Made in Korea) 原裝進口');
    expect(html).not.toContain('水感凝露');
    // 使用方式與保存注意事項亦不得誤植保養品專屬說明
    expect(html).not.toContain('益生菌活性');
    expect(html).not.toContain('掌心起泡');
  });

  it('回歸測試：護衣袋（無 vendor、無 careSpecs）不得顯示 SAENGAK 或韓國原裝正品字樣', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="貼身衣物專用護衣袋"
        category="生活配件"
      />
    );

    expect(html).toContain('商品規格卡 (Product Specifications)');
    expect(html).not.toContain('>SAENGAK<');
    expect(html).not.toContain('韓國 (Made in Korea)');
    expect(html).toContain('精選生活選品');
  });

  it('第三方配件若有合法 vendor，商品規格卡正確顯示該 vendor 而非通用文案', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="專業美體除毛刀"
        category="生活配件"
        vendor="Philips"
      />
    );

    expect(html).toContain('商品規格卡 (Product Specifications)');
    expect(html).toContain('Philips');
    expect(html).not.toContain('精選生活選品');
  });

  it('第三方配件商品若商家有填寫 careSpecs，優先顯示商家實際資料而非通用預設文案', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="專業美體除毛刀"
        category="生活配件"
        careSpecs={{
          volume: '1 支裝',
          texture: 'ABS 塑膠機身',
          application: '四肢與腋下體毛',
          origin: '台灣',
          shelf_life: '保固 1 年',
        }}
      />
    );

    expect(html).toContain('1 支裝');
    expect(html).toContain('ABS 塑膠機身');
    expect(html).toContain('四肢與腋下體毛');
    expect(html).toContain('台灣');
    expect(html).toContain('保固 1 年');
    expect(html).not.toContain('請見商品標示');
  });
});
