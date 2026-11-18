import type { PlanId } from '@/data/plans';

export const CAFE_BAZAAR_PRODUCTS = {
  basic: {
    1: 'YADETO_basic_1m',
    3: 'YADETO_basic_3m',
    6: 'YADETO_basic_6m',
  },
  pro: {
    1: 'YADETO_pro_1m',
    3: 'YADETO_pro_3m',
    6: 'YADETO_pro_6m',
  },
} as const;

export type BazaarProductId =
  | 'YADETO_basic_1m'
  | 'YADETO_basic_3m'
  | 'YADETO_basic_6m'
  | 'YADETO_pro_1m'
  | 'YADETO_pro_3m'
  | 'YADETO_pro_6m';

export type BillingMonths = 1 | 3 | 6;

export function getCafeBazaarProductId(
  planId: PlanId,
  months: BillingMonths,
): BazaarProductId | null {
  if (planId !== 'basic' && planId !== 'pro') return null;
  return CAFE_BAZAAR_PRODUCTS[planId][months] ?? null;
}
