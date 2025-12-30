
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const shopifyDomain = Deno.env.get('ShopifyDomain') || 'ekfvih-rz.myshopify.com'
    const storefrontAccessToken = Deno.env.get('StorefrontAccessToken') || '1707057fb57281cd5b3956de51a8c896'

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

    const shopifyResponse = await fetch(`https://${shopifyDomain}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({
        query,
        variables: { first: limit }
      }),
    })

    const shopifyData = await shopifyResponse.json()

    if (shopifyData.errors) {
      throw new Error(JSON.stringify(shopifyData.errors))
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
