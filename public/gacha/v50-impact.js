/* v50-impact.js — 迫力の追加層(音の同期・衝撃波・文字の衝撃・PUSHの鼓動・ランク別の祝福)
   既存の reel.js / sword-reference.js は触らず、data-scene / data-phase の変化を見て動く。
   音は既存の score(GachaScore)の出力バスに流すので、ミュート・スキップ(score.stop)で一緒に止まる。
   AudioContext は新しく作らない(iPhone で鳴らなくなるため)。 */
(() => {
 'use strict';
 window.V50 = {
  /* フリーズ後の長さ(秒)。降臨の音(参考音源 descent-reference.mp3・12.6秒: 0-5.2秒 緊張 / 5.2-7.5秒 静寂 / 7.5秒〜 最高潮 / 11.8秒 解放)に合わせる */
  /* 虹色メダカが出る時刻(亀裂の開始から・秒)。音源の「ピュピピピピーン」(8.9〜9.45秒)に合わせる。ここを変えると下の長さが全部ついてくる */
  rainbowAt: 7.9,
  /* 亀裂 5.2秒(音の緊張) → エネルギー(静寂+爆発) → 虹色(音源の終わり 12.6秒まで) */
  get freezeDurations() { const g = +(this.rainbowAt - 5.2).toFixed(2); return { fire: [5.2, g], dragon: [5.2, g], blessing: [5.2, g] }; },
  get rainbowLen() { return +(12.6 - this.rainbowAt).toFixed(2); },
  /* 爆発(映像の山)の時刻: 亀裂の開始から 7.6秒 = 音の最高潮の立ち上がり */
  climaxAt: 7.2,
  /* 参考音源の構造(秒・音の頭から): 0-5.2 緊張 / 5.2-7.5 静寂 / 7.5-12.6 最高潮(12.6で終わり=虹色の終わり) */
  bed: { lull: [5.2, 7.5], length: 12.6 },
  /* 追加の音(上昇音・心拍・亀裂音・解放音など)と高域ブースト。既定OFF=音はCodex版と同じ(参考音源3本+元のBGM)。URLに ?sfx=1 で有効 */
  sfx: new URLSearchParams(location.search).get('sfx') === '1',
  airDb: new URLSearchParams(location.search).get('sfx') === '1' ? 5 : 0,
 };

 const host = document.querySelector('#stage,#screen');
 if (!host) return;
 /* ① 本番(播州オクからの呼び出し)用: URL ?rank=SS|S|A|B|C [&effect=auto|normal|chance|premium|freeze|revival|preview] で等級を固定する。
    固定時は「もう一度見る」で同じ景品を再生し、デモの設定欄は隠す。デモ(指定なし)は毎回抽選し直すので「もう一度試す」。 */
 /* 本番: ?draw=<当選記録ID> → /api/oripa/draws/<ID>(ログイン本人の記録だけ返る)を読み、等級・景品ID・名前・画像をその記録から出す。
    URLの ?rank= は本番では無視する(利用者が書き換えても景品は変わらない)。記録が読めなければ再生しない。 */
 V50.draw = null;
 const drawParam = new URLSearchParams(location.search).get('draw');
 const parentDraw = () => { try { return window.parent !== window && window.parent.V50 ? window.parent.V50.draw : null; } catch { return null; } };
 V50.record = () => V50.draw || parentDraw();
 function applyFixedUi(rank, effect) {
  const sel = document.querySelector('#rank'), eff = document.querySelector('#effect'), settings = document.querySelector('#settings');
  if (eff) { eff.value = ['auto', 'normal', 'chanceB', 'chanceA', 'chanceS', 'preview', 'premium', 'revival', 'freeze'].includes(effect) ? effect : 'auto'; eff.dispatchEvent(new Event('change')); }
  if (sel && !sel.disabled) sel.value = rank;
  if (settings) settings.hidden = true;
  for (const b of document.querySelectorAll('#again,#replay')) b.textContent = 'もう一度見る ↻';
 }
 if (drawParam && /^\d+$/.test(drawParam) && host.id !== 'screen') { /* isFire はこの後で定義されるので直接判定 */
  const start = document.querySelector('#start'), note = document.querySelector('.demo-note');
  if (start) { start.disabled = true; start.textContent = '当選記録を読み込み中…'; }
  fetch('/api/oripa/draws/' + drawParam, { credentials: 'same-origin', cache: 'no-store' }).then(async (r) => {
   const j = await r.json().catch(() => ({ ok: false, error: '読み込みに失敗しました。' }));
   if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
   V50.draw = j; applyFixedUi(j.rank, 'auto');
   if (note) note.textContent = j.package.name + '｜' + j.label + '「' + j.prize.name + '」（記録ID ' + j.id + '）の演出を再生します';
   if (start) { start.disabled = false; start.innerHTML = '演出をスタート <span>▶</span>'; }
  }).catch((e) => { if (note) note.textContent = '当選記録を読めませんでした（' + e.message + '）。播州オクにログインして、ご自身の当選から開いてください。'; if (start) { start.disabled = true; start.textContent = 'この記録は再生できません'; } if (V50.app && start) { start.disabled = false; start.textContent = '景品を確認する →'; start.onclick = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); V50.appPost('done'); }; } });
 }

 /* ===== 播州オクの中で流す(?app=1): くじを引いた直後に演出→「景品を確認する」で親画面へ戻る ===== */
 V50.app = new URLSearchParams(location.search).get('app') === '1' || (() => { try { return window.parent !== window && !!window.parent.V50 && !!window.parent.V50.app; } catch { return false; } })();
 const appPost = (action) => { try { const rec = V50.record(); window.top.postMessage({ type: 'banshu-gacha', action, draw: rec ? rec.id : null }, location.origin); } catch (e) { /* ignore */ } };
 V50.appPost = appPost;
 if (V50.app) {
  document.documentElement.classList.add('v50-app');
  /* 再生する等級は画面の選択肢ではなく、サーバーの記録だけから決める(記録が無ければ再生しない) */
  if (window.GachaRules && GachaRules.choose && !GachaRules._v50app) { const orig = GachaRules.choose; GachaRules.choose = (effect, rank, random) => { const rec = V50.record(); if (!rec) throw new Error('当選記録がありません'); /* 種類は常に「おまかせ」: チャンス/プレミア等の下限(floor)で等級が記録より上がるのを防ぐ */ const out = orig('auto', rec.rank, random); if (out.rank !== rec.rank) throw new Error('等級が記録と一致しません'); return out; }; GachaRules._v50app = true; }
  const back = document.querySelector('#back'), exit = document.querySelector('#exit');
  if (back) { back.textContent = '景品を確認する →'; back.onclick = (e) => { e.preventDefault(); appPost('done'); }; }
  if (exit) { exit.textContent = '× 景品へ'; exit.onclick = (e) => { e.preventDefault(); appPost('done'); }; }
  if (host.id !== 'screen') {
   /* テーマを選び直しても設定パネルを出さず、記録の文言を保つ(reel.js の syncThemeSettings の後に動く) */
   for (const b of document.querySelectorAll('.theme-picker button')) b.addEventListener('click', () => { const s = document.querySelector('#settings'); if (s) s.hidden = true; const rec = V50.record(), note = document.querySelector('.demo-note'); if (rec && note) note.textContent = rec.package.name + '｜' + rec.label + '「' + rec.prize.name + '」の演出を再生します'; });
   const brand = document.querySelector('#brand'); if (brand) brand.onclick = (e) => { e.preventDefault(); };
   /* 炎(内側の枠)にも app=1 を渡す(親の読み込み順に頼らない) */
   const ifr = document.getElementById('sword-embed'); if (ifr && !/[?&]app=1/.test(ifr.getAttribute('src') || '')) ifr.setAttribute('src', ifr.getAttribute('src') + '&app=1');
  }
 }
 V50.fixed = (() => {
  const q = new URLSearchParams(location.search), rank = (q.get('rank') || '').toUpperCase(), effect = q.get('effect') || 'auto';
  if (drawParam) return null; /* 本番モードでは ?rank= を根拠にしない */
  if (!['SS', 'S', 'A', 'B', 'C'].includes(rank)) return null;
  const sel = document.querySelector('#rank'), eff = document.querySelector('#effect'), settings = document.querySelector('#settings');
  if (eff) { eff.value = ['auto', 'normal', 'chanceB', 'chanceA', 'chanceS', 'preview', 'premium', 'revival', 'freeze'].includes(effect) ? effect : 'auto'; eff.dispatchEvent(new Event('change')); }
  if (sel && !sel.disabled) sel.value = rank;
  if (settings) settings.hidden = true;
  for (const b of document.querySelectorAll('#again,#replay')) b.textContent = 'もう一度見る ↻';
  const note = document.querySelector('.demo-note'); if (note) note.textContent = '景品は確定しています（演出のみ再生）';
  return { rank, effect };
 })();
 const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
 const isFire = host.id === 'screen';
 const themeOf = () => isFire ? 'fire' : (host.dataset.theme || 'fire');
 const timers = new Set();
 const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
 const clearTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); };

 /* ---------------- 音 ---------------- */
 const A = {
  /* 通常は既存の score(GachaScore)を使う。検査用に src で差し替えられる(OfflineAudioContext など) */
  src: null,
  bus() { return this.src || (typeof score !== 'undefined' ? score : null); },
  ok() { if (!V50.sfx && !this.src) return false; /* 追加の音は既定OFF(検査用の src 差し替え時は鳴らす) */ const s = this.bus(); return !!(s && s.ac && s.output && s.ac.state !== 'closed'); },
  get ac() { return this.bus().ac; },
  out() { return this.bus().output; },
  noiseBuf: null,
  noise() {
   if (this.noiseBuf) return this.noiseBuf;
   const ac = this.ac, b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
   for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
   return this.noiseBuf = b;
  },
  /* ノイズの一発。filter: {type,from,to} で帯域を動かす */
  burst(at, dur, level, filter, decay = true) {
   const ac = this.ac, s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
   g.gain.value = 0; s.buffer = this.noise(); s.loop = true;
   f.type = filter.type || 'bandpass'; f.Q.value = filter.q || .9;
   f.frequency.setValueAtTime(filter.from, at); if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, at + dur);
   g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + (filter.attack || .006));
   if (decay) g.gain.exponentialRampToValueAtTime(.0005, at + dur); else g.gain.setValueAtTime(level, at + dur - .05), g.gain.linearRampToValueAtTime(0, at + dur);
   s.connect(f); f.connect(g); g.connect(this.out()); s.start(at); s.stop(at + dur + .02); this.bus().track(s); return s;
  },
  /* 正弦波などの一音。pitch {from,to} */
  tone(at, dur, level, pitch, type = 'sine', curve = 'exp') {
   const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
   g.gain.value = 0; o.type = type; o.frequency.setValueAtTime(pitch.from, at);
   if (pitch.to) o.frequency.exponentialRampToValueAtTime(pitch.to, at + dur);
   g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + .008);
   if (curve === 'exp') g.gain.exponentialRampToValueAtTime(.0005, at + dur); else g.gain.linearRampToValueAtTime(0, at + dur);
   o.connect(g); g.connect(this.out()); o.start(at); o.stop(at + dur + .02); this.bus().track(o); return o;
  },
  /* 歪み(炎のうなり用) */
  shaper() {
   if (this._shaper) return this._shaper;
   const ws = this.ac.createWaveShaper(), n = 1024, curve = new Float32Array(n);
   for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = Math.tanh(x * 3.2); }
   ws.curve = curve; return this._shaper = ws;
  },

  /* 亀裂が走る音: 高い「ピシッ」+ ガラスの鳴り */
  crack(strength = 1) {
   if (!this.ok()) return; const t = this.ac.currentTime;
   this.burst(t, .09, .22 * strength, { type: 'bandpass', from: 5200, to: 2600, q: 2.5 });
   this.tone(t, .35, .07 * strength, { from: 3200 + Math.random() * 900, to: 2100 }, 'triangle');
   this.tone(t + .01, .12, .09 * strength, { from: 180, to: 60 }, 'sine');
  },
  /* 稲妻: 高域のバチッ + 低い雷鳴 */
  bolt(intensity = .5) {
   if (!this.ok()) return; const t = this.ac.currentTime;
   this.burst(t, .07 + intensity * .08, .13 + intensity * .09, { type: 'highpass', from: 4200, q: .7 });
   this.burst(t + .03, .45 + intensity * .4, .09 + intensity * .07, { type: 'lowpass', from: 420, to: 90, q: .8 });
  },
  /* フリーズ後の上昇(riser)。テーマごとに音色が違う。rift+gather の全長で一気に昇りつめる */
  riser(theme, riftDur, gatherDur) {
   if (!this.ok()) return; const ac = this.ac, t0 = ac.currentTime, total = V50.bed.length, out = this.out(), L0 = V50.bed.lull[0], L1 = V50.bed.lull[1];
   /* 共通: 帯域が上がっていくノイズの風(300Hz→9kHz)。静寂(参考音源の 5.2-7.5秒)では一度沈む */
   const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
   n.buffer = this.noise(); n.loop = true; nf.type = 'bandpass'; nf.Q.value = 1.6;
   nf.frequency.setValueAtTime(300, t0); nf.frequency.exponentialRampToValueAtTime(1400, t0 + L0); nf.frequency.setValueAtTime(900, t0 + L1); nf.frequency.exponentialRampToValueAtTime(9000, t0 + total);
   ng.gain.value = 0; ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(.08, t0 + L0); ng.gain.linearRampToValueAtTime(.02, t0 + L1); ng.gain.linearRampToValueAtTime(.2, t0 + total - .3); ng.gain.linearRampToValueAtTime(0, t0 + total + .2);
   n.connect(nf); nf.connect(ng); ng.connect(out); n.start(t0); n.stop(t0 + total + .3); this.bus().track(n);
   /* 鼓動: 間隔が縮む(1.1秒→0.18秒)。高いクリックを乗せて重低音だけにしない */
   let at = t0 + .4;
   while (at < t0 + total - .25) {
    const p = (at - t0) / total, lull = at > t0 + L0 && at < t0 + L1;
    if (!lull) { this.tone(at, .22, .12 + p * .08, { from: 62 + p * 30, to: 38 }, 'sine'); this.burst(at, .03, .1 + p * .1, { type: 'highpass', from: 6000, q: .5 }); }
    at += Math.max(.18, 1.1 - p * 1.0);
   }
   if (theme === 'fire') {
    /* 炎: 歪んだ鋸歯波のうなり。音程が上がり、歪みが増す */
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t0); o.frequency.exponentialRampToValueAtTime(220, t0 + total);
    f.type = 'lowpass'; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(5200, t0 + total); f.Q.value = 4;
    g.gain.value = 0; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.1, t0 + L0); g.gain.linearRampToValueAtTime(.035, t0 + L1); g.gain.linearRampToValueAtTime(.16, t0 + total - .2); g.gain.linearRampToValueAtTime(0, t0 + total + .1);
    o.connect(this.shaper()); this.shaper().connect(f); f.connect(g); g.connect(out); o.start(t0); o.stop(t0 + total + .2); this.bus().track(o);
    /* 爆ぜる火の粉(ランダムな高いパチパチ) */
    for (let s = t0 + L1; s < t0 + total; s += .05 + Math.random() * .25 * (1 - (s - t0) / total)) this.burst(s, .025, .07 + ((s - t0) / total) * .1, { type: 'bandpass', from: 3000 + Math.random() * 5000, q: 3 });
   } else if (theme === 'dragon') {
    /* 龍: 深い龍鳴り(サブ)+ 水の高いきらめき + 雷の遠鳴り */
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(44, t0); o.frequency.exponentialRampToValueAtTime(66, t0 + total);
    g.gain.value = 0; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.14, t0 + L0); g.gain.linearRampToValueAtTime(.05, t0 + L1); g.gain.linearRampToValueAtTime(.18, t0 + total - .3); g.gain.linearRampToValueAtTime(0, t0 + total + .1);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + total + .2); this.bus().track(o);
    for (let s = t0 + .3; s < t0 + total; s += .22 - ((s - t0) / total) * .15) { const p = (s - t0) / total; this.tone(s, .5, .05 + p * .06, { from: 2200 + Math.random() * 2600, to: 3200 + p * 3000 }, 'sine'); }
   } else {
    /* 祝福: 鐘の分散和音(ペンタトニック)が速くなり高く昇る + 金粉のシマー */
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349, 2637];
    let k = 0, s = t0 + .35;
    while (s < t0 + total - .2) { const p = (s - t0) / total, lull = s > t0 + L0 && s < t0 + L1; const f = scale[Math.min(scale.length - 1, Math.floor(p * scale.length) + (k % 3))];
     if (!lull) { this.tone(s, .8, .05 + p * .035, { from: f }, 'sine'); this.tone(s, .4, .025 + p * .02, { from: f * 2.01 }, 'triangle'); }
     k++; s += Math.max(.11, .5 - p * .4); }
    const sh = ac.createBufferSource(), sf = ac.createBiquadFilter(), sg = ac.createGain();
    sh.buffer = this.noise(); sh.loop = true; sf.type = 'highpass'; sf.frequency.value = 7000; sg.gain.value = 0;
    sg.gain.setValueAtTime(0, t0 + L1); sg.gain.linearRampToValueAtTime(.09, t0 + total - .3); sg.gain.linearRampToValueAtTime(0, t0 + total + .1);
    sh.connect(sf); sf.connect(sg); sg.connect(out); sh.start(t0 + L1 - .2); sh.stop(t0 + total + .2); this.bus().track(sh);
   }
  },
  /* 解放の一撃: 全帯域の炸裂 + 落ちる低音 + 明るい高音の和音 */
  flare(theme) {
   if (!this.ok()) return; const t = this.ac.currentTime;
   this.burst(t, 1.3, .26, { type: 'lowpass', from: 12000, to: 300, q: .5 });
   this.burst(t, .25, .2, { type: 'highpass', from: 5000, q: .4 });
   this.tone(t, .9, .17, { from: 320, to: 36 }, 'sine');
   const chord = theme === 'dragon' ? [1318.5, 1760, 2637] : theme === 'blessing' ? [1046.5, 1318.5, 1568, 2093] : [1174.7, 1568, 2349];
   chord.forEach((f, i) => this.tone(t + .02 + i * .03, 1.6, .065, { from: f * 1.02, to: f }, 'sine', 'exp'));
  },
  /* PUSH前の鼓動(3.2秒で 70→170bpm)。画面の脈動クラスと同じ時刻で鳴らす */
  heartbeat(duration = 3.2, onBeat) {
   if (!this.ok()) return; const t0 = this.ac.currentTime; let at = 0;
   while (at < duration - .15) {
    const p = at / duration, abs = t0 + at;
    this.tone(abs, .2, .2 + p * .12, { from: 70, to: 40 }, 'sine'); this.burst(abs, .035, .09 + p * .1, { type: 'highpass', from: 5500, q: .5 });
    this.tone(abs + .14, .16, .11 + p * .08, { from: 58, to: 36 }, 'sine');
    if (onBeat) later(at * 1000, () => onBeat(p));
    at += Math.max(.35, .86 - p * .55);
   }
  },
  pushAppear() { if (!this.ok()) return; const t = this.ac.currentTime; this.burst(t, .35, .35, { type: 'lowpass', from: 9000, to: 400 }); this.tone(t, 1.2, .14, { from: 1680, to: 1600 }, 'triangle'); this.tone(t, .6, .18, { from: 160, to: 42 }, 'sine'); },
  pushVoid() { if (!this.ok()) return; const t = this.ac.currentTime; this.tone(t, .75, .14, { from: 620, to: 110 }, 'triangle'); this.burst(t, .5, .1, { type: 'lowpass', from: 2000, to: 150 }); },
  miss() { if (!this.ok()) return; const t = this.ac.currentTime; this.tone(t, .55, .28, { from: 110, to: 34 }, 'sine'); this.burst(t, .4, .22, { type: 'lowpass', from: 3500, to: 120 }); this.tone(t + .12, .9, .12, { from: 440, to: 118 }, 'triangle'); },
  shing(level = 1) { if (!this.ok()) return; const t = this.ac.currentTime; this.burst(t, .5, .22 * level, { type: 'bandpass', from: 2600, to: 9500, q: 1.4 }); this.tone(t, .7, .12 * level, { from: 2200, to: 3400 }, 'sine'); this.tone(t, .5, .2 * level, { from: 200, to: 40 }, 'sine'); },
  sparkle(count = 12, span = 2.2) {
   if (!this.ok()) return; const t = this.ac.currentTime, scale = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349, 2637, 3136, 3520];
   for (let i = 0; i < count; i++) { const at = t + (i / count) * span * (0.6 + 0.4 * (i / count)); this.tone(at, .5, .07, { from: scale[(i * 3) % scale.length] * (1 + Math.floor(i / scale.length)) }, 'sine'); this.burst(at, .03, .05, { type: 'highpass', from: 7000, q: .5 }); }
  },
  fanfare(rank) {
   if (!this.ok()) return; const t = this.ac.currentTime;
   this.burst(t, .6, .3, { type: 'lowpass', from: 10000, to: 500 }); this.tone(t, .8, .22, { from: 240, to: 40 }, 'sine');
   const chord = rank === 'SS' ? [1046.5, 1318.5, 1568, 2093, 2637] : rank === 'S' ? [1046.5, 1318.5, 1568] : [880, 1108.7];
   chord.forEach((f, i) => this.tone(t + .05 + i * .06, 1.4, .08, { from: f }, 'sine'));
   if (rank === 'SS') this.sparkle(16, 1.8);
  },
 };

 /* ---------------- 画面の衝撃(衝撃波リング・白フラッシュ・一瞬のカメラ押し) ---------------- */
 const fxLayer = document.createElement('div');
 fxLayer.className = 'v50-fx'; fxLayer.setAttribute('aria-hidden', 'true');
 host.append(fxLayer);
 function shock(kind = 'gold', strength = 1) {
  if (reduced) return;
  const ring = document.createElement('i'); ring.className = 'v50-shock v50-' + kind; ring.style.setProperty('--s', strength);
  const flash = document.createElement('b'); flash.className = 'v50-flash v50-' + kind; flash.style.setProperty('--s', strength);
  fxLayer.append(ring, flash);
  host.classList.remove('v50-punch'); void host.offsetWidth; host.classList.add('v50-punch');
  later(900, () => { ring.remove(); flash.remove(); });
 }
 const themeKind = () => ({ fire: 'fire', dragon: 'ice', blessing: 'gold' })[themeOf()] || 'gold';

 /* ---------------- ランク別の祝福文(C/B賞に「おめでとう！」を出さない) ---------------- */
 function rankOf() {
  const rec = V50.record(); if (rec) return rec.rank; /* 本番: 画面の文字ではなくサーバーの記録の等級 */
  if (isFire) return host.dataset.rank || 'SS';
  const m = (document.querySelector('#reveal-rank')?.textContent || '').match(/^(SS|S|A|B|C)/);
  return m ? m[1] : 'SS';
 }
 function applyCongrats(rank) {
  host.dataset.rank = rank;
  const big = ['SS', 'S', 'A'].includes(rank);
  for (const el of document.querySelectorAll('.congrats-message')) el.textContent = big ? 'おめでとう！' : rank + '賞 獲得';
 }

 /* ---------------- 本番の記録を画面に写す(等級ラベル・景品名・画像) ---------------- */
 function showRecord(scene) {
  const rec = V50.record(); if (!rec) return;
  const label = rec.label + ' 獲得', img = rec.prize.image_url || null;
  if (scene === 'reveal') { const a = document.querySelector('#reveal-rank'); if (a) a.textContent = label; const im = document.querySelector('#reveal .prize-card img'); if (im && img) im.src = img; const t = document.querySelector('#reveal-title'); if (t) t.textContent = rec.prize.name; }
  if (scene === 'result') { const a = document.querySelector('#result-rank'); if (a) a.textContent = label; const nme = document.querySelector('#result-name'); if (nme) nme.textContent = rec.prize.name; const im = document.querySelector('#result .result-art img'); if (im && img) im.src = img; const p = document.querySelector('#result p'); if (p) p.textContent = rec.package.name + '｜記録ID ' + rec.id + '｜発送依頼は播州オクのくじページから'; }
  if (scene === 'win' || scene === 'complete') { const a = document.querySelector('#prize-reveal>strong'); if (a) a.textContent = label; const h = document.querySelector('#prize-reveal h2'); if (h) h.textContent = rec.prize.name; const p = document.querySelector('#prize-reveal p'); if (p) p.textContent = rec.package.name + '｜記録ID ' + rec.id; const im = document.querySelector('#prize-reveal img'); if (im && img) im.src = img; const sp = document.querySelector('#prize-reveal span'); if (sp) sp.textContent = '発送依頼は播州オクのくじページから'; }
 }
 /* ---------------- ?debug=1: 音と映像のずれを画面に出す(確認用) ---------------- */
 if (new URLSearchParams(location.search).get('debug') === '1' && !isFire) {
  const box = document.createElement('pre'); box.className = 'v50-debug'; box.style.cssText = 'position:absolute;left:4px;bottom:64px;z-index:9999;margin:0;padding:6px 8px;font:11px/1.4 monospace;color:#9f9;background:#000b;border:1px solid #4a4;pointer-events:none;white-space:pre';
  host.append(box);
  let frames = [], last = performance.now(), sceneStart = 0, sceneName = '', acAtScene = 0;
  new MutationObserver(() => { const n = host.dataset.scene; if (n !== sceneName) { sceneName = n; sceneStart = performance.now(); acAtScene = (typeof score !== 'undefined' && score.ac) ? score.ac.currentTime : 0; } }).observe(host, { attributes: true, attributeFilter: ['data-scene'] });
  const tick = (t) => { frames.push(t - last); last = t; if (frames.length > 60) frames.shift();
   const avg = frames.reduce((a, b) => a + b, 0) / (frames.length || 1), worst = Math.max(...frames, 0);
   const ac = (typeof score !== 'undefined' && score.ac) ? score.ac : null;
   const vis = (performance.now() - sceneStart) / 1000, aud = ac ? ac.currentTime - acAtScene : 0;
   box.textContent = '場面 ' + (sceneName || '-') + '\n映像 ' + vis.toFixed(2) + 's  音 ' + aud.toFixed(2) + 's  差 ' + (vis - aud).toFixed(2) + 's\n描画 平均 ' + avg.toFixed(0) + 'ms 最悪 ' + worst.toFixed(0) + 'ms (' + (1000 / (avg || 1)).toFixed(0) + 'fps)\n音の状態 ' + (ac ? ac.state : '-') + '  軽量 ' + (V50.liteActive ? 'ON' : 'OFF') + '  ' + innerWidth + 'x' + innerHeight;
   requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
 }
 /* ---------------- 場面の変化を見張る ---------------- */
 let prev = '';
 function onScene(name) {
  if (name === prev) return; prev = name;
  const theme = themeOf(), kind = themeKind();
  const D = V50.freezeDurations[theme] || [4, 6];
  switch (name) {
   case 'rift': A.riser(theme, D[0], D[1]); later(60, () => shock(kind, .7)); break;
   case 'gather': later(1600, () => shock(kind, .9)); break;
   case 'rainbow': shock('rainbow', 1.6); shock('white', .9); A.sparkle(14, 2.2); break;
   case 'pushtease': {
    const el = host.querySelector('.push-anticipation');
    const beat = p => { if (!el) return; el.classList.remove('v50-beat'); void el.offsetWidth; el.classList.add('v50-beat'); el.style.setProperty('--beat', p.toFixed(2)); };
    if (V50.sfx) A.heartbeat(3.2, beat); else { let at = 0; while (at < 3.05) { const p = at / 3.2; later(at * 1000, () => beat(p)); at += Math.max(.35, .86 - p * .55); } }
    break; }
   case 'push': A.pushAppear(); shock(kind, .8); break;
   case 'pushvoid': A.pushVoid(); break;
   case 'miss': A.miss(); host.classList.remove('v50-drop'); void host.offsetWidth; host.classList.add('v50-drop'); break;
   case 'strike': case 'awaken': case 'shatter': case 'swing': A.shing(1); shock(kind, 1); break;
   case 'rush': shock('rainbow', .8); break;
   case 'reveal': case 'win': { const r = rankOf(); applyCongrats(r); showRecord(name); if (['SS', 'S', 'A'].includes(r)) { A.fanfare(r); shock(r === 'SS' ? 'rainbow' : kind, r === 'SS' ? 1.2 : .8); } break; }
   case 'arrive': case 'draw': shock(kind, .6); break;
   case 'result': { if (V50.app) appPost('result'); /* ⑤ SS/S賞の結果画面に余韻を残す(龍・祝福=メイン画面) */
    showRecord(name);
    if (isFire) break; const r = host.dataset.rank || '';
    const res = document.querySelector('#result'); if (!res) break;
    host.classList.toggle('v50-glory', r === 'SS' || r === 'S');
    if (!res.querySelector('.v50-result-fx')) {
     const fx = document.createElement('div'); fx.className = 'v50-result-fx'; fx.setAttribute('aria-hidden', 'true');
     fx.innerHTML = '<i></i>' + Array.from({ length: 14 }, (_, i) => '<b style="left:' + (4 + i * 6.8) + '%;animation-delay:' + (i * .37 % 5).toFixed(2) + 's;animation-duration:' + (4 + (i % 4)) + 's;--sway:' + ((i % 2 ? 1 : -1) * (10 + i * 2)) + 'px"></b>').join('');
     res.prepend(fx);
     const cg = document.createElement('div'); cg.className = 'congrats-message v50-result-congrats'; cg.textContent = 'おめでとう！';
     const h2 = res.querySelector('#result-rank'); if (h2) h2.after(cg); else res.prepend(cg);
    }
    if (r === 'SS') shock('rainbow', 1); else if (r === 'S') shock('gold', .8);
    break; }
   case 'home': host.classList.remove('v50-glory'); break;
   case 'complete': showRecord('complete'); if (V50.app) appPost('result'); break;
   case 'tunnel': case 'seal': if (!isFire) delete host.dataset.rank; /* 前回の等級を引きずらない */ later(380, () => { if (prev === name) shock(kind, .9); }); break;
  }
 }
 new MutationObserver(() => onScene(host.dataset.scene || host.dataset.phase || '')).observe(host, { attributes: true, attributeFilter: ['data-scene', 'data-phase'] });
 host.addEventListener('v50:crack', e => A.crack(Math.min(1.3, e.detail.strength)));
 host.addEventListener('v50:bolt', e => A.bolt(e.detail.intensity));
 host.addEventListener('v50:flare', e => { A.flare(e.detail.theme); shock('white', 1.4); });
 /* スキップ・終了で score.stop() が呼ばれたら、予約していた画面側の鼓動も止める */
 if (typeof score !== 'undefined') score.onStop = clearTimers;
 /* 検査・デバッグ用に音の部品を公開(本番の動作には使わない) */
 V50.audio = A; V50.shock = shock;
 document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimers(); });
})();
