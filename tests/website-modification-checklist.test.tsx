import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProductCard, {
  sanitizeProductTitle,
  extractSingleSentenceDescription,
} from '../src/components/feature/ProductCard';
import FacebookLoginButton from '../src/components/feature/FacebookLoginButton';

describe('SAENGAK 官網修改檢查清單單元測試', () => {
  describe('一、商品標題規範 (核心產品保留 Saengak 品牌 & 清洗前綴)', () => {
    it('核心產品應保留 Saengak 品牌名稱並標準化', () => {
      const title1 = sanitizeProductTitle('SAENGAK｜平衡調理私密潔淨慕斯');
      expect(title1).toBe('Saengak 平衡調理私密潔淨慕斯');

      const title2 = sanitizeProductTitle('SAENGAK｜深層修護私密清潔露');
      expect(title2).toBe('Saengak 深層修護私密清潔露');

      const title3 = sanitizeProductTitle('SAENGAK｜私密雙層修護精華噴霧');
      expect(title3).toBe('Saengak 私密雙層修護精華噴霧');

      const title4 = sanitizeProductTitle('SAENGAK｜益生菌私密養膚濕巾');
      expect(title4).toBe('Saengak 益生菌私密養膚濕巾');
    });

    it('應將拍賣長標題（如 26 字除毛刀）收斂為精煉標題', () => {
      const longTitle = '女性私密美體修整除毛刀 溫和安全防刮傷親膚款 個人專用';
      const clean = sanitizeProductTitle(longTitle);
      expect(clean.length).toBeLessThanOrEqual(12);
    });

    it('應過濾 LUCISSI 前綴、表情符號及現貨等字眼，且長度 ≤ 12 字', () => {
      const raw = '✨ LUCISSI｜性感蕾絲女三角內褲 女內衣褲 無痕透氣 現貨';
      const clean = sanitizeProductTitle(raw);
      expect(clean.length).toBeLessThanOrEqual(12);
      expect(clean).not.toContain('✨');
      expect(clean).not.toContain('LUCISSI');
      expect(clean).not.toContain('現貨');
    });

    it('任意超長字串亦保證截斷至 12 字以內', () => {
      const ultraLong = '這是一個長度超級長的商品名稱測試範例超過了十二個中文字元限制';
      const clean = sanitizeProductTitle(ultraLong);
      expect(clean.length).toBeLessThanOrEqual(12);
    });
  });

  describe('二、搜尋頁產品敘述精煉呈現 (無標點符號、無省略號、短一句話解決)', () => {
    it('應將核心產品描述精簡為無標點、無省略號之短句', () => {
      const product = {
        id: 'test-1',
        name: 'Saengak 私密雙層修護精華噴霧',
        price: 980,
        image: 'https://example.com/test.jpg',
        description:
          '結合精華油與草本植萃的雙層水油黃金配比，隨手一噴即時安撫私密部位乾燥與異味困擾。德國專利燕麥活性成分 Symcalmin® 深度舒緩修護……',
      };

      const sentence = extractSingleSentenceDescription(product);
      // 驗證無任何句點或逗號
      expect(sentence).not.toMatch(/[，。！？!?,;；、]/);
      // 驗證無省略號
      expect(sentence).not.toContain('...');
      expect(sentence).not.toContain('…');
      expect(sentence).toBe('雙層水油黃金配比 隨手安撫舒緩');
    });

    it('遇一般多句商品描述時應能自動切取並移除標點符號與省略號', () => {
      const product = {
        id: 'test-2',
        name: '日常純棉貼身著物',
        price: 390,
        image: 'https://example.com/test.jpg',
        description: '採用 100% 精梳有機純棉面料，觸感親膚透氣。立體剪裁服貼不緊繃……',
      };

      const sentence = extractSingleSentenceDescription(product);
      expect(sentence).not.toMatch(/[，。！？!?,;；、]/);
      expect(sentence).not.toContain('...');
      expect(sentence).not.toContain('…');
      expect(sentence.length).toBeLessThanOrEqual(16);
    });


    it('ProductCard 渲染輸出時標題與描述皆具備 line-clamp-1 單行排版規範', () => {
      const product = {
        id: 'test-3',
        name: 'SAENGAK｜平衡調理私密潔淨慕斯',
        price: 680,
        image: 'https://example.com/mousse.jpg',
        description: '第一句描述。第二句描述。第三句描述。',
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <ProductCard product={product} />
        </MemoryRouter>,
      );

      // 標題應顯示包含 Saengak 的標準品名，且排版具備限制保護
      expect(html).toContain('Saengak 平衡調理私密潔淨慕斯');
      expect(html).toContain('line-clamp-');
      expect(html).not.toContain('line-clamp-3');
    });

  });

  describe('四、4 大分類專屬橫幅與 About 橫幅資產檢查', () => {
    it('4 大分類（女性護理、每日清潔、深層修護、舒適穿著）專屬橫幅圖片檔案皆實體存在且大於 0 位元組', () => {
      const categories = [
        'feminine-care.jpg',
        'daily-cleansing.jpg',
        'intensive-repair.jpg',
        'comfort-wear.jpg',
      ];

      for (const filename of categories) {
        const filePath = path.resolve(process.cwd(), 'public/images/categories', filename);
        expect(fs.existsSync(filePath), `找不到分類橫幅: ${filename}`).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(10000); // 確保為真實高解析圖片
      }
    });

    it('About 頁面品牌形象橫幅 hero-bg.jpg 實體存在且為有效圖像', () => {
      const aboutHeroPath = path.resolve(process.cwd(), 'public/images/about/hero-bg.jpg');
      expect(fs.existsSync(aboutHeroPath)).toBe(true);
      const stats = fs.statSync(aboutHeroPath);
      expect(stats.size).toBeGreaterThan(10000);
    });

    it('4 大分類專屬橫幅不可重複共用同一圖檔', () => {
      const cat1 = fs.readFileSync(path.resolve(process.cwd(), 'public/images/categories/feminine-care.jpg'));
      const cat2 = fs.readFileSync(path.resolve(process.cwd(), 'public/images/categories/daily-cleansing.jpg'));
      const cat3 = fs.readFileSync(path.resolve(process.cwd(), 'public/images/categories/intensive-repair.jpg'));
      const cat4 = fs.readFileSync(path.resolve(process.cwd(), 'public/images/categories/comfort-wear.jpg'));

      // 驗證 4 張圖的 byte 長度互不相同，證明為獨立生成的不同專屬圖片
      const sizes = new Set([cat1.length, cat2.length, cat3.length, cat4.length]);
      expect(sizes.size).toBe(4);
    });
  });

  describe('五、商品詳情頁主圖 100% 完整呈現樣式檢驗 (防止圖片切邊 Bug)', () => {
    it('商品詳情頁原始碼中主圖與縮圖皆已替換為 object-contain 以確保上下完整呈現', () => {
      const productPageCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/product/page.tsx'),
        'utf8',
      );

      // 主圖區塊應包含 object-contain，且不再使用造成裁切的 object-cover
      expect(productPageCode).toContain('object-contain');
      // 確保 data-testid="product-main-image" 的圖片標籤使用的是 object-contain
      const mainImageRegex = /data-testid="product-main-image"[\s\S]*?className=\{`([^`]+)`\}/;
      const match = productPageCode.match(mainImageRegex);
      expect(match).not.toBeNull();
      const classNames = match![1];
      expect(classNames).toContain('object-contain');
      expect(classNames).not.toContain('object-cover');
    });
  });

  describe('六、Facebook 登入按鈕與帳號綁定元件檢驗', () => {
    it('FacebookLoginButton 能正常渲染各模式文案與 Meta 官方識別圖示', () => {
      const htmlSignIn = renderToStaticMarkup(<FacebookLoginButton text="signin_with" />);
      expect(htmlSignIn).toContain('使用 Facebook 帳號登入');
      expect(htmlSignIn).toContain('ri-facebook-circle-fill');

      const htmlSignUp = renderToStaticMarkup(<FacebookLoginButton text="signup_with" />);
      expect(htmlSignUp).toContain('使用 Facebook 帳號註冊');

      const htmlContinue = renderToStaticMarkup(<FacebookLoginButton text="continue_with" />);
      expect(htmlContinue).toContain('使用 Facebook 繼續');
    });

    it('註冊頁與登入頁皆包含 Facebook 快速登入/註冊入口', () => {
      const registerCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/register/page.tsx'),
        'utf8',
      );
      expect(registerCode).toContain('FacebookLoginButton');

      const loginCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/login/page.tsx'),
        'utf8',
      );
      expect(loginCode).toContain('FacebookLoginButton');
    });

    it('個人中心頁面已具備社群帳號綁定區塊與 linkIdentity 呼叫', () => {
      const profileCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/profile/page.tsx'),
        'utf8',
      );
      expect(profileCode).toContain('社群帳號綁定');
      expect(profileCode).toContain('linkIdentity');
      expect(profileCode).toContain("provider: 'facebook'");
    });
  });
});
