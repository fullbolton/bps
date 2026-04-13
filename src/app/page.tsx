"use client";

/**
 * BPS Landing Page — public root route.
 * Evre 1B: demo-oriented, Turkish, B2B service platform positioning.
 */

import { useState } from "react";
import {
  Building2,
  FileText,
  CalendarCheck,
  ListChecks,
  FolderOpen,
  Users,
  CheckCircle,
  ArrowRight,
  Shield,
  Sparkles,
  Clock,
  Send,
} from "lucide-react";
import { SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";

// ---------------------------------------------------------------------------
// Sector icons mapping
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------
const FAQ_ITEMS = [
  { q: "BPS kimler icin?", a: "B2B hizmet firmalari icin: guvenlik, temizlik, personel temin, OSGB, lojistik, danismanlik, tesis yonetimi ve insaat taseron firmalari." },
  { q: "Muhasebe programi mi?", a: "Hayir. BPS muhasebe yazilimi degildir. Mevcut muhasebe programinizla birlikte calisir. BPS operasyonel takip ve yonetim gorunurlugu saglar." },
  { q: "CRM mi?", a: "Hayir. BPS genel bir CRM degildir. Firma portfoyu, sozlesme yasam dongusu, gorev takibi ve evrak uyumu odakli bir operasyon platformudur." },
  { q: "Nasil baslanir?", a: "Demo talebinizi gonderin, size ozel bir tanitim gorusmesi ayarlayalim. Mevcut verilerinizi Excel ile kolayca aktarabilirsiniz." },
  { q: "Demo nasil isler?", a: "Canli bir demo ortaminda BPS'i birlikte inceliyoruz. Sektorunuze ozel sablonlarla nasil calisacaginizi gosteriyoruz. Ortalama 30 dakika." },
  { q: "Verilerimiz guvende mi?", a: "Evet. Verileriniz Avrupa'da barindirilan Supabase altyapisinda saklanir. Rol bazli erisim kontrolu ve firma bazli izolasyon standart olarak uygulanir." },
];

// ---------------------------------------------------------------------------
// Feature blocks
// ---------------------------------------------------------------------------
const FEATURES = [
  { icon: Building2, title: "Firma Portfoyu", desc: "Tum musterilerinizi tek ekranda gorun. Firma bazli saglik durumu, risk sinyalleri ve operasyonel ozet." },
  { icon: FileText, title: "Sozlesme Yasam Dongusu", desc: "Sozlesmeleri olusturun, takip edin, yenileme sureclerini yonetin. Suresi yaklasan sozlesmeleri kacirmayin." },
  { icon: ListChecks, title: "Gorev ve Randevu Takibi", desc: "Gorevleri atayin, takip edin, geciken isleri gorun. Randevu sonrasi aksiyon disiplinini koruyun." },
  { icon: FolderOpen, title: "Evrak ve Uyum", desc: "Eksik ve suresi dolan evraklari aninda gorun. Sektore ozel belge sablon listeleriyle baslayin." },
  { icon: Clock, title: "Kritik Tarihler", desc: "Sirket geneli onemli tarihleri ve son basvuru gunlerini tek yerden takip edin." },
  { icon: Sparkles, title: "Sektor Sablonlari", desc: "8 sektor icin hazir evrak, gorev ve sozlesme sablonlari. Sektorunuze ozel baslangic." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="text-base font-semibold text-slate-900">BPS</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Giris Yap</a>
            <a href="#demo" className="text-sm font-medium text-white bg-slate-900 px-4 py-2 rounded-md hover:bg-slate-800 transition-colors">Demo Talep Et</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Hizmet firmalariniz icin
            <br />
            operasyon merkezi
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-2xl">
            Firma portfoyunuzu, sozlesmelerinizi, gorevlerinizi ve evraklarinizi tek platformda yonetin.
            Excel tablolari ve dagik takip arasinda kaybolmayin.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <a href="#demo" className="inline-flex items-center gap-2 text-sm font-medium text-white bg-slate-900 px-6 py-3 rounded-md hover:bg-slate-800 transition-colors">
              Demo Talep Et <ArrowRight size={16} />
            </a>
            <a href="#ozellikler" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Neler yapabilirsiniz? →
            </a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Tanidik geliyorsa...</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[
              { text: "Firma bilgileri farkli Excel dosyalarinda dagik", detail: "Kim hangi firmaya bakiyor, sozlesme ne zaman bitiyor, evraklar tamam mi — her seferinde farkli bir dosyaya bakmak zorundasiniz." },
              { text: "Sozlesme yenileme ve evrak suresi gozden kaciyor", detail: "Kritik tarihler Excel'de takip ediliyor ama hatirlatma yok. Suresi gecen belgeler ancak sorun olunca fark ediliyor." },
              { text: "Operasyonel takip WhatsApp gruplarinda kayboliyor", detail: "Gorusme sonuclari, gorev atamalari ve takipler mesaj akisinda kayboluyor. Kim ne yapacakti, ne oldu — belirsiz." },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-5">
                <p className="text-sm font-medium text-slate-900">{item.text}</p>
                <p className="text-sm text-slate-500 mt-2">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">BPS: firma merkezli operasyon omurgasi</h2>
            <p className="text-base text-slate-600 leading-relaxed">
              BPS, hizmet firmalarinin musteri portfoyunu, sozlesme yasam dongusunu, gorev ve randevu takibini,
              evrak uyumunu ve yonetim gorunurlugunu tek platformda birlestiren bir operasyon sistemidir.
            </p>
            <p className="text-base text-slate-600 leading-relaxed mt-3">
              Kullandiginiz programlari degistirmiyoruz. Birlestiriyoruz.
              Mevcut Excel verilerinizi yukleyin, sektorunuze ozel sablonlarla baslayin.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="ozellikler" className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Neler yapabilirsiniz?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-5">
                <f.icon size={20} className="text-slate-700 mb-3" />
                <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sectors */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Sektorunuzu biliyoruz</h2>
          <p className="text-base text-slate-600 mb-8">
            8 sektor icin hazir sablonlar: evrak listeleri, gorev tipleri, sozlesme yapilari ve risk kriterleri sektorunuze ozel olarak gelir.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(Object.entries(SECTOR_LABELS) as [SectorCode, string][]).map(([code, label]) => {
              const Icon = SECTOR_ICONS[code] ?? Building2;
              return (
                <div key={code} className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                  <Icon size={24} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Sik Sorulan Sorular</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
                <p className="text-sm text-slate-500 mt-1.5">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Request Form */}
      <section id="demo" className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Demo Talep Edin</h2>
            <p className="text-sm text-slate-600 text-center mb-8">
              Size ozel bir tanitim gorusmesi ayarlayalim. 30 dakikada BPS'i birlikte kesfedelim.
            </p>
            <DemoRequestForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">B</span>
            </div>
            <span className="text-sm text-slate-500">BPS — B2B Operasyon Platformu</span>
          </div>
          <a href="/login" className="text-sm text-slate-500 hover:text-slate-700">Giris Yap</a>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo Request Form Component
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
      <div className="text-center py-8">
        <CheckCircle size={40} className="text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Talebiniz alindi!</h3>
        <p className="text-sm text-slate-600">En kisa surede sizinle iletisime gececegiz.</p>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from users, catches bots */}
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label className={labelClass}>Ad Soyad <span className="text-red-500">*</span></label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adiniz Soyadiniz" className={inputClass} disabled={submitting} />
      </div>
      <div>
        <label className={labelClass}>Firma Adi <span className="text-red-500">*</span></label>
        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Firmanizin adi" className={inputClass} disabled={submitting} />
      </div>
      <div>
        <label className={labelClass}>E-posta <span className="text-red-500">*</span></label>
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
        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Gonderiliyor..." : <><Send size={16} /> Demo Talep Et</>}
      </button>
    </form>
  );
}
