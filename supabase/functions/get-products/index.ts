import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Starting get-products function ===')
    console.log('Request method:', req.method)
    console.log('Request URL:', req.url)
    
    // Get Shopify credentials from environment
    const shopifyDomain = Deno.env.get('ShopifyDomain') || 'ekfvih-rz.myshopify.com'
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken') || '1707057fb57281cd5b3956de51a8c896'
    
    console.log('Shopify Domain:', shopifyDomain)
    console.log('Access Token available:', !!storefrontAccessToken)

    // Parse request body
    let requestBody
    try {
      const bodyText = await req.text()
      console.log('Raw request body:', bodyText)
      
      if (!bodyText.trim()) {
        console.log('Empty request body, using default product IDs')
        requestBody = {
          productIds: [
            'gid://shopify/Product/9969008509232',
            'gid://shopify/Product/9969008542000',
            'gid://shopify/Product/9969008574768',
            'gid://shopify/Product/9969008607536',
            'gid://shopify/Product/9969008673072',
            'gid://shopify/Product/9975451189552'
          ]
        }
      } else {
        requestBody = JSON.parse(bodyText)
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError.message,
          success: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { productIds } = requestBody
    console.log('Requested product IDs:', productIds)
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      console.error('Invalid or missing product IDs')
      return new Response(
        JSON.stringify({ 
          error: 'Product IDs are required and must be an array',
          success: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Clean product IDs - remove gid prefix if present
    const cleanProductIds = productIds.map(id => {
      if (typeof id === 'string' && id.startsWith('gid://shopify/Product/')) {
        return id.replace('gid://shopify/Product/', '')
      }
      return id
    })
    
    console.log('Clean product IDs:', cleanProductIds)

    // Build GraphQL query for multiple products
    const productQueries = cleanProductIds.map((id, index) => `
      product${index}: product(id: "gid://shopify/Product/${id}") {
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
        images(first: 10) {
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
        variants(first: 10) {
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
        compareAtPriceRange {
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
    `).join('\n')

    const query = `
      query GetProducts {
        ${productQueries}
      }
    `

    console.log('GraphQL Query built successfully')

    // Make request to Shopify Storefront API with timeout
    const shopifyUrl = `https://${shopifyDomain}/api/2024-01/graphql.json`
    console.log('Making request to:', shopifyUrl)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const shopifyResponse = await fetch(shopifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
          'User-Agent': 'Supabase Edge Function',
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log('Shopify API Response Status:', shopifyResponse.status)
      
      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text()
        console.error('Shopify API Error Response:', errorText)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch from Shopify API',
            status: shopifyResponse.status,
            statusText: shopifyResponse.statusText,
            details: errorText,
            shopifyDomain,
            hasToken: !!storefrontAccessToken,
            success: false
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const shopifyData = await shopifyResponse.json()
      console.log('Shopify API Response received, processing...')

      if (shopifyData.errors) {
        console.error('GraphQL Errors:', shopifyData.errors)
        return new Response(
          JSON.stringify({ 
            error: 'GraphQL errors from Shopify',
            details: shopifyData.errors,
            success: false
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Transform the data to match frontend expectations
      const transformedProducts = []
      
      for (let i = 0; i < cleanProductIds.length; i++) {
        const product = shopifyData.data?.[`product${i}`]
        
        if (product && product.id) {
          console.log(`Processing product ${i}:`, product.title)
          
          // Get main image and hover image
          const images = product.images?.edges || []
          const mainImage = images[0]?.node?.url || ''
          const hoverImage = images[1]?.node?.url || mainImage
          
          // Get price information
          const minPrice = parseFloat(product.priceRange?.minVariantPrice?.amount || '0')
          const compareAtPrice = product.compareAtPriceRange?.minVariantPrice?.amount 
            ? parseFloat(product.compareAtPriceRange.minVariantPrice.amount)
            : null

          const transformedProduct = {
            id: product.id,
            name: product.title || '',
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
            images: images.map(edge => ({
              id: edge.node.id,
              url: edge.node.url,
              altText: edge.node.altText,
              width: edge.node.width,
              height: edge.node.height,
            })),
            variants: (product.variants?.edges || []).map(edge => ({
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
              selectedOptions: edge.node.selectedOptions,
              image: edge.node.image ? {
                id: edge.node.image.id,
                url: edge.node.image.url,
                altText: edge.node.image.altText,
                width: edge.node.image.width,
                height: edge.node.image.height,
              } : null,
            })),
          }
          
          transformedProducts.push(transformedProduct)
          console.log(`Successfully transformed product: ${transformedProduct.name}`)
        } else {
          console.warn(`Product with ID ${cleanProductIds[i]} not found or invalid`)
        }
      }

      console.log(`=== Function completed successfully. Transformed ${transformedProducts.length} products ===`)

      return new Response(
        JSON.stringify({ 
          products: transformedProducts,
          success: true,
          count: transformedProducts.length,
          shopifyDomain,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout')
        return new Response(
          JSON.stringify({ 
            error: 'Request timeout',
            details: 'The request to Shopify API timed out after 30 seconds',
            success: false
          }),
          { 
            status: 408, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      throw fetchError
    }

  } catch (error) {
    console.error('=== Function error ===')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        name: error.name,
        timestamp: new Date().toISOString(),
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})