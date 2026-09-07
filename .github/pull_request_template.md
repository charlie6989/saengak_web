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
- [ ] `site_settings.maintenance_mode` 全站維護開關 fail-closed 檢查已確認（`CheckoutReleaseEnabled` 已於 2026-08-23 移除，不再是現行閘門機制，詳見 `docs/00_DECISION_LOG.md` §3.3／§3.4）
- [ ] No secrets, customer/order data, payment data or private screenshots are included

## UI evidence

<!-- Add sanitized desktop/mobile screenshots when UI changed. -->
