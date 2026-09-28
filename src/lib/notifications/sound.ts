/** Audio must be activated by a user gesture. No remote sound assets or autoplay. */
export function createInboxTone() {
 let context:AudioContext|null=null;
 function play():boolean {
  if(!context||context.state!=='running')return false;
  const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime;
  oscillator.type='sine';oscillator.frequency.setValueAtTime(660,start);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(0.08,start+0.025);gain.gain.exponentialRampToValueAtTime(0.001,start+0.22);
  oscillator.connect(gain);gain.connect(context.destination);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  oscillator.start(start);oscillator.stop(start+0.24);return true;
 }
 return {
  async enable(){
   if(!context)context=new AudioContext();
   await context.resume();
   if(context.state!=='running')throw Error('SOUND_BLOCKED');
   play();
  },
  play,
  close(){const old=context;context=null;if(old)void old.close().catch(()=>{});},
 };
}
