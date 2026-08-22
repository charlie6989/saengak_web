
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { hasAcceptedPublicKey } from '../_shared/auth.ts'
import {
  buildStorefrontHeaders,
  buildStorefrontUrl,
  isValidShopifyDomain,
  resolveShopifyDomain,
  resolveStorefrontApiVersion,
} from '../_shared/shopify-storefront.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!hasAcceptedPublicKey(
    req.headers.get('apikey'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
  )) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const shopifyDomain = resolveShopifyDomain(Deno.env.get('ShopifyDomain'))
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken')
    const apiVersion = resolveStorefrontApiVersion(Deno.env.get('ShopifyStorefrontApiVersion'))

    if (!isValidShopifyDomain(shopifyDomain)) {
      throw new Error('Invalid ShopifyDomain configuration')
    }

    const { limit = 12 } = await req.json().catch(() => ({}))

    const query = `
      query GetArticles($first: Int!) {
        articles(first: $first, sortKey: PUBLISHED_AT, reverse: true) {
          edges {
            node {
              id
              title
              contentHtml
              excerpt
              publishedAt
              handle
              image {
                url
                altText
              }
              blog {
                title
                handle
              }
              tags
              authorV2 {
                name
              }
            }
          }
        }
      }
    `

    const shopifyResponse = await fetch(buildStorefrontUrl(shopifyDomain, apiVersion), {
      method: 'POST',
      headers: buildStorefrontHeaders(storefrontAccessToken),
      body: JSON.stringify({
        query,
        variables: { first: limit }
      }),
    })

    const shopifyData = await shopifyResponse.json().catch(() => null)

    if (!shopifyResponse.ok || !shopifyData) {
      return new Response(
        JSON.stringify({
          error: 'Shopify Storefront API request failed',
          status: shopifyResponse.status,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (shopifyData.errors) {
      return new Response(
        JSON.stringify({ error: 'Shopify GraphQL request failed', details: shopifyData.errors }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const articles = shopifyData.data.articles.edges.map((edge: any) => edge.node)

    return new Response(
      JSON.stringify({ articles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
