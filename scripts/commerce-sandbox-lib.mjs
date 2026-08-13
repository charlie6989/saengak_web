export const SAENGAK_SHOP_DOMAIN = 'gh2xgs-zf.myshopify.com';
export const SAENGAK_SUPABASE_PROJECT = 'tmqzkagkrzhioftvwbqo';
export const REQUIRED_TAPPAY_DOMAINS = [
  'link-pay.tappaysdk.com',
  'shopify-pay.tappaysdk.com',
  'shopify-t.tappaysdk.com',
  'shopify.tappaysdk.com',
];
export const REQUIRED_WEBHOOK_TOPICS = [
  'ORDERS_CREATE',
  'ORDERS_PAID',
  'ORDERS_UPDATED',
  'ORDERS_FULFILLED',
  'ORDERS_CANCELLED',
];
export const REQUIRED_SANDBOX_SCENARIOS = ['success', 'failed', 'cancelled'];

const sensitiveKeyPattern = /(^|_)(address|authorization|card|client_secret|cvv|cvc|email|name|partner_key|password|phone|secret|token)($|_)/i;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sortedUniqueStrings(values) {
  return [...new Set(Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [])]
    .sort();
}

function sameStringSet(actual, expected) {
  const normalizedActual = sortedUniqueStrings(actual);
  const normalizedExpected = sortedUniqueStrings(expected);
  return normalizedActual.length === normalizedExpected.length
    && normalizedExpected.every((value, index) => normalizedActual[index] === value);
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb') || host.startsWith('fc') || host.startsWith('fd')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return parts[0] === 10
      || parts[0] === 127
      || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168);
  }
  return false;
}

function isPublicHttpsUrl(value, expectedHostname) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && !parsed.port
      && !isPrivateHostname(parsed.hostname)
      && (!expectedHostname || parsed.hostname === expectedHostname);
  } catch {
    return false;
  }
}

function isLikelySensitiveString(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(trimmed)) return true;
  if (/\b(?:shpat_|sb_secret_|sk_live_|pk_live_|Bearer\s+)[A-Za-z0-9._-]{8,}/i.test(trimmed)) return true;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(trimmed)) return true;
  return false;
}

function isFiniteNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function findSensitiveEvidencePaths(value, currentPath = '$', found = []) {
  if (isLikelySensitiveString(value)) {
    found.push(currentPath);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveEvidencePaths(item, `${currentPath}[${index}]`, found));
    return found;
  }
  if (!isRecord(value)) return found;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    const childPath = `${currentPath}.${key}`;
    if (sensitiveKeyPattern.test(normalizedKey)) found.push(childPath);
    findSensitiveEvidencePaths(child, childPath, found);
  }
  return found;
}

function gate(id, status, message) {
  return { id, status, message };
}

function booleanGate(id, value, passMessage, missingMessage) {
  if (value === true) return gate(id, 'pass', passMessage);
  if (value === false) return gate(id, 'fail', missingMessage);
  return gate(id, 'pending', missingMessage);
}

function evaluatePaymentOutcome(evidence) {
  const scenario = evidence.scenario;
  const shopify = evidence.shopify ?? {};
  const tappay = evidence.tappay ?? {};
  const supabase = evidence.supabase ?? {};

  if (scenario === 'success') {
    const pass = tappay.status === 'success'
      && shopify.financialStatus === 'paid'
      && supabase.paymentStatus === 'paid';
    return gate(
      'payment_outcome',
      pass ? 'pass' : 'fail',
      pass
        ? 'TapPay、Shopify 與 Supabase 均回讀為已付款'
        : '成功案例必須同時是 TapPay success、Shopify paid、Supabase paid',
    );
  }

  if (scenario === 'failed') {
    const shopifyNonPaid = typeof shopify.financialStatus === 'string'
      ? shopify.financialStatus !== 'paid'
      : shopify.orderCreated === false && shopify.financialStatus === null;
    const supabaseNonPaid = typeof supabase.paymentStatus === 'string'
      ? supabase.paymentStatus !== 'paid'
      : shopify.orderCreated === false && supabase.orderLinked === false && supabase.paymentStatus === null;
    const pass = tappay.status === 'failed'
      && shopifyNonPaid
      && supabaseNonPaid;
    return gate(
      'payment_outcome',
      pass ? 'pass' : 'fail',
      pass
        ? '失敗案例未被任何系統誤判為已付款'
        : '失敗案例必須是 TapPay failed，且 Shopify／Supabase 都不能是 paid',
    );
  }

  if (scenario === 'cancelled') {
    const shopifyNonPaid = typeof shopify.financialStatus === 'string'
      ? shopify.financialStatus !== 'paid'
      : shopify.orderCreated === false && shopify.financialStatus === null;
    const supabaseNonPaid = typeof supabase.paymentStatus === 'string'
      ? supabase.paymentStatus !== 'paid'
      : shopify.orderCreated === false && supabase.orderLinked === false && supabase.paymentStatus === null;
    const pass = tappay.status === 'cancelled'
      && shopify.cancelled === true
      && shopifyNonPaid
      && supabaseNonPaid;
    return gate(
      'payment_outcome',
      pass ? 'pass' : 'fail',
      pass
        ? '取消案例已取消，且沒有被投影成已付款'
        : '取消案例必須是 TapPay cancelled、Shopify cancelled，且 Supabase 不能是 paid',
    );
  }

  return gate('payment_outcome', 'pending', 'scenario 必須是 success、failed 或 cancelled');
}

