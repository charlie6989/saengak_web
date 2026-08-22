import {
  REQUIRED_ORDER_WEBHOOK_TOPICS,
  SAENGAK_ORDER_WEBHOOK_URI,
  SAENGAK_SHOPIFY_API_VERSION,
  SAENGAK_SHOPIFY_DOMAIN,
  buildWebhookSubscriptionPlan,
  redactWebhookSubscriptionPlan,
  validateWebhookConfiguration,
} from './shopify-webhooks-lib.mjs';

const apply = process.argv.includes('--apply');
const config = validateWebhookConfiguration({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || SAENGAK_SHOPIFY_DOMAIN,
  apiVersion: process.env.SHOPIFY_API_VERSION || SAENGAK_SHOPIFY_API_VERSION,
  webhookUri: process.env.SHOPIFY_WEBHOOK_URI || SAENGAK_ORDER_WEBHOOK_URI,
});

const endpoint = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;

async function resolveAdminAccessToken() {
  const configuredToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (configuredToken) return configuredToken;

  const clientId = process.env.SHOPIFY_APP_CLIENT_ID?.trim();
  const clientSecret = (
    process.env.SHOPIFY_APP_CLIENT_SECRET ||
    process.env.SHOPIFY_WEBHOOK_SECRET ||
    process.env.ShopifyWebhookSecret
  )?.trim();
  if (!clientId || !clientSecret) return '';

  const response = await fetch(`https://${config.shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Shopify client credentials exchange failed (${response.status})`);
  }
  return payload.access_token;
}

const accessToken = await resolveAdminAccessToken();

async function shopifyGraphql(query, variables) {
  if (!accessToken) {
    throw new Error('缺少 SHOPIFY_ADMIN_ACCESS_TOKEN');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(`Shopify Admin API request failed (${response.status})`);
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join('; '));
  }
  return payload.data;
}

const listQuery = `
  query SaengakOrderWebhookSubscriptions($topics: [WebhookSubscriptionTopic!]) {
    webhookSubscriptions(first: 100, topics: $topics) {
      nodes { id topic uri }
    }
  }
`;

const createMutation = `
  mutation SaengakWebhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!,
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(
      topic: $topic,
      webhookSubscription: $webhookSubscription
    ) {
      webhookSubscription { id topic uri }
      userErrors { field message }
    }
  }
`;

if (!accessToken) {
  console.log(JSON.stringify({
    mode: 'dry-run-no-token',
    shopDomain: config.shopDomain,
    apiVersion: config.apiVersion,
    webhookUri: config.webhookUri,
    requiredTopics: REQUIRED_ORDER_WEBHOOK_TOPICS,
    next: '設定 SHOPIFY_ADMIN_ACCESS_TOKEN，或設定 SHOPIFY_APP_CLIENT_ID 與 SHOPIFY_APP_CLIENT_SECRET，再執行 npm run shopify:webhooks -- --apply',
  }, null, 2));
  if (apply) process.exitCode = 1;
} else {
  const current = await shopifyGraphql(listQuery, {
    topics: REQUIRED_ORDER_WEBHOOK_TOPICS,
  });
  const existing = current?.webhookSubscriptions?.nodes ?? [];
  const plan = buildWebhookSubscriptionPlan(existing, config.webhookUri);

  if (plan.some((item) => item.action === 'conflict')) {
    console.error(JSON.stringify({
      mode: apply ? 'apply' : 'verify',
      plan: redactWebhookSubscriptionPlan(plan),
    }, null, 2));
    throw new Error('偵測到同 topic 不同 URI；需先人工確認舊 subscription，避免重複投遞');
  }

  if (apply) {
    for (const item of plan.filter((candidate) => candidate.action === 'create')) {
      const data = await shopifyGraphql(createMutation, {
        topic: item.topic,
        webhookSubscription: { uri: config.webhookUri },
      });
      const result = data?.webhookSubscriptionCreate;
      if (result?.userErrors?.length) {
        throw new Error(result.userErrors.map((error) => error.message).join('; '));
      }
    }
  }

  const verified = await shopifyGraphql(listQuery, {
    topics: REQUIRED_ORDER_WEBHOOK_TOPICS,
  });
  const finalPlan = buildWebhookSubscriptionPlan(
    verified?.webhookSubscriptions?.nodes ?? [],
    config.webhookUri,
  );

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'verify',
    shopDomain: config.shopDomain,
    apiVersion: config.apiVersion,
    webhookUri: config.webhookUri,
    plan: redactWebhookSubscriptionPlan(finalPlan),
    complete: finalPlan.every((item) => item.action === 'present'),
  }, null, 2));

  if (apply && finalPlan.some((item) => item.action !== 'present')) process.exitCode = 1;
}
