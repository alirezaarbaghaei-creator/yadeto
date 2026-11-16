# Project memory

## Product intent & audience

- Persian-language (Farsi) AI assistant app with subscription plans
- Users purchase message allowances to chat with the assistant
- Audience: Iranian end-users; currency is Iranian Toman (تومان)

## Brand personality & voice

- Persian RTL UI; all user-facing copy in Farsi
- Tone: straightforward, utility-focused (plan names: رایگان / پایه / حرفه‌ای)

## Visual design & UX direction

- Frontend: Vite + React, TypeScript
- Pages/components identified: `PricingPage.tsx`, `PlanCheckout` component, usage counters showing remaining/total
- Usage counter labels now say «در روز» (per day) instead of per month
- UI must remain RTL-friendly for Farsi text

## Decisions, constraints & rationale

- Plans switched from monthly to **daily** message limits:
  - Free: 10 msgs/day, 0 toman
  - Basic (پایه): 100 msgs/day, 599,000 toman/month
  - Pro (حرفه‌ای): 500 msgs/day, 1,599,000 toman/month
- Usage reset logic changed from every 30 days to daily in `php-api/index.php` (`reset_usage_if_needed`)
- API field names changed from `*_this_month` to `*_today` in `src/lib/api.ts`
- `planStore.ts` updated from month→day semantics
- Payment integrations: **ZarinPal** (web gateway) + **Cafe Bazaar** (Android IAP)
- ZarinPal prices updated in PHP backend; Cafe Bazaar prices must be manually set in Cafe Bazaar developer panel (not code-controlled)
- Plan data centralized in `src/data/plans.ts`; backend mirrors in `php-api/index.php` (`planPrices`, `planLimits`)

## Open questions & assumptions

- Cafe Bazaar developer-panel prices still need manual update to 599,000 / 1,599,000 toman
- Assumes daily reset triggers correctly based on date comparison in PHP
- No explicit timezone handling mentioned for daily reset (potential edge case)