function evaluateAmounts(evidence) {
  const shopify = evidence.shopify ?? {};
  const tappay = evidence.tappay ?? {};
  const supabase = evidence.supabase ?? {};
  const values = [shopify.amountTwd, tappay.amountTwd, supabase.amountTwd];
  if (!values.every(isFiniteNonNegativeInteger)) {
    return gate('amount_reconciliation', 'pending', '三個系統都必須提供非負整數 TWD 金額');
  }
  const pass = values.every((value) => value === values[0]);
  return gate(
    'amount_reconciliation',
    pass ? 'pass' : 'fail',
    pass ? 'Shopify、TapPay 與 Supabase 金額一致' : 'Shopify、TapPay 與 Supabase 金額不一致',
  );
}

function evaluateIdentifiers(evidence) {
  const shopify = evidence.shopify ?? {};
  const tappay = evidence.tappay ?? {};
  const supabase = evidence.supabase ?? {};
  if (evidence.scenario !== 'success' && shopify.orderCreated === false) {
    const pass = supabase.orderLinked === false && !supabase.shopifyOrderId;
    return gate(
      'order_identity',
      pass ? 'pass' : 'fail',
      pass
        ? '未成立 Shopify 訂單時，Supabase 也沒有建立會員訂單'
        : '未成立 Shopify 訂單時不得在 Supabase 建立會員訂單',
    );
  }

  const identifiersPresent = [shopify.orderId, tappay.shopifyOrderId, supabase.shopifyOrderId]
    .every((value) => typeof value === 'string' && value.length > 0);
  if (!identifiersPresent) {
    return gate('order_identity', 'pending', '缺少 Shopify 訂單 ID 的跨系統回讀');
  }
  const pass = shopify.orderId === tappay.shopifyOrderId
    && shopify.orderId === supabase.shopifyOrderId
    && supabase.orderLinked === true;
  return gate(
    'order_identity',
    pass ? 'pass' : 'fail',
    pass ? '同一 Shopify 訂單已連回可信會員訂單' : '訂單 ID 不一致或未連回可信會員',
  );
}

