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
    console.log('=== Get Collections Function Started ===');
    
    const requestBody = await req.json().catch(() => ({}));
    const { collectionHandle, first = 20 } = requestBody;
    console.log('Request params:', { collectionHandle, first });
    
    // 獲取 Shopify 認證資訊
    const shopifyDomain = Deno.env.get('ShopifyDomain');
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken');
    
    console.log('Environment check:');
    console.log('ShopifyDomain:', shopifyDomain ? 'configured' : 'missing');
    console.log('StorefrontAccessToken:', storefrontAccessToken ? 'configured' : 'missing');
    
    if (!shopifyDomain || !storefrontAccessToken) {
      console.error('Missing Shopify credentials');
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Shopify credentials not configured',
          details: 'Missing ShopifyDomain or StorefrontAccessToken in environment variables',
          debug: {
            shopifyDomain: !!shopifyDomain,
            storefrontAccessToken: !!storefrontAccessToken
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    let query;
    let variables = {};
    
    if (collectionHandle) {
      // 獲取特定 collection 的產品
      query = `
        query GetCollectionProducts($handle: String!, $first: Int!) {
          collection(handle: $handle) {
            id
            title
            handle
            description
            image {
              url
              altText
            }
            products(first: $first) {
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
                        selectedOptions {
                          name
                          value
                        }
                        image {
                          id
                          url
                          altText
                          width
                          height
                        }
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
        }
      `;
      variables = { handle: collectionHandle, first };
    } else {
      // 獲取所有 collections
      query = `
        query GetCollections($first: Int!) {
          collections(first: $first) {
            edges {
              node {
                id
                title
                handle
                description
                image {
                  url
                  altText
                }
                products(first: 10) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      `;
      variables = { first };
    }
    
    console.log('Executing GraphQL query...');
    
    const shopifyUrl = `https://${shopifyDomain}/api/2024-01/graphql.json`;
    console.log('Shopify URL:', shopifyUrl);
    
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    
    console.log('Shopify API Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Shopify API error: ${response.status}`,
          details: errorText
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data = await response.json();
    console.log('Shopify response received');
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GraphQL errors',
          details: JSON.stringify(data.errors)
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    let result;
    
    if (collectionHandle) {
      // 返回特定 collection 的產品
      const collection = data.data?.collection;
      if (!collection) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Collection not found',
            products: []
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      const products = collection.products.edges.map((edge: any) => transformProduct(edge.node));
      
      result = {
        success: true,
        collection: {
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          description: collection.description,
          image: collection.image?.url || null,
          productsCount: collection.products.edges.length
        },
        products,
        total: products.length
      };
    } else {
      // 返回所有 collections
      const collections = data.data?.collections?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        description: edge.node.description,
        image: edge.node.image?.url || null,
        productsCount: edge.node.products?.edges?.length || 0
      })) || [];
      
      result = {
        success: true,
        collections,
        total: collections.length
      };
    }
    
    console.log('=== Get Collections Function Completed Successfully ===');
    
    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('=== Get Collections Function Error ===');
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      }),
      { 
        status: 200,
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
    updatedAt: product.updatedAt || '',
    images: images.map((edge: any) => ({
      id: edge.node.id,
      url: edge.node.url,
      altText: edge.node.altText,
      width: edge.node.width,
      height: edge.node.height
    })),
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
      selectedOptions: edge.node.selectedOptions || [],
      image: edge.node.image ? {
        id: edge.node.image.id,
        url: edge.node.image.url,
        altText: edge.node.image.altText,
        width: edge.node.image.width,
        height: edge.node.image.height
      } : null
    })),
  };
}