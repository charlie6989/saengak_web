import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ShopifyDescriptionViewer from '../src/components/feature/ShopifyDescriptionViewer';
import { normalizeSizeChart } from '../src/domain/sizeChart';

/**
 * 回歸測試：ShopifyDescriptionViewer 只能呈現 Shopify 實際填寫的商品資料。
 * 成分、產地、檢驗、品牌授權等宣稱在缺資料時一律不顯示，不得依品類補上預設文案
 * （例如「專利益生菌發酵濾液」「韓國 (Made in Korea) 原裝進口」「Dermatest」）。
 */

const FABRICATED_CLAIMS = [
  '專利益生菌發酵濾液',
  'Made in Korea',
  'Dermatest',
  '韓國總部授權',
  '原廠合格出廠檢驗',
  '嚴選優良工廠製造',
  '精選生活選品',
  '通過國際權威機構',
  'unsplash',
];

describe('ShopifyDescriptionViewer 跨品類自適應卡（萬用通用商品模板）', () => {
  it('SAENGAK 保養品沒有 careSpecs 時，不顯示預設成分、產地或檢驗宣稱', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="深層修護私密清潔露"
        category="女性護理"
      />
    );

    expect(html).not.toContain('護理規格與成分參數卡');
    for (const claim of FABRICATED_CLAIMS) expect(html).not.toContain(claim);
    expect(html).toContain('請見商品包裝標示');
    expect(html).toContain('>SAENGAK<');
  });

  it('SAENGAK 保養品有 careSpecs 時，只列出實際填寫的欄位', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="深層修護私密清潔露"
        category="女性護理"
        careSpecs={{ volume: '150ml', origin: '韓國' }}
      />
    );

    expect(html).toContain('護理規格與成分參數卡');
    expect(html).toContain('150ml');
    expect(html).toContain('韓國');
    expect(html).not.toContain('主要成分');
    expect(html).not.toContain('保存期限');
  });

  it('非 SAENGAK 的內著商品不得出現 SAENGAK 品牌敘事或品牌保證', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="涼感冰絲無痕內褲"
        category="舒適穿著"
      />
    );

    expect(html).not.toContain('SAENGAK');
    expect(html).not.toContain('Brand Philosophy');
    expect(html).toContain('LUCISSI CARE 購物保障');
    for (const claim of FABRICATED_CLAIMS) expect(html).not.toContain(claim);
  });

  it('其他品牌的保養品（MEDION）保留成分規格卡與品牌名稱，但不掛 SAENGAK 品牌故事', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="MEDION 乳酸菌私密保濕凝膠"
        category="女性護理"
        vendor="MEDION"
        careSpecs={{ volume: '單支 1.8 g（原廠盒裝 20 支）', origin: '韓國' }}
      />
    );

    expect(html).toContain('護理規格與成分參數卡');
    expect(html).toContain('MEDION');
    expect(html).not.toContain('Brand Philosophy');
    expect(html).not.toContain('SAENGAK');
  });

  it('SAENGAK 保養品仍顯示 SAENGAK 品牌故事', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer productName="Saengak 平衡調理私密潔淨慕斯" category="女性護理" vendor="SAENGAK" />
    );

    expect(html).toContain('Brand Philosophy');
  });

  it('服飾／內著類商品沒有填寫版型與尺碼資料時，不顯示預設數值', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="無痕生理褲"
        category="舒適穿著"
      />
    );

    expect(html).not.toContain('版型與著感指標');
    expect(html).not.toContain('實測尺碼對照指南');
    expect(html).not.toContain('Musinsa');
    expect(html).not.toContain('商品規格卡 (Product Specifications)');
  });

  it('回歸測試：非服飾、非自有品牌的第三方配件（除毛刀，無 careSpecs）改用萬用通用商品模板，不再誤植保養品文案', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="專業美體除毛刀"
        category="生活配件"
      />
    );

    expect(html).not.toContain('商品規格卡 (Product Specifications)');
    expect(html).not.toContain('護理規格與成分參數卡');
    expect(html).not.toContain('專利益生菌發酵濾液');
    expect(html).not.toContain('韓國 (Made in Korea) 原裝進口');
    expect(html).not.toContain('水感凝露');
    // 使用方式與保存注意事項亦不得誤植保養品專屬說明
    expect(html).not.toContain('益生菌活性');
    expect(html).not.toContain('掌心起泡');
  });

  it('回歸測試：護衣袋（無 vendor、無 careSpecs）不得顯示 SAENGAK、韓國原裝或模糊品牌字樣', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="貼身衣物專用護衣袋"
        category="生活配件"
      />
    );

    expect(html).not.toContain('>SAENGAK<');
    expect(html).not.toContain('韓國 (Made in Korea)');
    // 沒有合法 vendor 時不顯示品牌欄，也不用「精選生活選品」這類模糊替代字
    expect(html).not.toContain('精選生活選品');
    expect(html).not.toContain('>品牌<');
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

  it('服飾商品傳入自訂 fitGuide 與 sizeChart 時，正確動態渲染指標與尺碼數值', () => {
    const html = renderToString(
      <ShopifyDescriptionViewer
        productName="無痕生理褲"
        category="舒適穿著"
        fitGuide={{
          fit: '寬鬆',
          thickness: '輕薄',
          elasticity: '微彈',
          breathability: '良好',
        }}
        sizeChart={normalizeSizeChart([
          { size: '2XL (110)', waist: '84 - 90', hips: '106 - 112', crotch: '25.5', weight: '75 ~ 85 kg' },
        ])}
      />
    );

    // 驗證自訂 fitGuide 正確啟用與渲染
    expect(html).toContain('寬鬆 (Loose Fit)');
    expect(html).toContain('輕薄 (Light)');
    expect(html).toContain('微彈 (Slight)');
    expect(html).toContain('良好 (Good)');

    // 驗證自訂 sizeChart 列正確呈現
    expect(html).toContain('2XL (110)');
    expect(html).toContain('84 - 90');
    expect(html).toContain('106 - 112');
    expect(html).toContain('25.5');
    expect(html).toContain('75 ~ 85 kg');
  });
});



