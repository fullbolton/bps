import { inboxScopeKey, type InboxScope } from './inbox-state';

export type SoundSettings = { ready: boolean; preferred: boolean; active: boolean; busy: boolean; message: string };
export const INITIAL_SOUND: SoundSettings = { ready: false, preferred: false, active: false, busy: false, message: '' };
type Tone = { enable(): Promise<void>; play(): boolean; close(): void };
type Dependencies = {
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  supportsLocks: () => boolean;
  tone: () => Tone;
  visible: () => boolean;
};
export function soundPreferenceKey(scope: InboxScope) { return 'bps:inbox-preference:v1:' + inboxScopeKey(scope); }
export function parseSoundPreference(value: string | null) {
  if (value === null || value === 'off') return false;
  if (value === 'on') return true;
  throw Error('SOUND_PREFERENCE');
}

/** A saved choice never starts audio: activation always follows a user gesture.
 * Storage contains only on/off under the account/company key, never message data. */
export function createSoundSettings(scope: InboxScope, deps: Dependencies, changed: (state: SoundSettings) => void) {
  const key = soundPreferenceKey(scope);
  let state = { ...INITIAL_SOUND }, mounted = false, generation = 0, tone: Tone | null = null;
  const publish = (patch: Partial<SoundSettings>) => { state = { ...state, ...patch }; if (mounted) changed(state); };
  const stop = () => { ++generation; tone?.close(); tone = null; };
  function sync() {
    if (!mounted) return;
    try {
      const preferred = parseSoundPreference(deps.storage().getItem(key));
      if (!preferred) stop();
      publish({ ready: true, preferred, active: preferred && state.active, busy: preferred && state.busy, message: '' });
    } catch { stop(); publish({ ready: true, preferred: false, active: false, busy: false, message: 'Ses tercihi okunamadı. Ses kapalı; görsel bildirimler devam eder.' }); }
  }
  async function enable() {
    if (!mounted || state.busy) return;
    const attempt = ++generation;
    publish({ busy: true, message: '' });
    try {
      if (!deps.supportsLocks()) throw Error('SOUND_UNAVAILABLE');
      // Detect denied storage before opening the audio device.
      deps.storage().getItem(key);
      const currentTone = tone ?? (tone = deps.tone());
      await currentTone.enable();
      if (!mounted || attempt !== generation) return;
      deps.storage().setItem(key, 'on');
      publish({ preferred: true, active: true, ready: true, busy: false });
      if (!currentTone.play()) throw Error('SOUND_BLOCKED');
    } catch {
      if (!mounted || attempt !== generation) return;
      stop(); publish({ active: false, busy: false, ready: true, message: 'Ses açılamadı. Tarayıcı izinlerini kontrol edip yeniden deneyin. Görsel bildirimler devam eder.' });
    }
  }
  function disable() {
    if (!mounted) return;
    stop();
    publish({ active: false, busy: false });
    try { deps.storage().setItem(key, 'off'); publish({ ready: true, preferred: false, message: 'Ses kapalı. Tercihiniz bu tarayıcıda kaydedildi.' }); }
    catch { publish({ ready: true, preferred: false, message: 'Bu sekmede ses kapatıldı, ancak tercih kaydedilemedi. Diğer sekmelerde ayrıca kapatmanız gerekebilir.' }); }
  }
  function play() {
    if (!mounted || !state.active || !deps.visible()) return false;
    try {
      if (!parseSoundPreference(deps.storage().getItem(key))) { sync(); return false; }
      if (tone?.play()) return true;
      throw Error('SOUND_BLOCKED');
    } catch { stop(); publish({ active: false, busy: false, message: 'Ses durduruldu. Bu sekmede yeniden etkinleştirebilirsiniz.' }); return false; }
  }
  return {
    mount() { mounted = true; sync(); },
    dispose() { mounted = false; stop(); state = { ...INITIAL_SOUND }; },
    storageChanged(eventKey: string | null) { if (eventKey === null || eventKey === key) sync(); },
    enable, disable, play,
    fail() { if (mounted) { stop(); publish({ active: false, busy: false, message: 'Bildirim sesi kullanılamıyor. Görsel bildirimler devam eder.' }); } },
  };
}
