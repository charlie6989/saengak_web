## Summary

<!-- What changed and why? -->

## Impact and risk

- User/developer impact:
- Security or privacy impact:
- Rollback plan:
- Known limitations:

## Verification

<!-- Check only commands actually run. Add concrete results. -->

- [ ] `npm run typecheck`
- [ ] `npm test -- --run`
- [ ] `npm run build`
- [ ] `npm run verify:content`
- [ ] `npm run verify:supabase`
- [ ] `npm audit --audit-level=moderate`
- [ ] Database/commerce/production checks where applicable

## Commerce and external systems

- [ ] No Shopify, Supabase, TapPay, logistics, invoice or Vercel behavior changed
- [ ] External-system changes are documented with dry-run and readback evidence
- [ ] `CheckoutReleaseEnabled` remains fail-closed unless formal launch approval is attached
- [ ] No secrets, customer/order data, payment data or private screenshots are included

## UI evidence

<!-- Add sanitized desktop/mobile screenshots when UI changed. -->
