'use client';
import { useNotificationSound } from '@/context/NotificationSoundContext';

export default function NotificationSoundControls({ compact = false }: { compact?: boolean }) {
  const sound = useNotificationSound();
  const button = 'min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600';
  return <div className={compact ? 'space-y-2' : 'space-y-3'}>
    <p className="text-sm text-slate-700" role="status">{!sound.ready ? 'Ses tercihi yükleniyor…' : sound.active ? 'Bu sekmede ses açık.' : sound.preferred ? 'Ses tercihiniz açık. Bu sekmede etkinleştirin.' : 'Bildirim sesi kapalı.'}</p>
    <div className="flex flex-wrap gap-2">
      {!sound.active && <button type="button" className={button} disabled={!sound.ready || sound.busy} onClick={() => void sound.enable()}>{sound.busy ? 'Ses açılıyor…' : sound.preferred ? 'Bu sekmede etkinleştir' : 'Sesi aç'}</button>}
      {sound.active && <button type="button" className={button} onClick={() => sound.play()}>Deneme sesi</button>}
      {(sound.active || sound.preferred || sound.busy) && <button type="button" className={button} onClick={sound.disable}>Sesi kapat</button>}
    </div>
    {!compact && <p className="text-sm leading-6 text-slate-500">Tercih bu tarayıcıda, hesabınız ve seçili şirket için hatırlanır. Yeni sekmede veya sayfayı yeniden açtığınızda sesi bir kez etkinleştirmeniz gerekir. Sesi kapatmak aynı hesaba ve şirkete ait diğer açık sekmeleri de susturur. Bu ayar e-posta veya telefon bildirimi açmaz.</p>}
    {sound.message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{sound.message}</p>}
  </div>;
}
