# BPS — Open SaaS Referans Notları

> Open SaaS (Wasp) incelendi. Kod kopyalanmadı — akış ve yapı referans alındı.
> BPS stack'i farklı (Next.js + Supabase vs Wasp + Prisma) — sadece pattern'ler adapte edildi.
> Tarih: 13 Nisan 2026

---

## 1. Landing Page Yapısı (Referans)

Open SaaS'ın landing page'i 7 bölümden oluşuyor. BPS için adapte edilmiş sıra:

```
BPS Landing Page Yapısı:
├── Hero (ana mesaj + CTA)
├── SectorShowcase (sektör logoları — güvenlik, temizlik, personel, OSGB...)
├── ProblemStatement ("5 ayrı program, hiçbiri birbiriyle konuşmuyor")
├── SolutionDemo (ekran görüntüsü veya kısa video — firma kartı)
├── FeaturesGrid (6-9 özellik kartı)
├── SectorTemplates (sektör bazlı "bu program senin işini biliyor" bölümü)
├── Pricing (3 plan kartı)
├── Testimonials (beta müşteri yorumları — ilk başta B&P müşterileri)
├── FAQ (sık sorulan sorular)
├── CTA + DemoForm (demo talep formu)
└── Footer
```

### Veri Yapısı (contentSections.ts — BPS versiyonu)

```typescript
// src/landing/contentSections.ts

export const heroContent = {
  title: "Hizmet Firmanızın Kalbi ve Beyni",
  subtitle: "Kullandığınız programları değiştirmiyoruz. Birleştiriyoruz.",
  cta: {
    primary: { text: "Demo Talep Et", href: "#demo" },
    secondary: { text: "Nasıl Çalışır?", href: "#features" },
  },
};

export const features = [
  {
    name: "Firma Kartı",
    description: "Her firmanın tüm bilgisi tek ekranda. Sözleşme, personel, evrak, ödeme — hepsi firma bağlamında.",
    emoji: "🏢",
  },
  {
    name: "Firma Sağlık Skoru",
    description: "0-100 arası otomatik skor. Riskli firmalar anında görünsün.",
    emoji: "📊",
  },
  {
    name: "Sektör Şablonları",
    description: "Güvenlik, temizlik, OSGB, lojistik — sektörünüze özel her şey hazır.",
    emoji: "🎯",
  },
  {
    name: "Excel'den Göç",
    description: "Excel dosyanızı sürükleyin, 15 dakikada başlayın. Geçiş süresi sıfır.",
    emoji: "📥",
  },
  {
    name: "Entegrasyon",
    description: "Luca, Logo, PDKS, SGK — kullandığınız programların çıktısını okur ve birleştirir.",
    emoji: "🔗",
  },
  {
    name: "Rol Bazlı Erişim",
    description: "Yönetici her şeyi görür, partner sadece kendi firmalarını. Veri izolasyonu mimari seviyede.",
    emoji: "🔐",
  },
];

export const sectorTemplates = [
  { name: "Özel Güvenlik", icon: "🛡️", features: ["Nöbet çizelgesi", "Ruhsat takibi", "Devriye kontrol"] },
  { name: "Temizlik", icon: "🧹", features: ["Saha denetim formu", "Malzeme takibi", "Müşteri memnuniyeti"] },
  { name: "Personel Temin", icon: "👥", features: ["Talep-personel eşleştirme", "Doluluk takibi", "SGK uyumu"] },
  { name: "OSGB", icon: "⚕️", features: ["İSGKATİP veri hazırlama", "Eğitim takvimi", "Muayene planı"] },
  { name: "Lojistik", icon: "🚛", features: ["Araç takip", "Bakım takvimi", "Teslimat performansı"] },
  { name: "Danışmanlık", icon: "💼", features: ["Proje takibi", "Saat bazlı maliyet", "Deliverable yönetimi"] },
  { name: "Tesis Yönetimi", icon: "🏗️", features: ["Bakım planı", "Arıza bildirimi", "Enerji takibi"] },
  { name: "İnşaat", icon: "👷", features: ["Hakediş takip", "İSG denetimi", "Taşeron yönetimi"] },
];

export const pricing = {
  plans: [
    {
      id: "baslangic",
      name: "Başlangıç",
      price: "₺5.000",
      period: "/ay",
      description: "Core platform + 1 sektör şablonu",
      features: [
        "10 core modül",
        "1 sektör şablonu",
        "Excel import/export",
        "5 kullanıcıya kadar",
        "Email destek",
      ],
      highlighted: false,
    },
    {
      id: "profesyonel",
      name: "Profesyonel",
      price: "₺9.000",
      period: "/ay",
      description: "En popüler — entegrasyon + Firma Sağlık Skoru",
      features: [
        "Başlangıç'taki her şey",
        "Firma Sağlık Skoru",
        "Luca/Logo entegrasyonu",
        "PDKS entegrasyonu",
        "15 kullanıcıya kadar",
        "Öncelikli destek",
      ],
      highlighted: true, // "Best deal" vurgusu
    },
    {
      id: "kurumsal",
      name: "Kurumsal",
      price: "₺15.000",
      period: "/ay",
      description: "Tüm modüller + sınırsız kullanıcı + AI Insight",
      features: [
        "Profesyonel'deki her şey",
        "Tüm sektör şablonları",
        "AI Insight modülü",
        "WhatsApp entegrasyonu",
        "Sınırsız kullanıcı",
        "Dedicated destek",
        "Özel entegrasyon",
      ],
      highlighted: false,
    },
  ],
};

export const faqs = [
  {
    question: "Mevcut programlarımı değiştirmem gerekiyor mu?",
    answer: "Hayır. BPS kullandığınız programları değiştirmez — birleştirir. Luca, Logo, Excel, PDKS çıktılarını okur ve firma bağlamında gösterir.",
  },
  {
    question: "Başlamak ne kadar sürer?",
    answer: "Excel dosyanızı yükleyin, 15 dakikada firmalarınız oluşsun. Sektör şablonunuz otomatik aktif olur.",
  },
  {
    question: "Hangi sektörlere hizmet veriyorsunuz?",
    answer: "Güvenlik, temizlik, personel temin, OSGB, lojistik, danışmanlık, tesis yönetimi ve inşaat. Her sektör için özel şablonlar mevcut.",
  },
  {
    question: "Verilerim güvende mi?",
    answer: "Evet. Rol bazlı erişim kontrolü mimari seviyede zorunludur. Partner sadece kendi firmalarını görür. Cross-tenant veri erişimi teknik olarak imkansız.",
  },
  {
    question: "Deneme süresi var mı?",
    answer: "14 gün ücretsiz deneme. Kredi kartı gerekmez.",
  },
];

export const footerNavigation = {
  product: [
    { name: "Özellikler", href: "#features" },
    { name: "Fiyatlandırma", href: "#pricing" },
    { name: "Sektörler", href: "#sectors" },
    { name: "Demo Talep", href: "#demo" },
  ],
  company: [
    { name: "Hakkımızda", href: "/about" },
    { name: "Blog", href: "/blog" },
    { name: "İletişim", href: "/contact" },
  ],
  legal: [
    { name: "Gizlilik Politikası", href: "/privacy" },
    { name: "Kullanım Koşulları", href: "/terms" },
    { name: "KVKK", href: "/kvkk" },
  ],
};
```

