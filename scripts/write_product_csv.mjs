import fs from 'fs';
import path from 'path';

/**
 * 依照 shopify-universal-csv 規範生成標準 Shopify 商品 CSV
 */
export function generateShopifyCSV({
  outputPath,
  title,
  bodyHtml = '',
  variants = [],
  category = '舒適穿著',
  tags = ['舒適穿著', 'SAENGAK'],
  price = '',
  compareAtPrice = '',
  option1Name = '顏色',
  option2Name = '尺寸',
}) {
  // 1. 標題清洗與去識別化
  let cleanTitle = (title || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/(?:LUCISSI|medion)/gi, '')
    .replace(/(?:現貨|24小時出貨|全日適穿|視覺誘惑)/g, '')
    .replace(/[|_｜\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) cleanTitle = title.trim();

  // 2. 結構化 HTML 內文（對齊 shopify-universal-csv）
  if (!bodyHtml) {
    bodyHtml = `<p>${cleanTitle}，專為追求極致舒適與優雅日常的女性設計。精選高品質面料，質地細緻親膚，帶來全天候自在無負擔的穿著體驗。</p><h3>商品特色</h3><ul><li><strong>親膚透氣</strong>：優質親膚面料，柔軟細緻，吸濕排汗不悶熱。</li><li><strong>精緻工藝</strong>：立體剪裁與細膩車縫，服貼不勒肉，呈現自然優美身形。</li><li><strong>百搭實穿</strong>：簡約典雅色系，適合各種日常與居家場合搭配。</li></ul><h3>規格說明</h3><ul><li><strong>商品品類</strong>：${category}</li><li><strong>商品規格</strong>：請依規格選單挑選合適款式</li></ul><h3>洗滌與保養建議</h3><p>建議使用冷水搭配中性洗劑輕柔手洗，或裝入細網洗衣袋機洗；置於通風陰涼處自然晾乾。</p>`;
  }

  // 3. 變體列表
  if (!variants || variants.length === 0) {
    variants = [{ value: '預設規格', inventory: 0 }];
  }

  // 4. 生成 CSV 列
  const headers = [
    'Title',
    'Body (HTML)',
    'Vendor',
    'Product Category',
    'Type',
    'Tags',
    'Published',
    'Option1 Name',
    'Option1 Value',
    'Option2 Name',
    'Option2 Value',
    'Variant Inventory Qty',
    'Variant Inventory Policy',
    'Variant Price',
    'Variant Compare At Price',
    'Status',
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows = [headers.map(escapeCSV).join(',')];

  for (const v of variants) {
    const val = String(v.value || '');
    let opt1 = val;
    let opt2 = '';
    const match = val.match(/^(.+?)[,\/](.+)$/);
    if (match) {
      opt1 = match[1].trim();
      opt2 = match[2].trim();
    }

    const row = [
      cleanTitle,
      bodyHtml,
      'SAENGAK',
      category,
      category,
      Array.isArray(tags) ? tags.join(', ') : tags,
      'FALSE',
      option1Name,
      opt1,
      opt2 ? option2Name : '',
      opt2,
      v.inventory !== undefined ? String(v.inventory) : '0',
      'deny',
      price || '',
      compareAtPrice || '',
      'DRAFT',
    ];
    rows.push(row.map(escapeCSV).join(','));
  }

  const csvContent = rows.join('\n');
  const targetFile = outputPath.endsWith('.csv') ? outputPath : path.join(outputPath, 'shopify-new-product.csv');
  fs.writeFileSync(targetFile, csvContent, 'utf8');
  return targetFile;
}

// 支援命令列直接執行
if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1]?.endsWith('write_product_csv.mjs')) {
  const targetDir = process.argv[2];
  const title = process.argv[3];
  if (targetDir && title) {
    const file = generateShopifyCSV({ outputPath: targetDir, title });
    console.log(`✅ 已成功產出標準 CSV：${file}`);
  }
}
