/* =========================================================
   00 音效 / 背景音乐
   ---------------------------------------------------------
   为什么排在最前面：check.mjs 要求"用到的函数必须在更早的文件里定义"，
   音效要被 08/11/16/17 这些模块调用，所以它得先加载。

   两类声音：
     · 文件音频 —— 背景音乐 audio/bgm.m4a（循环）、胜利音效 audio/victory.m4a
     · 合成音效 —— 用 Web Audio 现场合成，不占体积、不会加载失败：
       出兵 / 命中 / 阵亡 / 升级 / 解锁骑兵 / 奶鲸砸下 / 技能 / 炮塔开火 / 点按钮
       以及一个合成的"战败"小调（用户只给了胜利音效）

   浏览器的自动播放策略要求"先有用户手势"才能出声，
   所以 AudioContext 是第一次点击/按键时才创建的（见 unlockAudio）。
   ========================================================= */

const AUDIO_DIR = 'audio/';
const AUDIO_VOLUME = { bgm: 0.34, sfx: 0.55 };

/* 没有 <audio>（比如无头测试沙箱）就整体静音，绝不抛错 */
const AUDIO_OK = (typeof Audio !== 'undefined');

let audioCtx = null;
let bgmEl = null;
let audioMuted = false;

/* ---------------- 背景音乐（文件，循环） ---------------- */
function startBgm() {
  if (!AUDIO_OK) return;
  if (!bgmEl) {
    bgmEl = new Audio(AUDIO_DIR + 'bgm.m4a');
    bgmEl.loop = true;
    bgmEl.volume = AUDIO_VOLUME.bgm;
    bgmEl.preload = 'auto';
  }
  if (audioMuted) return;
  const p = bgmEl.play();
  if (p && p.catch) p.catch(() => {});   // 浏览器不给放就安静算了，不弹错
}

function stopBgm() {
  if (bgmEl) bgmEl.pause();
}

function setMuted(m) {
  audioMuted = !!m;
  if (bgmEl) bgmEl.volume = audioMuted ? 0 : AUDIO_VOLUME.bgm;
  if (!audioMuted && bgmEl && bgmEl.paused && game && game.started) {
    const p = bgmEl.play();
    if (p && p.catch) p.catch(() => {});
  }
}

function toggleMute() {
  setMuted(!audioMuted);
  if (SFX.deny) SFX.deny();
  return audioMuted;
}

function isMuted() { return audioMuted; }

/* ---------------- 合成音效 ---------------- */
function unlockAudio() {
  if (typeof window === 'undefined') return null;
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
  return audioCtx;
}

/* 一个带包络的振荡器音 */
function tone(freq, dur, type, gain, slideTo, delay) {
  if (audioMuted || !unlockAudio()) return;
  const t0 = audioCtx.currentTime + (delay || 0);  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const peak = (gain || 0.25) * AUDIO_VOLUME.sfx;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* 一小段噪声（打击感 / 爆裂） */
function noise(dur, gain, freq, delay) {
  if (audioMuted || !unlockAudio()) return;
  const t0 = audioCtx.currentTime + (delay || 0);
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const f = audioCtx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq || 900;
  const g = audioCtx.createGain();
  g.gain.value = (gain || 0.22) * AUDIO_VOLUME.sfx;
  src.connect(f).connect(g).connect(audioCtx.destination);
  src.start(t0);
}

/* 播放一个已有的音频文件（胜利音效走这里） */
function playFile(name, volume) {
  if (audioMuted || !AUDIO_OK) return;
  try {
    const el = new Audio(AUDIO_DIR + name);
    el.volume = volume === undefined ? AUDIO_VOLUME.sfx : volume;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* 放不出来就算了 */ }
}

/* ---------------- 对外接口 ----------------
   用 `名字: () => {...}` 而不是对象方法简写 `名字() {...}`：
   check.mjs 的跨文件检查会把"裸调用"形状的 `spawn(` 误判成"用了但没定义"。 */
const SFX = {
  spawn:     () => { tone(520, 0.07, 'square', 0.18, 760); },
  shoot:     () => { tone(880, 0.06, 'triangle', 0.14, 380); },
  hit:       () => { noise(0.06, 0.16, 1500); tone(220, 0.05, 'square', 0.10, 150); },
  die:       () => { tone(300, 0.16, 'sawtooth', 0.16, 90); },
  deny:      () => { tone(180, 0.09, 'square', 0.16, 120); },
  click:     () => { tone(660, 0.04, 'square', 0.12, 880); },
  upgrade:   () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.16, null, i * 0.07)); },
  unlock:    () => { [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, null, i * 0.06)); },
  turret:    () => { tone(700, 0.07, 'sawtooth', 0.13, 300); },
  skill:     () => { [523, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.20, null, i * 0.09)); },
  whale:     () => { tone(160, 0.45, 'sine', 0.30, 60); noise(0.35, 0.24, 320); },
  bossLevel: () => { [330, 294, 262, 196].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.17, null, i * 0.10)); },
  victory:   () => { stopBgm(); playFile('victory.m4a', 0.75); },
  defeat:    () => { stopBgm(); [392, 349, 311, 262, 196].forEach((f, i) => tone(f, 0.34, 'triangle', 0.22, null, i * 0.20)); },
};