---

## 2. Stripe/iyzico Ödeme Akışı (Referans)

Open SaaS'ın Stripe flow'u 3 katmanlı ve temiz. BPS için Next.js + Supabase versiyonu:

### 2.1 Plan Tanımı

```typescript
// src/lib/payment/plans.ts

export enum SubscriptionStatus {
  Active = "active",
  PastDue = "past_due",
  CancelAtPeriodEnd = "cancel_at_period_end",
  Canceled = "canceled",
  Trialing = "trialing",
}

export enum PaymentPlanId {
  Baslangic = "baslangic",
  Profesyonel = "profesyonel",
  Kurumsal = "kurumsal",
}

export interface PaymentPlan {
  id: PaymentPlanId;
  name: string;
  priceMonthly: number; // TL cinsinden
  priceYearly: number;  // TL cinsinden (yıllık indirimli)
  stripePriceIdMonthly: string;  // Stripe'dan gelecek
  stripePriceIdYearly: string;
  maxUsers: number;
  features: string[];
}

export const paymentPlans: Record<PaymentPlanId, PaymentPlan> = {
  [PaymentPlanId.Baslangic]: {
    id: PaymentPlanId.Baslangic,
    name: "Başlangıç",
    priceMonthly: 5000,
    priceYearly: 50000, // 2 ay ücretsiz
    stripePriceIdMonthly: "", // Stripe dashboard'dan alınacak
    stripePriceIdYearly: "",
    maxUsers: 5,
    features: ["Core 10 modül", "1 sektör şablonu", "Excel import/export", "Email destek"],
  },
  [PaymentPlanId.Profesyonel]: {
    id: PaymentPlanId.Profesyonel,
    name: "Profesyonel",
    priceMonthly: 9000,
    priceYearly: 90000,
    stripePriceIdMonthly: "",
    stripePriceIdYearly: "",
    maxUsers: 15,
    features: ["Firma Sağlık Skoru", "Luca/Logo entegrasyonu", "PDKS entegrasyonu", "Öncelikli destek"],
  },
  [PaymentPlanId.Kurumsal]: {
    id: PaymentPlanId.Kurumsal,
    name: "Kurumsal",
    priceMonthly: 15000,
    priceYearly: 150000,
    stripePriceIdMonthly: "",
    stripePriceIdYearly: "",
    maxUsers: -1, // sınırsız
    features: ["Tüm modüller", "AI Insight", "WhatsApp", "Dedicated destek", "Özel entegrasyon"],
  },
};
```