describe('商品內容的功能、細節與情境順序', () => {
  it('保留每一段實際功能並置於部位細節及使用情境之前', () => {
    const features = Array.from({ length: 6 }, (_, i) => ({
      kind: 'feature' as const, badge: `特色 ${i + 1}`, title: `功能段落 ${i + 1}`,
      description: `已核實功能 ${i + 1}`, image: `https://example.com/feature-${i}.jpg`,
    }));
    const html = renderToString(<ShopifyDescriptionViewer
      productName="Saengak 平衡調理私密潔淨慕斯" vendor="SAENGAK"
      lifestyleShowcase={[{ badge: '情境', title: '沐浴清潔', description: '沖洗乾淨', image: 'https://example.com/usage.jpg' }, ...features]}
      craftDetails={[{ category: '瓶口', title: '按壓部位', description: '取用泡沫', image: 'https://example.com/detail.jpg' }]}
    />);
    expect(html).toContain('功能段落 6');
    expect(html.indexOf('>功能段落 6</h4>')).toBeLessThan(html.indexOf('>按壓部位</h4>'));
    expect(html.indexOf('>按壓部位</h4>')).toBeLessThan(html.indexOf('>沐浴清潔</h4>'));
    expect(html.indexOf('>沐浴清潔</h4>')).toBeLessThan(html.indexOf('Brand Philosophy'));
    expect(html).toContain('質地與使用細節');
    expect(html).not.toContain('工藝細節與特點解析');
  });

  it.each([
    ['蕾絲內褲', '版型與穿著細節'],
    ['清洗護衣袋', '設計與操作細節'],
    ['絨面收納包', '設計與操作細節'],
    ['六格內衣分隔收納盒', '設計與操作細節'],
    ['雙頭電動剃毛器', '設計與操作細節'],
    ['MEDION 私密保濕凝膠', '質地與使用細節'],
  ])('%s 使用適合商品的細節標題，描述圖不冒充問答', (name, label) => {
    const html = renderToString(<ShopifyDescriptionViewer productName={name}
      vendor={name.startsWith('MEDION') ? 'MEDION' : ''}
      craftDetails={[{ category: '', title: '實際部位', description: '依實品', image: 'https://example.com/detail.jpg' }]}
      descriptionImages={[{ src: 'https://example.com/original.jpg', alt: '原商品說明圖' }]}
    />);
    expect(html).toContain(label);
    if (label === '設計與操作細節') expect(html).not.toContain('Brand Philosophy');
    expect(html).toContain('商品詳細圖文');
    expect(html).not.toContain('Q&amp;A');
    expect(html).not.toContain('常見問答與詳細圖文說明');
  });

  it('未填功能或情境欄位時不憑空補段落', () => {
    const html = renderToString(<ShopifyDescriptionViewer productName="收納包" />);
    expect(html).not.toContain('data-testid="product-features"');
    expect(html).not.toContain('data-testid="product-usage"');
  });
});
