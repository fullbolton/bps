"use client";

/**
 * BPS Landing Page — public root route.
 * Premium dark SaaS aesthetic (Sync-inspired): near-black canvas, cyan→blue
 * gradient accent, soft glows, rounded glass cards, a polished product mockup
 * in the hero, framer-motion animations. Content + demo-request flow unchanged.
 * Scoped to this page — the authenticated app keeps its own (light) theme.
 */

import { useState } from "react";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  Building2,
  FileText,
  CalendarCheck,
  ListChecks,
  FolderOpen,
  Users,
  CheckCircle,
  ArrowRight,
  ArrowUpRight,
  Shield,
  Sparkles,
  Clock,
  Send,
  LayoutDashboard,
  Bell,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";
import { archivo, publicSans } from "./_landing-fonts";

const head = { fontFamily: "var(--font-archivo), system-ui, sans-serif" } as const;

// ── Animation primitives ───────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const VIEWPORT = { once: true, amount: 0.2 } as const;

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp} initial="hidden" whileInView="show" viewport={VIEWPORT}>
      {children}
    </motion.div>
  );
}

// ── Data ───────────────────────────────────────────────────────────────────
const SECTOR_ICONS: Record<SectorCode, typeof Shield> = {
  guvenlik: Shield,
  temizlik: Sparkles,
  personel_temin: Users,
  osgb: FileText,
  lojistik: Building2,
  danismanlik: CalendarCheck,
  tesis_yonetimi: Building2,
  insaat: ListChecks,
};

const FAQ_ITEMS = [
  { q: "BPS kimler icin?", a: "B2B hizmet firmalari icin: guvenlik, temizlik, personel temin, OSGB, lojistik, danismanlik, tesis yonetimi ve insaat taseron firmalari." },
  { q: "Muhasebe programi mi?", a: "Hayir. BPS muhasebe yazilimi degildir. Mevcut muhasebe programinizla birlikte calisir. BPS operasyonel takip ve yonetim gorunurlugu saglar." },
  { q: "CRM mi?", a: "Hayir. BPS genel bir CRM degildir. Firma portfoyu, sozlesme yasam dongusu, gorev takibi ve evrak uyumu odakli bir operasyon platformudur." },
  { q: "Nasil baslanir?", a: "Demo talebinizi gonderin, size uygun bir tanitim gorusmesi planlayalim. Mevcut Excel/CSV verilerinizle kontrollu bir baslangic aktarimi yaparak ilerleyebiliriz." },
  { q: "Demo nasil isler?", a: "Canli bir demo ortaminda BPS'i birlikte inceliyoruz. Sektorunuze ozel sablonlarla nasil calisacaginizi gosteriyoruz. Ortalama 30 dakika." },
  { q: "Verilerimiz guvende mi?", a: "BPS, verileri Avrupa bolgesinde barindirilan altyapi uzerinde calisacak sekilde kuruludur. Erisim rol ve kapsam mantigiyla sinirlandirilir; firma bazli izolasyon temel calisma modelidir." },
];

const FEATURES = [
  { icon: Building2, title: "Firma Portfoyu", desc: "Tum musterilerinizi tek ekranda gorun. Firma bazli saglik durumu, risk sinyalleri ve operasyonel ozet." },
  { icon: FileText, title: "Sozlesme Yasam Dongusu", desc: "Sozlesmeleri olusturun, takip edin, yenileme sureclerini yonetin. Suresi yaklasan sozlesmeleri kacirmayin." },
  { icon: ListChecks, title: "Gorev ve Randevu Takibi", desc: "Gorevleri atayin, takip edin, geciken isleri gorun. Randevu sonrasi aksiyon disiplinini koruyun." },
  { icon: FolderOpen, title: "Evrak ve Uyum", desc: "Eksik ve suresi dolan evraklari aninda gorun. Sektore ozel belge sablon listeleriyle baslayin." },
  { icon: Clock, title: "Kritik Tarihler", desc: "Sirket geneli onemli tarihleri ve son basvuru gunlerini tek yerden takip edin." },
  { icon: Sparkles, title: "Sektor Sablonlari", desc: "8 sektor icin hazir evrak, gorev ve sozlesme sablonlari. Sektorunuze ozel baslangic." },
];

// ── Small UI bits ──────────────────────────────────────────────────────────
function Eyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {index && <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#22D3EE]">{index}</span>}
      <span className="h-px w-8 bg-gradient-to-r from-[#22D3EE] to-transparent" />
      <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#94A3B8]">{label}</span>
    </div>
  );
}