### 2.2 Checkout API Route

```typescript
// src/app/api/payment/checkout/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { paymentPlans, PaymentPlanId } from "@/lib/payment/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId, billingPeriod } = await request.json();
  const plan = paymentPlans[planId as PaymentPlanId];
  
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = billingPeriod === "yearly" 
    ? plan.stripePriceIdYearly 
    : plan.stripePriceIdMonthly;

  // Ensure Stripe customer exists
  let customerId: string;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", user.user_metadata.tenant_id)
    .single();

  if (tenant?.stripe_customer_id) {
    customerId = tenant.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { tenant_id: user.user_metadata.tenant_id },
    });
    customerId = customer.id;
    
    await supabase
      .from("tenants")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.user_metadata.tenant_id);
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { tenant_id: user.user_metadata.tenant_id, plan_id: planId },
  });

  return NextResponse.json({ sessionUrl: session.url });
}
```

### 2.3 Webhook Handler

```typescript
// src/app/api/payment/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // webhook'ta service role kullan
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  switch (event.type) {
    case "invoice.paid":
      await handleInvoicePaid(event);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event);
      break;
    default:
      // Unhandled event — log but don't error
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleInvoicePaid(event: Stripe.InvoicePaidEvent) {
  const invoice = event.data.object;
  const customerId = typeof invoice.customer === "string" 
    ? invoice.customer 
    : invoice.customer?.id;

  if (!customerId) return;

  await supabase
    .from("tenants")
    .update({
      subscription_status: "active",
      last_payment_date: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
}

async function handleSubscriptionUpdated(event: Stripe.CustomerSubscriptionUpdatedEvent) {
  const subscription = event.data.object;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  let status = "active";
  if (subscription.cancel_at_period_end) status = "cancel_at_period_end";
  if (subscription.status === "past_due") status = "past_due";

  await supabase
    .from("tenants")
    .update({ subscription_status: status })
    .eq("stripe_customer_id", customerId);
}

async function handleSubscriptionDeleted(event: Stripe.CustomerSubscriptionDeletedEvent) {
  const subscription = event.data.object;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  await supabase
    .from("tenants")
    .update({ subscription_status: "canceled" })
    .eq("stripe_customer_id", customerId);
}
```

### 2.4 Gerekli Env Variables

```env
# .env.local (eklenmeli)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2.5 Supabase Tablo (tenants'a eklenecek)

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
```

---

## 3. Kopyalanmayan Şeyler (ve Neden)

| Open SaaS Özellik | Neden Kopyalanmadı |
|-------|----------|
| Wasp framework | BPS zaten Next.js — framework değiştirmek rewrite demek |
| Prisma ORM | BPS Supabase doğrudan kullanıyor — Prisma gereksiz katman |
| Social login (GitHub, Google) | B2B ürünlerinde gereksiz — email/password yeterli |
| AI demo app | BPS kendi AI stratejisi var (AI_ARCHITECTURE.md) |
| LemonSqueezy / Polar | Türkiye'de Stripe veya iyzico tercih — LS/Polar Türkiye'de zayıf |
| Admin dashboard analytics | BPS kendi admin mimarisi var (ADMIN_ARCHITECTURE.md) |
| Email templates | Sonra eklenecek — şimdi öncelik değil |
| File upload (S3) | BPS Supabase Storage kullanıyor |

---

## 4. İmplementasyon Sırası (BPS Evre 1-2)

| Sıra | İş | Evre | Kaynak |
|------|-----|------|--------|
| 1 | Landing page (Hero + Features + Pricing + FAQ + CTA) | Evre 1B | Bu doküman §1 |
| 2 | Demo talep formu (Supabase'e kaydet) | Evre 1B | Basit form |
| 3 | Stripe hesabı aç + ürünleri tanımla | Evre 2 | Stripe dashboard |
| 4 | Checkout API route | Evre 2 | Bu doküman §2.2 |
| 5 | Webhook handler | Evre 2 | Bu doküman §2.3 |
| 6 | Tenant subscription status | Evre 2 | Bu doküman §2.5 |
| 7 | Müşteri portalı (Stripe Customer Portal) | Evre 2 | Stripe built-in |

---

*Bu doküman referans — source-of-truth'a alınmaz.*
*Open SaaS kodu kopyalanmadı — akış ve yapı adapte edildi.*
*BPS stack'i değişmedi: Next.js + Supabase + Tailwind.*
