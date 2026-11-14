export type PlanId = 'free' | 'basic' | 'pro';

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PricingPlan {
  id: PlanId;
  name: string;
  nameEn: string;
  price: number;
  priceLabel: string;
  period: string;
  aiAssistantLimit: number;
  templateLimit: number;
  popular?: boolean;
  accent: string;
  gradient: string;
  features: PlanFeature[];
}

export const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'آزمایشی',
    nameEn: 'Free',
    price: 0,
    priceLabel: 'رایگان',
    period: '',
    aiAssistantLimit: 3,
    templateLimit: 10,
    accent: 'slate',
    gradient: 'from-slate-400 to-slate-600',
    features: [
      { label: '۳ فرمان دستیار هوشمند در ماه', included: true },
      { label: '۱۰ ثبت خودکار کار و رویداد در ماه', included: true },
      { label: 'تقویم جلالی و مناسبت‌ها', included: true },
      { label: 'یادآوری و همگام‌سازی پایه', included: true },
      { label: 'گزارش هفتگی', included: true },
      { label: 'گزارش هفتگی', included: true },
      { label: 'پشتیبانی ایمیل', included: false },
    ],
  },
  {
    id: 'basic',
    name: 'پایه',
    nameEn: 'Basic',
    price: 59000,
    priceLabel: '۵۹٬۰۰۰',
    period: 'ماهانه',
    aiAssistantLimit: 20,
    templateLimit: 30,
    accent: 'cyan',
    gradient: 'from-cyan-500 to-blue-600',
    features: [
      { label: '۲۰ فرمان دستیار هوشمند در ماه', included: true },
      { label: '۳۰ ثبت خودکار کار و رویداد در ماه', included: true },
      { label: 'همگام‌سازی بین چند دستگاه', included: true },
      { label: 'یادآوری و همگام‌سازی پایه', included: true },
      { label: 'ویرایش متن نهایی قبل از کپی', included: true },
      { label: 'خروجی PDF (بدون واترمارک)', included: true },
      { label: 'بدون واترمارک', included: true },
    ],
  },
  {
    id: 'pro',
    name: 'حرفه‌ای',
    nameEn: 'Pro',
    price: 119000,
    priceLabel: '۱۱۹٬۰۰۰',
    period: 'ماهانه',
    aiAssistantLimit: 80,
    templateLimit: 120,
    popular: true,
    accent: 'indigo',
    gradient: 'from-indigo-500 to-indigo-700',
    features: [
      { label: '۸۰ فرمان دستیار هوشمند در ماه', included: true },
      { label: '۱۲۰ ثبت خودکار کار و رویداد در ماه', included: true },
      { label: 'همگام‌سازی نامحدود بین دستگاه‌ها', included: true },
      { label: 'یادآوری و همگام‌سازی پایه', included: true },
      { label: 'گزارش هفتگی', included: true },
      { label: 'خروجی PDF', included: true },
      { label: 'بدون واترمارک', included: true },
      { label: 'پردازش با اولویت', included: true },
    ],
  },
];

export const PLAN_MAP: Record<PlanId, PricingPlan> = PLANS.reduce(
  (acc, p) => { acc[p.id] = p; return acc; },
  {} as Record<PlanId, PricingPlan>,
);

export function getPlanById(id: string): PricingPlan | undefined {
  return PLAN_MAP[id as PlanId];
}

export function formatToman(n: number): string {
  return n.toLocaleString('fa-IR');
}

