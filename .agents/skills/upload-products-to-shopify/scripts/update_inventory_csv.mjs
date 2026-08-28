import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  const env = {};
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!env[key]) env[key] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const targetDir = 'product/LUCISSI｜細帶簡約純棉內褲_女生內褲_純棉內褲_女式內褲_含大尺碼_棉質內褲_包臀內褲_半包臀內褲_內褲女生_現貨_44108448638_images';

const csvContent = `Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option1 Linked To,Option2 Name,Option2 Value,Option2 Linked To,Option3 Name,Option3 Value,Option3 Linked To,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Unit Price Total Measure,Unit Price Total Measure Unit,Unit Price Base Measure,Unit Price Base Measure Unit,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Mother SKU (product.metafields.custom.mother_sku),Sync Hash (product.metafields.custom.sync_hash),LUCISSI Badge (product.metafields.lucissi.badge),LUCISSI Category Label (product.metafields.lucissi.category_label),LUCISSI Category Slug (product.metafields.lucissi.category_slug),LUCISSI Material (product.metafields.lucissi.material),LUCISSI Search Keywords (product.metafields.lucissi.search_keywords),LUCISSI Style (product.metafields.lucissi.style),配套商品 (product.metafields.shopify--discovery--product_recommendation.complementary_products),相關商品 (product.metafields.shopify--discovery--product_recommendation.related_products),相關商品設定 (product.metafields.shopify--discovery--product_recommendation.related_products_display),搜尋產品加強推廣 (product.metafields.shopify--discovery--product_search_boost.queries),Variant Image,Variant Weight Unit,Variant Tax Code,Cost per item,Status
slim-strap-cotton-briefs,細帶簡約純棉女款內褲 輕盈親膚雙層棉質底襠性感半包臀日常三角褲,"<p>細帶簡約純棉女款內褲，採用 95% 高品質天然純棉搭配 5% 彈性纖維，輔以 100% 雙層純棉抗菌底襠，給予私密肌最輕盈柔順的呵護。精緻細帶剪裁與半包臀立體版型，兼具簡約時尚與性感美型，輕盈透氣不卡襠，讓您隨時展現自信美。</p><h3>商品特色</h3><ul><li><strong>高質感純棉面料</strong>：95% 優質天然純棉，質地極致柔軟、吸濕排汗不悶熱。</li><li><strong>100% 純棉雙層底襠</strong>：溫柔貼合私密部位，保持乾爽與健康呵護。</li><li><strong>簡約細帶與半包臀剪裁</strong>：修飾臀部曲線，貼合無痕不勒肉，完美展現優雅性感。</li><li><strong>高彈力細緻車縫</strong>：嚴選彈性車縫線，久穿不變形、無勒痕。</li><li><strong>質感 5 色選</strong>：魅惑紫、夜幕黑、蜜桃粉、玫瑰豆沙、雲霧灰，優雅經典百搭。</li></ul><h3>規格說明</h3><ul><li><strong>商品材質</strong>：主面料 95% 棉 + 5% 彈性纖維；底襠 100% 棉</li><li><strong>商品版型</strong>：低腰細帶半包臀三角款</li><li><strong>商品顏色</strong>：魅惑紫 / 夜幕黑 / 蜜桃粉 / 玫瑰豆沙 / 雲霧灰</li><li><strong>商品尺寸</strong>：M (40-55kg) / L (55-65kg)（請參考尺寸建議）</li></ul><h3>洗滌與保養建議</h3><p>建議使用冷水配合中性洗劑手洗，或放入細網洗衣袋低速機洗；請勿使用漂白劑或高溫烘乾，置於陰涼通風處自然晾乾即可保持面料彈性與柔軟。</p>",SAENGAK,Apparel & Accessories > Clothing > Underwear & Socks > Underwear,女性內著,"女性內著, 純棉內褲, 抗菌內褲, 細帶內褲, 性感內褲, 半包臀, 透氣親膚, 舒適貼身, 棉質內褲, SAENGAK",FALSE,顏色,魅惑紫,,尺寸,M (40-55kg),,,,F-G-4178-PUR-M,50,shopify,7,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,魅惑紫,,尺寸,L (55-65kg),,,,F-G-4179-PUR-L,50,shopify,2,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,夜幕黑,,尺寸,M (40-55kg),,,,F-G-4180-BLA-M,50,shopify,29,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,夜幕黑,,尺寸,L (55-65kg),,,,F-G-4181-BLA-L,50,shopify,13,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,蜜桃粉,,尺寸,M (40-55kg),,,,F-G-4182-PIN-M,50,shopify,9,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,蜜桃粉,,尺寸,L (55-65kg),,,,F-G-4183-PIN-L,50,shopify,3,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,玫瑰豆沙,,尺寸,M (40-55kg),,,,F-G-4184-MAU-M,50,shopify,3,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,玫瑰豆沙,,尺寸,L (55-65kg),,,,F-G-4185-MAU-L,50,shopify,5,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,雲霧灰,,尺寸,M (40-55kg),,,,F-G-4186-HEA-M,50,shopify,11,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
slim-strap-cotton-briefs,,,,,,,,顏色,雲霧灰,,尺寸,L (55-65kg),,,,F-G-4187-HEA-L,50,shopify,7,deny,manual,89,109,TRUE,TRUE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,50,DRAFT
`;

fs.writeFileSync(path.join(targetDir, 'shopify-new-product.csv'), csvContent.trim(), 'utf8');
console.log('[OK] shopify-new-product.csv 庫存與顏色規格更新完成！');
