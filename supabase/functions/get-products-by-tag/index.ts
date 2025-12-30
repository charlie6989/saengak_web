import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { tags, first = 20, sortKey = 'CREATED_AT', reverse = true } = await req.json();
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error('Tags parameter is required and must be a non-empty array');
    }
    
    // 使用與 get-products 相同的預設認證資訊
    const shopifyDomain = Deno.env.get('ShopifyDomain') || 'ekfvih-rz.myshopify.com';
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken') || '1707057fb57281cd5b3956de51a8c896';
    
    console.log('Shopify Domain:', shopifyDomain);
    console.log('Access Token available:', !!storefrontAccessToken);
    
    // 構建標籤查詢字符串 - 修復語法
    const tagQuery = tags.map(tag => `tag:${tag}`).join(' OR ');
    
    const query = `
      query GetProductsByTag($query: String!, $first: Int!, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
        products(query: $query, first: $first, sortKey: $sortKey, reverse: $reverse) {
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
    
    const variables = {
      query: tagQuery,
      first,
      sortKey,
      reverse
    };
    
    console.log('Executing GraphQL query:', query);
    console.log('Variables:', variables);
    
    const response = await fetch(`https://${shopifyDomain}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Shopify response:', JSON.stringify(data, null, 2));
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    const products = data.data?.products?.edges?.map((edge: any) => transformProduct(edge.node)) || [];
    
    // 按標籤分組產品
    const productsByTag: { [key: string]: any[] } = {};
    tags.forEach(tag => {
      productsByTag[tag] = products.filter(product => 
        product.tags.some((productTag: string) => 
          productTag.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(productTag.toLowerCase())
        )
      );
    });
    
    console.log(`Found ${products.length} products for tags:`, tags);
    
    return new Response(
      JSON.stringify({
        success: true,
        products,
        productsByTag,
        searchTags: tags,
        total: products.length,
        metadata: {
          sortKey,
          reverse,
          first,
          query: tagQuery
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get products by tag error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch products by tag',
        details: error.message,
        products: [],
        productsByTag: {}
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function transformProduct(product: any) {
  const images = product.images?.edges || [];
  const mainImage = images[0]?.node?.url || '';
  const hoverImage = images[1]?.node?.url || mainImage;
  const minPrice = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
  const variants = product.variants?.edges || [];
  const firstVariant = variants[0]?.node;
  const compareAtPrice = firstVariant?.compareAtPrice ? parseFloat(firstVariant.compareAtPrice.amount) : null;
  
  return {
    id: product.id,
    name: product.title || '',
    title: product.title || '',
    description: product.description || '',
    descriptionHtml: product.descriptionHtml || '',
    handle: product.handle || '',
    price: minPrice,
    originalPrice: compareAtPrice,
    image: mainImage,
    hoverImage: hoverImage,
    tags: product.tags || [],
    productType: product.productType || '',
    vendor: product.vendor || '',
    createdAt: product.createdAt || '',
    variants: variants.map((edge: any) => ({
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
}