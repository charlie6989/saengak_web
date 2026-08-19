import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { hasAcceptedPublicKey } from '../create-shopify-cart/auth.ts'
import {
  buildStorefrontHeaders,
  buildStorefrontUrl,
  isValidShopifyDomain,
  resolveShopifyDomain,
  resolveStorefrontApiVersion,
  shouldIncludeStorefrontInventory,
} from '../_shared/shopify-storefront.ts'
import {
  buildShopifyProductsQuery,
  parseShopifyProductIds,
} from '../_shared/shopify-product-query.ts'

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

  if (!hasAcceptedPublicKey(
    req.headers.get('apikey'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
  )) {
    return new Response(JSON.stringify({ error: 'Invalid API key', success: false }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    console.log('=== Starting get-products function ===')
    console.log('Request method:', req.method)
    console.log('Request URL:', req.url)
    
    // Get Shopify credentials from environment
    const shopifyDomain = resolveShopifyDomain(Deno.env.get('ShopifyDomain'))
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken')
    const apiVersion = resolveStorefrontApiVersion(Deno.env.get('ShopifyStorefrontApiVersion'))

    if (!isValidShopifyDomain(shopifyDomain)) {
      throw new Error('Invalid ShopifyDomain configuration')
    }
    
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
            'gid://shopify/Product/7786993614915'
          ]
        }
      } else {
        requestBody = JSON.parse(bodyText)
      }
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError)
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseErrorMessage,
          success: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const parsedProductIds = parseShopifyProductIds(requestBody.productIds)
    if (!parsedProductIds.ok) {
      console.error('Invalid or missing product IDs')
      return new Response(
        JSON.stringify({ 
          error: parsedProductIds.error,
          success: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    const productIds = parsedProductIds.ids
    console.log('Validated product ID count:', productIds.length)

    const restrictedProductFields = storefrontAccessToken ? 'tags' : ''
    const restrictedVariantFields = shouldIncludeStorefrontInventory(
      Deno.env.get('ShopifyStorefrontInventoryEnabled'),
    ) ? 'quantityAvailable' : ''

    const query = buildShopifyProductsQuery(
      Boolean(restrictedProductFields),
      Boolean(restrictedVariantFields),
    )

    console.log('GraphQL Query built successfully')

    // Make request to Shopify Storefront API with timeout
    const shopifyUrl = buildStorefrontUrl(shopifyDomain, apiVersion)
    console.log('Making request to:', shopifyUrl)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const shopifyResponse = await fetch(shopifyUrl, {
        method: 'POST',
        headers: {
          ...buildStorefrontHeaders(storefrontAccessToken),
          'User-Agent': 'Supabase Edge Function',
        },
        body: JSON.stringify({ query, variables: { ids: productIds } }),
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
            status: 502,
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
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Transform the data to match frontend expectations
      const transformedProducts = []
      
      const productNodes = Array.isArray(shopifyData.data?.nodes) ? shopifyData.data.nodes : []
      for (let i = 0; i < productNodes.length; i++) {
        const product = productNodes[i]
        
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
            images: images.map((edge: any) => ({
              id: edge.node.id,
              url: edge.node.url,
              altText: edge.node.altText,
              width: edge.node.width,
              height: edge.node.height,
            })),
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
          console.warn(`Product with ID ${productIds[i] ?? '(unknown)'} not found or invalid`)
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
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
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
    const normalizedError = error instanceof Error ? error : new Error(String(error))
    console.error('=== Function error ===')
    console.error('Error name:', normalizedError.name)
    console.error('Error message:', normalizedError.message)
    console.error('Error stack:', normalizedError.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: normalizedError.message,
        name: normalizedError.name,
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