function evaluateDownstreamEffects(evidence) {
  const logistics = evidence.logistics ?? {};
  const invoice = evidence.invoice ?? {};
  if (evidence.scenario === 'success') {
    const shopifyOrderId = evidence.shopify?.orderId;
    const shopifyNumericOrderId = typeof shopifyOrderId === 'string'
      ? shopifyOrderId.match(/^gid:\/\/shopify\/Order\/([1-9]\d*)$/)?.[1]
      : undefined;
    const fulfillmentGidPattern = /^gid:\/\/shopify\/Fulfillment\/[1-9]\d*$/;
    const logisticsPass = logistics.checkoutMethodVerified === true
      && logistics.shopifyFulfillmentWrittenBack === true
      && logistics.shopifyOrderId === shopifyOrderId
      && fulfillmentGidPattern.test(logistics.shopifyFulfillmentGid ?? '')
      && logistics.shopifyFulfillmentGid === logistics.supabaseFulfillmentGid
      && isPublicHttpsUrl(logistics.shopifyTrackingUrl)
      && logistics.shopifyTrackingUrl === logistics.supabaseTrackingUrl;
    const invoicePass = invoice.authoritativeProviderEvent === true
      && invoice.provider === 'amego'
      && invoice.status === 'issued'
      && invoice.providerStatus === 99
      && invoice.shopifyOrderId === shopifyOrderId
      && Boolean(shopifyNumericOrderId)
      && invoice.providerOrderId === `S${shopifyNumericOrderId}`
      && invoice.amountTwd === evidence.shopify?.amountTwd
      && /^[A-Z]{2}\d{8}$/.test(invoice.invoiceNumber ?? '');
    return [
      gate(
        'fulfillment_projection',
        logisticsPass ? 'pass' : 'fail',
        logisticsPass
          ? '配送方式、fulfillment 與 HTTPS 追蹤連結已回寫'
          : '成功案例必須驗證配送方式、Shopify fulfillment 與 HTTPS 追蹤連結',
      ),
      gate(
        'invoice_projection',
        invoicePass ? 'pass' : 'fail',
        invoicePass
          ? '發票已由供應商事件確認開立'
          : '成功案例的 issued 狀態必須來自發票供應商事件',
      ),
    ];
  }

    const logisticsPass = logistics.shopifyFulfillmentWrittenBack === false
      && logistics.shopifyFulfillmentGid == null
      && logistics.supabaseFulfillmentGid == null
      && logistics.shopifyTrackingUrl == null
      && logistics.supabaseTrackingUrl == null;
    const invoicePass = invoice.authoritativeProviderEvent === false
      && invoice.providerOrderId == null
      && invoice.invoiceNumber == null
      && ['not-issued', 'voided'].includes(invoice.status);
  return [
    gate(
      'fulfillment_projection',
      logisticsPass ? 'pass' : 'fail',
      logisticsPass ? '未付款案例沒有誤建物流單' : '失敗／取消案例不得建立 fulfillment 或追蹤連結',
    ),
    gate(
      'invoice_projection',
      invoicePass ? 'pass' : 'fail',
      invoicePass ? '未付款案例沒有誤開發票' : '失敗／取消案例不得顯示 issued 發票',
    ),
  ];
}

