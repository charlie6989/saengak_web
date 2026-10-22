import { collectionGraphql, collectionPolicy, readCollectionOrder, requireCollectionPolicy,
  validateCollectionOrder, verifyCollectionBeforeIssue } from './cod-collection.js';

const safeCode = (error: unknown) => error instanceof Error && /^COD_COLLECTION_[A-Z_]+$/.test(error.message)
  ? error.message : 'COD_COLLECTION_SOURCE_UNAVAILABLE';
const temporary = new Set(['COD_COLLECTION_SOURCE_UNAVAILABLE','COD_COLLECTION_MAPPING_UNVERIFIED','COD_COLLECTION_DISABLED']);

/** Durable evidence, invoice enqueue and payment projection are distinct stages.
 * The caller dispatches invoices even if Shopify payment projection needs retry. */
export async function collectCodOrder(db: any, gid: string): Promise<{ invoiceReady: boolean; error?: string }> {
  if (process.env.COD_COLLECTION_ENABLED !== 'true') return { invoiceReady: false };
  let invoiceReady = false;
  try {
    requireCollectionPolicy();
    const work = await db.rpc('get_cod_collection_work', { p_order_gid: gid });
    if (work.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
    if (!work.data?.enabled || !work.data.managed) return { invoiceReady: false };
    if (work.data.reviewRequired) throw new Error('COD_COLLECTION_REVIEW_REQUIRED');
    const order = await readCollectionOrder(gid);
    const evidence = validateCollectionOrder(order, work.data.snapshot, collectionPolicy());
    const saved = await db.rpc('record_cod_collection', { p_order_gid: gid, p_snapshot: work.data.snapshot, p_evidence: evidence });
    if (saved.error) throw new Error(safeCode(new Error(saved.error.message)));
    invoiceReady = true;
    // Independent, opt-in payment projection. It is never used as evidence for the invoice.
    if (process.env.COD_COLLECTION_PAYMENT_ENABLED === 'true') {
      const claim = await db.rpc('claim_cod_payment_projection', { p_order_gid: gid });
      if (claim.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
      if (claim.data) {
        let error: string | null = null;
        try {
          // Re-read after lease acquisition; prior timeouts are reconciled by observing PAID.
          await verifyCollectionBeforeIssue(db, gid);
          const current = await readCollectionOrder(gid);
          const currentEvidence = validateCollectionOrder(current, work.data.snapshot, collectionPolicy());
          if (currentEvidence.fingerprint !== evidence.fingerprint) throw new Error('COD_COLLECTION_EVIDENCE_CHANGED');
          const authorized = await db.rpc('authorize_cod_payment_projection', { p_order_gid: gid, p_lease: claim.data });
          if (authorized.error) throw new Error('COD_COLLECTION_REVIEW_REQUIRED');
          if (current.displayFinancialStatus !== 'PAID') {
            const result = await collectionGraphql(`mutation CodCollectionPaid($input: OrderMarkAsPaidInput!) {
              orderMarkAsPaid(input: $input) { order { id displayFinancialStatus } userErrors { message } }
            }`, { input: { id: gid } });
            if (result.orderMarkAsPaid?.userErrors?.length || result.orderMarkAsPaid?.order?.id !== gid
              || result.orderMarkAsPaid.order.displayFinancialStatus !== 'PAID') throw new Error('COD_COLLECTION_PAYMENT_UNCONFIRMED');
          }
          const confirmed = await readCollectionOrder(gid);
          const confirmedEvidence = validateCollectionOrder(confirmed, work.data.snapshot, collectionPolicy());
          if (confirmed.displayFinancialStatus !== 'PAID' || confirmedEvidence.fingerprint !== evidence.fingerprint) {
            throw new Error('COD_COLLECTION_PAYMENT_UNCONFIRMED');
          }
        } catch (err) { error = safeCode(err); }
        const completed = await db.rpc('complete_cod_payment_projection', {
          p_order_gid: gid, p_lease: claim.data, p_success: error === null, p_error: error,
        });
        if (completed.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
        if (error) {
          const checked = await db.rpc('finish_cod_collection_check', { p_order_gid: gid, p_error: error,
            p_revoke: !temporary.has(error) && !['COD_COLLECTION_PAYMENT_UNCONFIRMED','COD_COLLECTION_STORAGE_UNAVAILABLE'].includes(error) });
          if (checked.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
          return { invoiceReady, error };
        }
      }
    }
    const checked = await db.rpc('finish_cod_collection_check', { p_order_gid: gid, p_error: null, p_revoke: false });
    if (checked.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
    return { invoiceReady };
  } catch (err) {
    const error = safeCode(err);
    const checked = await db.rpc('finish_cod_collection_check', { p_order_gid: gid, p_error: error,
      p_revoke: !temporary.has(error) && error !== 'COD_COLLECTION_STORAGE_UNAVAILABLE' });
    if (checked.error) throw new Error('COD_COLLECTION_STORAGE_UNAVAILABLE');
    return { invoiceReady, error };
  }
}
