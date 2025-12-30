import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// 搜索權重配置
const SEARCH_WEIGHTS = {
  EXACT_MATCH: 100,
  NAME_START: 80,
  NAME_CONTAINS: 60,
  TAG_EXACT: 70,
  TAG_CONTAINS: 40,
  DESCRIPTION: 30,
  CATEGORY: 50,
  BRAND: 45
};

// 同義詞映射
const SYNONYMS = {
  '女性': ['女士', '婦女', '女人'],
  '護理': ['保養', '照護', '呵護'],
  '清潔': ['清洗', '潔淨', '洗護'],
  '衛生': ['健康', '清潔'],
  '內褲': ['內衣褲', '底褲'],
  '生理': ['月經', '經期'],
  '敏感': ['溫和', '舒緩'],
  '抗菌': ['殺菌', '防菌', '抑菌']
};

// 分詞函數（簡化版）
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

// 擴展搜索詞（包含同義詞）
function expandQuery(query: string): string[] {
  const tokens = tokenize(query);
  const expandedTokens = new Set(tokens);
  
  tokens.forEach(token => {
    Object.entries(SYNONYMS).forEach(([key, synonyms]) => {
      if (key.includes(token) || synonyms.some(syn => syn.includes(token))) {
        expandedTokens.add(key);
        synonyms.forEach(syn => expandedTokens.add(syn));
      }
    });
  });
  
  return Array.from(expandedTokens);
}

// 計算文本相似度
function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// 計算產品相關性分數
function calculateRelevanceScore(product: any, query: string, expandedQuery: string[]): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const productName = product.title?.toLowerCase() || '';
  const productDesc = product.description?.toLowerCase() || '';
  const productTags = product.tags || [];
  
  // 1. 精確匹配
  if (productName === queryLower) {
    score += SEARCH_WEIGHTS.EXACT_MATCH;
  }
  
  // 2. 名稱開頭匹配
  else if (productName.startsWith(queryLower)) {
    score += SEARCH_WEIGHTS.NAME_START;
  }
  
  // 3. 名稱包含匹配
  else if (productName.includes(queryLower)) {
    score += SEARCH_WEIGHTS.NAME_CONTAINS;
  }
  
  // 4. 標籤匹配
  productTags.forEach((tag: string) => {
    const tagLower = tag.toLowerCase();
    if (tagLower === queryLower) {
      score += SEARCH_WEIGHTS.TAG_EXACT;
    } else if (tagLower.includes(queryLower)) {
      score += SEARCH_WEIGHTS.TAG_CONTAINS;
    }
  });
  
  // 5. 描述匹配
  if (productDesc.includes(queryLower)) {
    score += SEARCH_WEIGHTS.DESCRIPTION;
  }
  
  // 6. 擴展詞匹配
  expandedQuery.forEach(expandedTerm => {
    if (expandedTerm !== queryLower) {
      if (productName.includes(expandedTerm)) {
        score += SEARCH_WEIGHTS.NAME_CONTAINS * 0.7; // 同義詞權重稍低
      }
      if (productDesc.includes(expandedTerm)) {
        score += SEARCH_WEIGHTS.DESCRIPTION * 0.7;
      }
    }
  });
  
  // 7. 文本相似度加分
  const nameSimilarity = calculateSimilarity(productName, queryLower);
  const descSimilarity = calculateSimilarity(productDesc, queryLower);
  score += (nameSimilarity * 20) + (descSimilarity * 10);
  
  return score;
}

