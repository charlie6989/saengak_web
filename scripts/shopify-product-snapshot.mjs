#!/usr/bin/env node
// 以公開 Storefront API 匯出所有公開商品的現況（品名、副標、SEO、類別、商品內容欄位、圖片、規格與庫存狀態），
// 寫到 docs/shopify/products-snapshot.json，方便日後比對 Shopify 後台被改了什麼。只讀取，不寫入 Shopify。
// 用法：node scripts/shopify-product-snapshot.mjs [輸出路徑]
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'docs/shopify/products-snapshot.json');

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_PUBLIC_SHOPIFY_STORE_DOMAIN || 'gh2xgs-zf.myshopify.com')
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '');
const token =
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.VITE_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  '9862bdf1a7178bd589dd83a130a3e24b';
// category 欄位需要 2025-01 以上的 Storefront API
const version = '2025-01';

const METAFIELDS = ['subtitle', 'highlights', 'size_chart', 'fit_guide', 'care_specs', 'care_instructions', 'lifestyle_showcase', 'craft_details'];

const query = `query Snapshot($cursor: String) {
  products(first: 50, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title productType vendor tags availableForSale totalInventory
      category { id name }
      seo { title description }
      metafields(identifiers: [${METAFIELDS.map((key) => `{namespace: "custom", key: "${key}"}`).join(', ')}]) { key value }
      images(first: 30) { nodes { url } }
      variants(first: 100) { nodes { title availableForSale price { amount } compareAtPrice { amount } } }
    }
  }
}`;

async function fetchPage(cursor) {
  const response = await fetch(`https://${domain}/api/${version}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
    body: JSON.stringify({ query, variables: { cursor } }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) throw new Error(`Storefront error ${response.status}: ${JSON.stringify(body.errors || body)}`);
  return body.data.products;
}

const parse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const products = [];
let cursor = null;
do {
  const page = await fetchPage(cursor);
  for (const node of page.nodes) {
    const meta = Object.fromEntries((node.metafields || []).filter(Boolean).map((m) => [m.key, parse(m.value)]));
    products.push({
      id: node.id.split('/').pop(),
      handle: node.handle,
      title: node.title,
      productType: node.productType,
      vendor: node.vendor,
      tags: node.tags,
      category: node.category ? { id: node.category.id.split('/').pop(), name: node.category.name } : null,
      seo: node.seo,
      availableForSale: node.availableForSale,
      totalInventory: node.totalInventory,
      metafields: meta,
      images: node.images.nodes.map((image) => image.url.split('?')[0]),
      variants: node.variants.nodes.map((v) => ({
        title: v.title,
        availableForSale: v.availableForSale,
        price: v.price?.amount,
        compareAtPrice: v.compareAtPrice?.amount ?? null,
      })),
    });
  }
  cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
} while (cursor);

const snapshot = { generatedAt: new Date().toISOString(), store: domain, apiVersion: version, count: products.length, products };
await writeFile(out, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`Wrote ${products.length} products to ${path.relative(root, out)}`);