export function evaluateSandboxCase(evidence) {
  if (!isRecord(evidence)) throw new Error('Sandbox evidence must be an object');
  const shopify = evidence.shopify ?? {};
  const tappay = evidence.tappay ?? {};
  const webhook = evidence.webhook ?? {};
  const supabase = evidence.supabase ?? {};
  const sensitivePaths = findSensitiveEvidencePaths(evidence);

  const gates = [
    gate(
      'evidence_privacy',
      sensitivePaths.length === 0 ? 'pass' : 'fail',
      sensitivePaths.length === 0
        ? '證據檔沒有敏感欄位'
        : `證據檔不得包含敏感欄位：${sensitivePaths.join(', ')}`,
    ),
    gate(
      'sandbox_environment',
      evidence.environment === 'sandbox' ? 'pass' : 'fail',
      evidence.environment === 'sandbox' ? '明確使用 sandbox' : '不得以 production 代替 sandbox 驗收',
    ),
    gate(
      'store_identity',
      shopify.storeDomain === SAENGAK_SHOP_DOMAIN ? 'pass' : 'fail',
      shopify.storeDomain === SAENGAK_SHOP_DOMAIN ? 'SAENGAK Shopify 商店正確' : 'Shopify 商店必須是 SAENGAK 專用商店',
    ),
    booleanGate('shopify_plan', shopify.planActive, 'Shopify 方案已啟用', 'Shopify 方案尚未啟用'),
    booleanGate('online_store', shopify.onlineStoreEnabled, 'Online Store 已啟用', 'Online Store 尚未解鎖'),
    booleanGate('variant_checkout', shopify.variantCheckoutVerified, '真實 Variant 已取得 checkoutUrl', '尚未用真實 Variant 驗證 checkoutUrl'),
    gate(
      'checkout_url',
      isPublicHttpsUrl(shopify.checkoutUrl, SAENGAK_SHOP_DOMAIN) ? 'pass' : 'fail',
      isPublicHttpsUrl(shopify.checkoutUrl, SAENGAK_SHOP_DOMAIN)
        ? 'checkoutUrl 使用 SAENGAK Shopify HTTPS 網域'
        : 'checkoutUrl 必須使用 SAENGAK Shopify HTTPS 網域',
    ),
    booleanGate('tappay_app', tappay.appInstalled, 'TapPay Payment App 已安裝', 'TapPay Payment App 尚未安裝'),
    booleanGate('tappay_merchant', tappay.merchantConfigured, 'TapPay Shopify 商家設定已完成', 'TapPay Shopify 商家設定尚未完成'),
    booleanGate('tappay_mgid', tappay.mgidConfigured, '測試與正式 MGID 已建立', 'TapPay MGID 尚未完成'),
    gate(
      'tappay_domains',
      sameStringSet(tappay.domainsConfigured, REQUIRED_TAPPAY_DOMAINS) ? 'pass' : 'fail',
      sameStringSet(tappay.domainsConfigured, REQUIRED_TAPPAY_DOMAINS)
        ? 'TapPay 四個必要 domain 已回讀完整'
        : 'TapPay 四個必要 domain 尚未完整回讀',
    ),
    booleanGate('tappay_test_mode', tappay.testMode, 'Shopify TapPay 測試模式已啟用', 'TapPay 測試模式尚未啟用'),
    gate(
      'webhook_subscriptions',
      sameStringSet(webhook.subscriptions, REQUIRED_WEBHOOK_TOPICS) ? 'pass' : 'fail',
      sameStringSet(webhook.subscriptions, REQUIRED_WEBHOOK_TOPICS)
        ? '五個 Shopify 訂單 webhook topics 已回讀完整'
        : 'Shopify 訂單 webhook subscriptions 不完整',
    ),
    booleanGate('webhook_delivery', webhook.eventAccepted, '本案例 webhook 已驗簽接受', '缺少本案例 webhook 成功投遞證據'),
    gate(
      'supabase_project',
      supabase.projectRef === SAENGAK_SUPABASE_PROJECT ? 'pass' : 'fail',
      supabase.projectRef === SAENGAK_SUPABASE_PROJECT ? 'SAENGAK Supabase 專案正確' : 'Supabase project ref 不正確',
    ),
    gate(
      'logistics_provider',
      evidence.logistics?.provider === 'shipany'
        && evidence.logistics?.appInstalled === true
        && evidence.logistics?.accountBound === true ? 'pass' : 'fail',
      evidence.logistics?.provider === 'shipany'
        && evidence.logistics?.appInstalled === true
        && evidence.logistics?.accountBound === true
        ? 'ShipAny 已安裝並綁定供應商帳號'
        : '必須安裝 ShipAny、停用重複物流方案，並完成供應商帳號綁定',
    ),
    booleanGate(
      'invoice_provider',
      evidence.invoice?.providerConfigured,
      '發票供應商已完成設定',
      '發票供應商尚未完成設定',
    ),
    evaluatePaymentOutcome(evidence),
    evaluateAmounts(evidence),
    evaluateIdentifiers(evidence),
    ...evaluateDownstreamEffects(evidence),
  ];

  const counts = gates.reduce((result, item) => ({
    ...result,
    [item.status]: result[item.status] + 1,
  }), { pass: 0, fail: 0, pending: 0 });

  return {
    scenario: evidence.scenario ?? 'unknown',
    passed: counts.fail === 0 && counts.pending === 0,
    counts,
    gates,
  };
}

export function evaluateSandboxSuite(evidenceCases) {
  if (!Array.isArray(evidenceCases)) throw new Error('Sandbox suite must be an array');
  const reports = evidenceCases.map(evaluateSandboxCase);
  const duplicates = reports
    .map((report) => report.scenario)
    .filter((scenario, index, scenarios) => scenarios.indexOf(scenario) !== index);
  const missingScenarios = REQUIRED_SANDBOX_SCENARIOS
    .filter((scenario) => !reports.some((report) => report.scenario === scenario));
  const unexpectedScenarios = reports
    .map((report) => report.scenario)
    .filter((scenario) => !REQUIRED_SANDBOX_SCENARIOS.includes(scenario));

  return {
    launchReady: reports.length === REQUIRED_SANDBOX_SCENARIOS.length
      && missingScenarios.length === 0
      && duplicates.length === 0
      && unexpectedScenarios.length === 0
      && reports.every((report) => report.passed),
    missingScenarios,
    duplicateScenarios: [...new Set(duplicates)],
    unexpectedScenarios: [...new Set(unexpectedScenarios)],
    reports,
  };
}