// 獲取Shopify產品
async function fetchShopifyProducts(productIds?: string[]) {
  const shopifyDomain = Deno.env.get('ShopifyDomain') || 'ekfvih-rz.myshopify.com';
  const storefrontAccessToken = Deno.env.get('StorefrontAccessToken') || '1707057fb57281cd5b3956de51a8c896';
  
  // 如果沒有指定產品ID，獲取所有產品
  const query = productIds && productIds.length > 0 
    ? buildSpecificProductsQuery(productIds)
    : buildAllProductsQuery();
  
  const response = await fetch(`https://${shopifyDomain}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
    },
    body: JSON.stringify({ query }),
  });
  
  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }
  
  return await response.json();
}

function buildAllProductsQuery() {
  return `
    query GetAllProducts {
      products(first: 50) {
        edges {
          node {
            id
            title
            description
            descriptionHtml
            handle
            tags
            productType
            vendor
            createdAt
            updatedAt
            images(first: 5) {
              edges {
                node {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                  availableForSale
                  quantityAvailable
                }
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;
}

function buildSpecificProductsQuery(productIds: string[]) {
  const cleanIds = productIds.map(id => 
    id.startsWith('gid://shopify/Product/') ? id : `gid://shopify/Product/${id}`
  );
  
  const productQueries = cleanIds.map((id, index) => `
    product${index}: product(id: "${id}") {
      id
      title
      description
      descriptionHtml
      handle
      tags
      productType
      vendor
      createdAt
      updatedAt
      images(first: 5) {
        edges {
          node {
            id
            url
            altText
            width
            height
          }
        }
      }
      variants(first: 5) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
            availableForSale
            quantityAvailable
          }
        }
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
    }
  `).join('\n');
  
  return `query GetProducts { ${productQueries} }`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { query, filters, sortBy, productIds } = await req.json();
    
    // 獲取產品數據
    const shopifyData = await fetchShopifyProducts(productIds);
    
    let products = [];
    
    // 處理產品數據
    if (productIds && productIds.length > 0) {
      // 特定產品查詢
      for (let i = 0; i < productIds.length; i++) {
        const product = shopifyData.data?.[`product${i}`];
        if (product) products.push(product);
      }
    } else {
      // 所有產品查詢
      products = shopifyData.data?.products?.edges?.map((edge: any) => edge.node) || [];
    }
    
    // 搜索和篩選
    let filteredProducts = products;
    
    if (query && query.trim()) {
      const expandedQuery = expandQuery(query.trim());
      
      // 計算每個產品的相關性分數
      const productsWithScore = products.map(product => ({
        ...product,
        relevanceScore: calculateRelevanceScore(product, query.trim(), expandedQuery)
      }));
      
      // 過濾出有相關性的產品（分數 > 0）
      filteredProducts = productsWithScore
        .filter(product => product.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    // 應用其他篩選條件
    if (filters) {
      if (filters.category && filters.category.length > 0) {
        filteredProducts = filteredProducts.filter(product =>
          filters.category.some((cat: string) =>
            product.productType?.toLowerCase().includes(cat.toLowerCase()) ||
            product.title?.toLowerCase().includes(cat.toLowerCase()) ||
            product.tags?.some((tag: string) => tag.toLowerCase().includes(cat.toLowerCase()))
          )
        );
      }
      
      if (filters.priceRange) {
        const [minPrice, maxPrice] = filters.priceRange;
        filteredProducts = filteredProducts.filter(product => {
          const price = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
          return price >= minPrice && price <= maxPrice;
        });
      }
    }
    
    // 排序
    if (sortBy && sortBy !== '相關性') {
      filteredProducts.sort((a, b) => {
        switch (sortBy) {
          case '價格低到高':
            return parseFloat(a.priceRange?.minVariantPrice?.amount || '0') - 
                   parseFloat(b.priceRange?.minVariantPrice?.amount || '0');
          case '價格高到低':
            return parseFloat(b.priceRange?.minVariantPrice?.amount || '0') - 
                   parseFloat(a.priceRange?.minVariantPrice?.amount || '0');
          case '最新上架':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          default:
            return 0;
        }
      });
    }
    
    // 轉換為前端格式
    const transformedProducts = filteredProducts.map(product => {
      const images = product.images?.edges || [];
      const mainImage = images[0]?.node?.url || '';
      const hoverImage = images[1]?.node?.url || mainImage;
      const minPrice = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
      
      return {
        id: product.id,
        name: product.title || '',
        description: product.description || '',
        descriptionHtml: product.descriptionHtml || '',
        handle: product.handle || '',
        price: minPrice,
        image: mainImage,
        hoverImage: hoverImage,
        tags: product.tags || [],
        productType: product.productType || '',
        vendor: product.vendor || '',
        createdAt: product.createdAt || '',
        relevanceScore: product.relevanceScore || 0,
        variants: (product.variants?.edges || []).map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          price: {
            amount: parseFloat(edge.node.price.amount),
            currencyCode: edge.node.price.currencyCode,
          },
          compareAtPrice: edge.node.compareAtPrice ? {
            amount: parseFloat(edge.node.compareAtPrice.amount),
            currencyCode: edge.node.compareAtPrice.currencyCode,
          } : null,
          availableForSale: edge.node.availableForSale,
          quantityAvailable: edge.node.quantityAvailable,
        })),
      };
    });
    
    return new Response(
      JSON.stringify({
        products: transformedProducts,
        total: transformedProducts.length,
        query: query || '',
        success: true,
        searchMetadata: {
          expandedQuery: query ? expandQuery(query.trim()) : [],
          appliedFilters: filters || {},
          sortBy: sortBy || '相關性'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Smart search error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        details: error.message,
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});