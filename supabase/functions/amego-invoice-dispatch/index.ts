import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getPreferredSecretKey } from '../_shared/auth.ts';
import {
  dispatchAmegoAllowanceJob,
  type AmegoAllowanceJob,
} from './allowance.ts';
import { dispatchAmegoJob, type AmegoCredentials, type AmegoJob } from './amego.ts';

const json = (body: Record<string, unknown>, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

async function secureEquals(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const key = await crypto.subtle.importKey('raw', encoder.encode('amego-dispatch-token'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.sign('HMAC', key, leftBytes),
    crypto.subtle.sign('HMAC', key, rightBytes),
  ]);
  const leftDigest = new Uint8Array(leftHash);
  const rightDigest = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const expectedToken = Deno.env.get('AmegoDispatchToken') ?? '';
  const receivedToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (expectedToken && new TextEncoder().encode(expectedToken).byteLength < 32) {
    return json({ error: 'Invoice dispatcher is not securely configured' }, 503);
  }
  if (!expectedToken || !receivedToken || !await secureEquals(receivedToken, expectedToken)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (Deno.env.get('AmegoInvoiceReleaseEnabled') !== 'true') {
    return json({ error: 'Amego invoice release is disabled' }, 503);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = getPreferredSecretKey(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('SUPABASE_SECRET_KEYS'),
  );
  if (!supabaseUrl || !secretKey) return json({ error: 'Invoice storage is unavailable' }, 503);

  const mode = Deno.env.get('AmegoMode');
  if (mode !== 'test' && mode !== 'production') return json({ error: 'Invalid Amego mode' }, 503);
  const credentials: AmegoCredentials = {
    sellerTaxId: Deno.env.get('AmegoSellerTaxId') ?? '',
    appKey: Deno.env.get('AmegoAppKey') ?? '',
    mode,
    allowedSellerTaxIds: (Deno.env.get('AmegoAllowedSellerTaxIds') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  };

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 4_096) {
    return json({ error: 'Request is too large' }, 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 4_096) {
    return json({ error: 'Request is too large' }, 413);
  }
  let body: { shopifyOrderGid?: unknown };
  try {
    body = (rawBody ? JSON.parse(rawBody) : {}) as { shopifyOrderGid?: unknown };
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }
  const requestedOrder = typeof body.shopifyOrderGid === 'string' && /^gid:\/\/shopify\/Order\/\d+$/.test(body.shopifyOrderGid)
    ? body.shopifyOrderGid
    : null;
  if (body.shopifyOrderGid != null && !requestedOrder) return json({ error: 'Invalid Shopify order GID' }, 400);

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc('claim_amego_invoice_job', {
    p_shopify_order_gid: requestedOrder,
  });
  if (error) {
    console.error('Unable to claim Amego invoice job', { code: error.code });
    return json({ error: 'Unable to claim invoice work' }, 500);
  }
  const job = Array.isArray(data) ? data[0] as AmegoJob | undefined : undefined;
  if (job) {
    const result = await dispatchAmegoJob(job, credentials, fetch, async () => {
      const { error: mutationError } = await admin.rpc('mark_amego_invoice_mutation_started', {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
      });
      if (mutationError) throw new Error('Unable to persist Amego mutation boundary');
    });
    const persistedOutcome = result.outcome === 'failed' && !result.retryable
      ? 'failed_terminal'
      : result.outcome;
    const { error: completionError } = await admin.rpc('complete_amego_invoice_job', {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_outcome: persistedOutcome,
      p_mutation_accepted: 'mutationAccepted' in result ? result.mutationAccepted : false,
      p_mutation_rejected: 'mutationRejected' in result ? result.mutationRejected === true : false,
      p_invoice_number: 'invoiceNumber' in result ? result.invoiceNumber ?? null : null,
      p_provider_status: 'providerStatus' in result ? result.providerStatus ?? null : null,
      p_provider_updated_at: 'providerUpdatedAt' in result ? result.providerUpdatedAt : null,
      p_error_code: 'errorCode' in result ? result.errorCode : null,
      p_error_message: 'errorMessage' in result ? result.errorMessage : null,
    });
    if (completionError) {
      console.error('Unable to complete Amego invoice job', { jobId: job.job_id, code: completionError.code });
      return json({ error: 'Unable to persist invoice result' }, 500);
    }
    return json({ ok: true, jobId: job.job_id, outcome: result.outcome }, 200);
  }

  const { data: allowanceData, error: allowanceError } = await admin.rpc(
    'claim_amego_allowance_job',
    { p_shopify_order_gid: requestedOrder },
  );
  if (allowanceError) {
    console.error('Unable to claim Amego allowance job', { code: allowanceError.code });
    return json({ error: 'Unable to claim allowance work' }, 500);
  }
  const allowanceJob = Array.isArray(allowanceData)
    ? allowanceData[0] as AmegoAllowanceJob | undefined
    : undefined;
  if (!allowanceJob) return new Response(null, { status: 204 });

  const allowanceResult = await dispatchAmegoAllowanceJob(
    allowanceJob,
    credentials,
    fetch,
    async () => {
      const { error: mutationError } = await admin.rpc(
        'mark_amego_allowance_mutation_started',
        {
          p_job_id: allowanceJob.job_id,
          p_lease_token: allowanceJob.lease_token,
        },
      );
      if (mutationError) throw new Error('Unable to persist Amego allowance mutation boundary');
    },
  );
  const persistedAllowanceOutcome = allowanceResult.outcome === 'failed' && !allowanceResult.retryable
    ? 'failed_terminal'
    : allowanceResult.outcome;
  const { error: allowanceCompletionError } = await admin.rpc(
    'complete_amego_allowance_job',
    {
      p_job_id: allowanceJob.job_id,
      p_lease_token: allowanceJob.lease_token,
      p_outcome: persistedAllowanceOutcome,
      p_mutation_accepted: 'mutationAccepted' in allowanceResult
        ? allowanceResult.mutationAccepted
        : false,
      p_mutation_rejected: 'mutationRejected' in allowanceResult
        ? allowanceResult.mutationRejected === true
        : false,
      p_allowance_number: 'allowanceNumber' in allowanceResult
        ? allowanceResult.allowanceNumber ?? null
        : null,
      p_provider_status: 'providerStatus' in allowanceResult
        ? allowanceResult.providerStatus ?? null
        : null,
      p_provider_updated_at: 'providerUpdatedAt' in allowanceResult
        ? allowanceResult.providerUpdatedAt
        : null,
      p_error_code: 'errorCode' in allowanceResult ? allowanceResult.errorCode : null,
      p_error_message: 'errorMessage' in allowanceResult ? allowanceResult.errorMessage : null,
    },
  );
  if (allowanceCompletionError) {
    console.error('Unable to complete Amego allowance job', {
      jobId: allowanceJob.job_id,
      code: allowanceCompletionError.code,
    });
    return json({ error: 'Unable to persist allowance result' }, 500);
  }
  return json({
    ok: true,
    jobId: allowanceJob.job_id,
    outcome: allowanceResult.outcome,
  }, 200);
});
