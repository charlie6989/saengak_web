/** Fulfillment events only schedule authoritative Admin reads. The webhook's
 * status alone never authorizes an invoice or payment mutation. */
export function collectionEvent(payload: Record<string, unknown>, topic: string) {
  if (!['fulfillment_events/create','fulfillment_events/delete'].includes(topic)) return null;
  const id = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? String(value) : typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value) ? value : null;
  const order = id(payload.order_id), fulfillment = id(payload.fulfillment_id), event = id(payload.id);
  if (!order || !fulfillment || !event || typeof payload.status !== 'string' || !/^[a-z_]{1,40}$/.test(payload.status)) return null;
  return { p_order_gid: `gid://shopify/Order/${order}`, p_fulfillment_gid: `gid://shopify/Fulfillment/${fulfillment}`,
    p_event_id: event, p_status: payload.status, p_deleted: topic.endsWith('/delete') };
}