// Polished BPS product preview shown in the hero (CSS/SVG, no image asset).
function DashboardMock() {
  return (
    <div className="relative">
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-16 bottom-0 -z-10 blur-2xl"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(34,211,238,0.22) 0%, rgba(59,130,246,0.10) 40%, transparent 75%)" }}
      />
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1d] shadow-2xl shadow-black/60 ring-1 ring-white/5">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex-1 rounded-md bg-white/[0.04] px-3 py-1 text-center text-[10px] text-[#64748B]">
            app.bpsys.net / dashboard
          </div>
        </div>
        <div className="flex">
          {/* sidebar */}
          <div className="hidden w-12 shrink-0 flex-col items-center gap-4 border-r border-white/10 bg-white/[0.02] py-4 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#22D3EE]/15 text-[#22D3EE]">
              <LayoutDashboard size={15} />
            </div>
            {[Building2, FileText, ListChecks, FolderOpen].map((Ic, i) => (
              <Ic key={i} size={15} className="text-[#475569]" />
            ))}
          </div>
          {/* main */}
          <div className="min-w-0 flex-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-[#64748B]">Merhaba, Operasyon</div>
                <div className="text-sm font-bold text-[#F8FAFC]" style={head}>Bugunun ozeti</div>
              </div>
              <Bell size={14} className="text-[#475569]" />
            </div>
            {/* stat cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { l: "Aktif Firma", v: "128", t: "+6", up: true },
                { l: "Yaklasan Sozlesme", v: "14", t: "+3", up: true },
                { l: "Eksik Evrak", v: "7", t: "-2", up: false },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="truncate text-[9px] text-[#64748B]">{s.l}</div>
                  <div className="mt-1 flex items-end justify-between">
                    <span className="text-lg font-bold text-[#F8FAFC]">{s.v}</span>
                    <span className={`flex items-center gap-0.5 text-[9px] ${s.up ? "text-[#22D3EE]" : "text-[#F59E0B]"}`}>
                      {s.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{s.t}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* chart */}
            <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#CBD5E1]">Operasyon Yogunlugu</span>
                <span className="text-[9px] text-[#64748B]">Son 6 ay</span>
              </div>
              <svg viewBox="0 0 320 70" className="h-16 w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,55 L46,42 L92,48 L138,30 L184,34 L230,18 L276,24 L320,10 L320,70 L0,70 Z" fill="url(#g)" />
                <path d="M0,55 L46,42 L92,48 L138,30 L184,34 L230,18 L276,24 L320,10" fill="none" stroke="#22D3EE" strokeWidth="2" />
              </svg>
            </div>
            {/* company rows */}
            <div className="mt-2.5 space-y-1.5">
              {[
                { n: "Akdeniz Lojistik A.S.", s: "Aktif", ok: true },
                { n: "Marmara Guvenlik Ltd.", s: "Yaklasiyor", ok: false },
              ].map((r) => (
                <div key={r.n} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                  <span className="truncate text-[11px] text-[#CBD5E1]">{r.n}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] ${r.ok ? "bg-[#22D3EE]/15 text-[#22D3EE]" : "bg-[#F59E0B]/15 text-[#F59E0B]"}`}>{r.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`${archivo.variable} ${publicSans.variable} min-h-screen bg-[#04060d] text-[#F8FAFC] antialiased`}
        style={{ fontFamily: "var(--font-public-sans), system-ui, sans-serif" }}
      >
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#04060d]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#3B82F6]">
                <span className="text-sm font-black text-[#04060d]" style={head}>B</span>
              </div>
              <span className="text-lg font-black tracking-tight text-[#F8FAFC]" style={head}>BPS</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:text-[#F8FAFC]">Giris Yap</a>
              <a href="#demo" className="rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] px-5 py-2.5 text-sm font-bold tracking-wide text-[#04060d] shadow-lg shadow-[#22D3EE]/20 transition-shadow hover:shadow-[#22D3EE]/40">Demo Talep Et</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* glows */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-48 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.14) 0%, rgba(59,130,246,0.08) 45%, transparent 70%)" }}
            animate={{ opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.04),transparent_45%)]" />

          <motion.div
            className="relative mx-auto max-w-3xl px-4 pt-20 text-center sm:px-6 md:pt-28 lg:px-8"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={fadeUp} className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-[#CBD5E1] backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE]" />
                B2B Operasyon Platformu
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="mx-auto mt-7 max-w-3xl text-5xl font-black leading-[1.04] tracking-tight text-[#F8FAFC] sm:text-6xl lg:text-7xl"
              style={head}
            >
              Hizmet firmalariniz icin{" "}
              <span className="bg-gradient-to-r from-[#22D3EE] via-[#38BDF8] to-[#3B82F6] bg-clip-text text-transparent">
                operasyon merkezi
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#94A3B8]">
              Firma portfoyunuzu, sozlesmelerinizi, gorevlerinizi ve evraklarinizi tek platformda yonetin.
              Excel tablolari ve dagik takip arasinda kaybolmayin.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#demo" className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] px-7 py-3.5 text-sm font-bold tracking-[0.04em] text-[#04060d] shadow-lg shadow-[#22D3EE]/25 transition-shadow hover:shadow-[#22D3EE]/45">
                Demo Talep Et <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a href="#ozellikler" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-bold tracking-[0.04em] text-[#F8FAFC] backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/[0.07]">
                Neler yapabilirsiniz?
              </a>
            </motion.div>
          </motion.div>

          {/* product preview */}
          <motion.div
            className="relative mx-auto mt-16 max-w-5xl px-4 pb-24 sm:px-6 lg:px-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
          >
            <DashboardMock />
          </motion.div>
        </section>

        {/* Sectors / trust strip */}
        <section className="border-y border-white/10 bg-white/[0.015] py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#475569]">
              8 sektore ozel hazir sablonlar
            </p>
            <motion.div
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
            >
              {(Object.entries(SECTOR_LABELS) as [SectorCode, string][]).map(([code, label]) => {
                const Icon = SECTOR_ICONS[code] ?? Building2;
                return (
                  <motion.div key={code} variants={fadeUp} className="group flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center transition-colors hover:border-white/15 hover:bg-white/[0.05]">
                    <Icon size={20} className="text-[#64748B] transition-colors group-hover:text-[#22D3EE]" />
                    <p className="text-[11px] font-medium text-[#CBD5E1]">{label}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Problem */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <Eyebrow index="01" label="Tanidik geliyorsa" />
              <h2 className="mt-6 max-w-2xl text-3xl font-black tracking-tight text-[#F8FAFC] sm:text-4xl" style={head}>
                Operasyon, dagik araclar arasinda kayboluyor.
              </h2>
            </Reveal>
            <motion.div
              className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
            >
              {[
                { text: "Firma bilgileri farkli Excel dosyalarinda dagik", detail: "Kim hangi firmaya bakiyor, sozlesme ne zaman bitiyor, evraklar tamam mi — her seferinde farkli bir dosyaya bakmak zorundasiniz." },
                { text: "Sozlesme yenileme ve evrak suresi gozden kaciyor", detail: "Kritik tarihler Excel'de takip ediliyor ama hatirlatma yok. Suresi gecen belgeler ancak sorun olunca fark ediliyor." },
                { text: "Operasyonel takip WhatsApp gruplarinda kayboliyor", detail: "Gorusme sonuclari, gorev atamalari ve takipler mesaj akisinda kayboluyor. Kim ne yapacakti, ne oldu — belirsiz." },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition-colors hover:border-white/20">
                  <span className="font-mono text-sm text-[#22D3EE]/70">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-[#F8FAFC]">{item.text}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{item.detail}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Solution */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <div className="flex justify-center"><Eyebrow index="02" label="Cozum" /></div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-[#F8FAFC] sm:text-4xl" style={head}>
                BPS: firma merkezli operasyon omurgasi
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[#94A3B8]">
                BPS, hizmet firmalarinin musteri portfoyunu, sozlesme yasam dongusunu, gorev ve randevu takibini,
                evrak uyumunu ve yonetim gorunurlugunu tek platformda birlestiren bir operasyon sistemidir.
                Mevcut duzeninizi bir anda degistirmek zorunda degilsiniz; Excel/CSV verilerinizi kontrollu bir
                baslangic aktarimiyla iceri alin, sektorunuze ozel sablonlarla ilerleyin.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="ozellikler" className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <div className="flex justify-center"><Eyebrow index="03" label="Yetkinlikler" /></div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-[#F8FAFC] sm:text-4xl" style={head}>Neler yapabilirsiniz?</h2>
            </Reveal>
            <motion.div
              className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition-colors hover:border-[#22D3EE]/30"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#22D3EE]/20 to-[#3B82F6]/10 ring-1 ring-inset ring-white/10">
                    <f.icon size={20} className="text-[#22D3EE]" />
                  </div>
                  <h3 className="mt-5 text-base font-bold tracking-tight text-[#F8FAFC]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <div className="flex justify-center"><Eyebrow index="04" label="SSS" /></div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-[#F8FAFC] sm:text-4xl" style={head}>Sik Sorulan Sorular</h2>
            </Reveal>
            <motion.div
              className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
            >
              {FAQ_ITEMS.map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{item.a}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Demo Request Form */}
        <section id="demo" className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-xl">
              <div className="flex justify-center"><Eyebrow index="05" label="Demo" /></div>
              <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-[#F8FAFC] sm:text-4xl" style={head}>Demo Talep Edin</h2>
              <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-[#94A3B8]">
                Talebinizi birakin, ekibimiz sizinle iletisime gecip uygun bir tanitim gorusmesi planlasin. Ortalama 30 dakikada BPS&apos;i birlikte kesfedelim.
              </p>
              <div className="relative mt-10">
                <div aria-hidden className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(60%_60%_at_50%_0%,rgba(34,211,238,0.10),transparent_70%)]" />
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm sm:p-9">
                  <DemoRequestForm />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#3B82F6]">
                <span className="text-xs font-black text-[#04060d]" style={head}>B</span>
              </div>
              <span className="text-sm text-[#94A3B8]">BPS — B2B Operasyon Platformu</span>
            </div>
            <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] transition-colors hover:text-[#22D3EE]">
              Giris Yap <ArrowUpRight size={14} />
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

// ---------------------------------------------------------------------------
// Demo Request Form Component (logic unchanged — only restyled)
// ---------------------------------------------------------------------------

function DemoRequestForm() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = fullName.trim() && companyName.trim() && email.trim() && email.includes("@");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          company_name: companyName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          sector: sector || null,
          company_size: companySize || null,
          message: message.trim() || null,
          website, // honeypot — server rejects silently if filled
        }),
      });

      const data = await res.json();
      if (!res.ok && data.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gonderim basarisiz. Lutfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-8 text-center">
        <CheckCircle size={40} className="mx-auto mb-4 text-[#22D3EE]" />
        <h3 className="mb-2 text-lg font-bold text-[#F8FAFC]" style={head}>Demo talebiniz alindi.</h3>
        <p className="text-sm text-[#94A3B8]">Ekibimiz sizinle iletisime gecerek uygun bir tanitim gorusmesi planlayacak.</p>
      </div>
    );
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#475569] transition-colors focus:border-[#22D3EE]/60 focus:outline-none focus:ring-1 focus:ring-[#22D3EE]/40";
  const labelClass = "mb-1.5 block text-sm font-medium text-[#CBD5E1]";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from users, catches bots */}
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      <div>
        <label className={labelClass}>Ad Soyad <span className="text-[#22D3EE]">*</span></label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adiniz Soyadiniz" className={inputClass} disabled={submitting} />
      </div>
      <div>
        <label className={labelClass}>Firma Adi <span className="text-[#22D3EE]">*</span></label>
        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Firmanizin adi" className={inputClass} disabled={submitting} />
      </div>
      <div>
        <label className={labelClass}>E-posta <span className="text-[#22D3EE]">*</span></label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@firma.com" className={inputClass} disabled={submitting} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Telefon</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XXXX" className={inputClass} disabled={submitting} />
        </div>
        <div>
          <label className={labelClass}>Sektor</label>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className={inputClass} disabled={submitting}>
            <option value="">Secin (opsiyonel)</option>
            {(Object.entries(SECTOR_LABELS) as [SectorCode, string][]).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Firma Buyuklugu</label>
        <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className={inputClass} disabled={submitting}>
          <option value="">Secin (opsiyonel)</option>
          <option value="1-10">1-10 calisan</option>
          <option value="11-50">11-50 calisan</option>
          <option value="51-200">51-200 calisan</option>
          <option value="200+">200+ calisan</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Mesaj</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Eklemek istediginiz bir not var mi?" rows={3} className={`${inputClass} resize-none`} disabled={submitting} />
      </div>
      <button
        type="submit"
        disabled={!isValid || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#38BDF8] px-6 py-3 text-sm font-bold tracking-[0.04em] text-[#04060d] shadow-lg shadow-[#22D3EE]/25 transition-shadow hover:shadow-[#22D3EE]/45 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {submitting ? "Gonderiliyor..." : <><Send size={16} /> Demo Talep Et</>}
      </button>
    </form>
  );
}
