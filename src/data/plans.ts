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
    name: 'رایگان',
    nameEn: 'Free',
    price: 0,
    priceLabel: 'رایگان',
    period: '',
    aiAssistantLimit: 10,
    templateLimit: 15,
    accent: 'slate',
    gradient: 'from-slate-400 to-slate-600',
    features: [
      { label: '۱۰ پیام دستیار هوشمند در روز', included: true },
      { label: '۱۵ ثبت کار و رویداد در روز (دستی)', included: true },
      { label: 'تقویم جلالی/میلادی/قمری با ۱۹۳ مناسبت سال', included: true },
      { label: 'کارها و رویدادهای تکرارشونده', included: true },
      { label: 'یادآوری روی دستگاه', included: true },
      { label: 'خلاصه هوشمند روز و گزارش هفتگی', included: true },
      { label: 'جستجوی وب توسط دستیار', included: false },
      { label: 'همگام‌سازی بین دستگاه‌ها', included: false },
      { label: 'پشتیبانی ایمیل', included: false },
    ],
  },
  {
    id: 'basic',
    name: 'پایه',
    nameEn: 'Basic',
    price: 599000,
    priceLabel: '۵۹۹٬۰۰۰',
    period: 'ماهانه',
    aiAssistantLimit: 100,
    templateLimit: 200,
    accent: 'cyan',
    gradient: 'from-cyan-500 to-blue-600',
    features: [
      { label: '۱۰۰ پیام دستیار هوشمند در روز', included: true },
      { label: 'ثبت نامحدود کار و رویداد', included: true },
      { label: 'همگام‌سازی بین دستگاه‌ها', included: true },
      { label: 'جستجوی وب توسط دستیار', included: true },
      { label: 'هشدار تداخل زمانی و پیشنهاد جابه‌جایی', included: true },
      { label: 'پیشنهاد زمان آزاد و بهترین تاریخ مسافرت', included: true },
      { label: 'پشتیبانی ایمیل', included: true },
      { label: 'پردازش با اولویت', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'حرفه‌ای',
    nameEn: 'Pro',
    price: 1599000,
    priceLabel: '۱٬۵۹۹٬۰۰۰',
    period: 'ماهانه',
    aiAssistantLimit: 500,
    templateLimit: 1000,
    popular: true,
    accent: 'indigo',
    gradient: 'from-indigo-500 to-indigo-700',
    features: [
      { label: '۵۰۰ پیام دستیار هوشمند در روز', included: true },
      { label: 'ثبت نامحدود کار و رویداد', included: true },
      { label: 'همگام‌سازی نامحدود بین دستگاه‌ها', included: true },
      { label: 'جستجوی وب توسط دستیار', included: true },
      { label: 'هشدار تداخل زمانی و پیشنهاد جابه‌جایی', included: true },
      { label: 'پیشنهاد زمان آزاد و بهترین تاریخ مسافرت', included: true },
      { label: 'پشتیبانی اولویت‌دار', included: true },
      { label: 'دستیار با اولویت پردازش', included: true },
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
