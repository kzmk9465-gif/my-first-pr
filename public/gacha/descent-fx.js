/* v50: フリーズ後の「亀裂→エネルギー」を3テーマ別に描く。
   炎=溶岩の亀裂と炎柱 / 龍=氷の亀裂と稲妻 / 祝福=黄金の亀裂から漏れる光。
   進行(p)に合わせて 火花・衝撃波・画面の揺れ・色ずれ が激しくなる。
   亀裂が走る瞬間・稲妻・最後の解放は CustomEvent で v50-impact.js(音)へ通知する。 */
(() => {
 const host = document.querySelector('#stage,#screen'), layer = host.querySelector('.descent-build');
 const canvas = document.createElement('canvas');
 canvas.className = 'descent-real';
 layer.prepend(canvas);

 const title = document.createElement('div');
 title.className = 'descent-title';
 title.innerHTML = '<small>THE SEAL IS BREAKING</small><strong data-text=封印崩壊>封印崩壊</strong><em>その力を、解き放て。</em>';
 layer.append(title);

 const art = document.createElement('div');
 art.className = 'freeze-theme-art';
 art.innerHTML = '<div class=dragon-eyes><i></i><i></i></div><img class=freeze-dragon src=real-dragon.png alt=""><img class=freeze-chest src=real-chest.png alt=""><div class=chest-light></div>';
 layer.append(art);

 const c = canvas.getContext('2d'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
 const DUR = () => (window.V50 && V50.freezeDurations) || { fire: [4, 6], dragon: [3, 7], blessing: [5, 5] };

 let seed = 87031;
 const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

 /* 亀裂の骨格は共通(11本+枝)。見た目(色・太さ・光)はテーマごとに変える。 */
 const cracks = [];
 for (let k = 0; k < 11; k++) {
  const angle = k * Math.PI * 2 / 11 + (random() - .5) * .3;
  let x = 0, y = 0, pts = [[0, 0]];
  for (let j = 1; j <= 14; j++) {
   const r = j * .052, a = angle + (random() - .5) * .15;
   x = Math.cos(a) * r; y = Math.sin(a) * r; pts.push([x, y]);
   if (j > 2 && j % 3 === 0) {
    let branch = [[x, y]], ba = a + (random() > .5 ? 1 : -1) * (.4 + random() * .7);
    for (let n = 1; n < 5; n++) branch.push([x + Math.cos(ba) * n * .021 + (random() - .5) * .01, y + Math.sin(ba) * n * .021 + (random() - .5) * .01]);
    cracks.push({ pts: branch, start: j / 22, width: .35 + random() * .4, branch: true });
   }
  }
  /* 本線の亀裂は rift の前半60%に散らして走らせる(音の「ピシッ」が1秒に固まらないように) */
  cracks.push({ pts, start: (k / 11) * .55 + random() * .08, width: .7 + random() * .6, branch: false });
 }
 const dust = Array.from({ length: 260 }, () => ({ a: random() * Math.PI * 2, r: .12 + random() * .8, z: .2 + random() * .8, h: random() * 360, s: random() }));

 let theme = 'fire', phase = '', since = 0, raf = 0, w = 0, h = 0, sparks = [], fired = new Set(), lastBolt = -1, lastSpark = 0, flareSent = false;

 function resize() {
  w = host.clientWidth; h = host.clientHeight;
  const d = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = w * d; canvas.height = h * d;
  c.setTransform(d, 0, 0, d, 0, 0);
 }

 function glow(x, y, r, hue, alpha, sat = 70) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `hsla(${hue},${sat}%,85%,${alpha})`);
  g.addColorStop(.18, `hsla(${hue},${sat}%,60%,${alpha * .45})`);
  g.addColorStop(1, `hsla(${hue},${sat}%,40%,0)`);
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
 }

 const notify = (name, detail) => host.dispatchEvent(new CustomEvent('v50:' + name, { detail }));

 /* 火花: 亀裂の先端や中心から飛ぶ。テーマ色。重力あり。 */
 function emitSparks(x, y, n, hue, speed, life = 1) {
  if (reduced) return;
  for (let i = 0; i < n; i++) {
   const a = Math.random() * Math.PI * 2, v = speed * (.4 + Math.random());
   sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * .4, life, max: life, hue: hue + (Math.random() - .5) * 30, size: 1 + Math.random() * 2.2 });
  }
  if (sparks.length > 420) sparks.splice(0, sparks.length - 420);
 }
 function drawSparks(dt) {
  c.save(); c.globalCompositeOperation = 'lighter';
  sparks = sparks.filter(s => s.life > 0);
  for (const s of sparks) {
   s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 9 * dt; s.life -= dt / s.max;
   const q = Math.max(0, s.life);
   c.strokeStyle = `hsla(${s.hue},90%,${60 + q * 30}%,${q})`;
   c.lineWidth = s.size * q;
   c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * .06, s.y - s.vy * .06); c.stroke();
  }
  c.restore();
 }

 /* 共通の亀裂描画。style={edge,core,dark,glowHue,width} */
 function drawCracks(R, p, gather, style) {
  for (const f of cracks) {
   let q = gather ? 1 : Math.max(0, Math.min(1, (p - f.start) * 2.5));
   if (!q) continue;
   if (!gather && !fired.has(f) && q > 0) { fired.add(f); if (!f.branch) { const tip = f.pts[1]; emitSparks(tip[0] * R, tip[1] * R, 14, style.sparkHue, 150, .7); notify('crack', { strength: f.width }); } }
   const points = f.pts.slice(0, Math.max(2, Math.ceil(q * f.pts.length)));
   c.globalAlpha = gather ? Math.max(.08, (1 - p) * .9) : .9;
   for (const [offset, color, width] of [[2, style.dark, f.width * 2.6 * style.width], [-.8, style.edge, f.width * style.width], [0, style.core, f.width * .55 * style.width]]) {
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x * R + offset, y * R) : c.moveTo(x * R + offset, y * R));
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
   }
   const tip = points.at(-1);
   if (!gather) glow(tip[0] * R, tip[1] * R, 16, style.glowHue, .6 * q, style.sat);
  }
  c.globalAlpha = 1;
 }

 function draw(now) {
  raf = 0;
  if (!['rift', 'gather'].includes(phase) || document.hidden) return;
  const durations = DUR()[theme] || [4, 6], gather = phase === 'gather', duration = durations[gather ? 1 : 0];
  const t = reduced ? duration * .65 : Math.max(0, Math.min((now - since) / 1000, duration)), p = t / duration, R = Math.max(w, h) * .8;
  const dt = Math.min(.05, (now - (draw.last || now)) / 1000); draw.last = now;
  const intensity = gather ? .45 + p * .55 : p * .55;

  c.clearRect(0, 0, w, h);
  c.fillStyle = '#010205'; c.fillRect(0, 0, w, h);
  c.save();
  /* 画面の揺れ: 進むほど強く(最大±7px)。#world は触らず canvas だけを揺らす。 */
  const shake = reduced ? 0 : (gather ? 1.5 + p * 5.5 : p * 2);
  c.translate(w * .5 + (Math.random() - .5) * shake * 2, h * .48 + (Math.random() - .5) * shake * 2);

  if (theme === 'dragon') {
   /* ===== 龍: 氷の封印が割れ、裂け目から雷龍の気配が漏れる ===== */
   c.globalCompositeOperation = 'lighter';
   glow(0, 0, Math.min(w, h) * .75, 190, .18 + p * .18, 80);
   for (let j = 0; j < 7; j++) {
    const r = (55 + j * 27) * (1 - p * .25);
    c.beginPath(); c.ellipse(0, 35, r, r * .28, -.3 + t * .08 + j * .1, 0, Math.PI * 2);
    c.strokeStyle = `hsla(${175 + j * 6},85%,65%,${.15 + p * .2})`; c.lineWidth = 1.4; c.stroke();
   }
   for (let j = 0; j < 3; j++) { const a = t * .6 + j * Math.PI * 2 / 3, r = (gather ? 1 - p * .8 : 1) * w * .3; glow(Math.cos(a) * r, Math.sin(a) * r * .5, 19, 185, .7, 90); }
   c.globalCompositeOperation = 'source-over';
   drawCracks(R, p, gather, { edge: '#9fe9ff', core: '#f4ffff', dark: '#061a2a', glowHue: 192, sat: 95, sparkHue: 195, width: 1.15 });
   c.globalCompositeOperation = 'lighter';
   /* 亀裂の先端から枝分かれする稲妻。進行で本数が増える。 */
   if (!reduced) {
    const bolts = gather ? 3 + Math.floor(p * 3) : 1 + Math.floor(p * 2);
    LightningFX.draw(c, { time: t, radius: R * (.3 + intensity * .45), color: '#8ff0ff', power: .5 + intensity * .5, count: bolts, reduced });
    const epoch = Math.floor(t / .92);
    if (epoch !== lastBolt) { lastBolt = epoch; emitSparks(0, 0, 10 + Math.floor(intensity * 25), 195, 220 + intensity * 200, .6); notify('bolt', { intensity }); }
   }
   /* 氷の粒が中心へ吸い込まれる */
   for (let j = 0; j < 95; j++) {
    const v = (j / 95 + t * .11) % 1, a = j * 2.399, r = (1 - v) * R * .7, x = Math.cos(a) * r, y = Math.sin(a) * r * .6;
    c.save(); c.translate(x, y); c.rotate(a + t * .5); c.globalAlpha = Math.sin(v * Math.PI) * .8; c.fillStyle = '#b7faff';
    c.beginPath(); c.ellipse(0, 0, 1.5, 4, 0, 0, Math.PI * 2); c.fill(); c.restore();
   }
   if (gather) {
    /* 渦巻く雷の帯: 龍の体に沿うように回転 */
    for (let arm = 0; arm < 4; arm++) {
     c.beginPath();
     for (let k = 0; k <= 60; k++) { const u = k / 60, a = arm * Math.PI / 2 + u * 4.5 - t * (.6 + p * .8), r = (25 + Math.pow(u, 1.5) * Math.min(w, h) * .7) * (1 - p * .35), x = Math.cos(a) * r, y = Math.sin(a) * r * .6; k ? c.lineTo(x, y) : c.moveTo(x, y); }
     c.globalAlpha = .12 + p * .25; c.strokeStyle = `hsl(${190 + arm * 8},90%,${70 + p * 20}%)`; c.lineWidth = 2 + p * 4; c.stroke();
    }
    c.globalAlpha = 1;
    glow(0, 0, 30 + p * 80, 195, .5 + p * .3, 95); glow(0, 0, 12 + p * 20, 60, .6, 100);
   }
  } else if (theme === 'blessing') {
   /* ===== 祝福: 黄金の封印にひびが入り、裂け目から祝福の光が漏れ出す ===== */
   c.globalCompositeOperation = 'lighter';
   glow(0, -30, Math.min(w, h) * .8, 42, .2 + p * .25, 85);
   for (let ring = 0; ring < 3; ring++) {
    const r = (55 + ring * 40) * (gather ? 1 + p * .9 : 1);
    c.save(); c.rotate((ring % 2 ? 1 : -1) * t * .13); c.strokeStyle = '#ffe3a5'; c.globalAlpha = .3 + p * .25; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    for (let j = 0; j < 16; j++) { const a = j * Math.PI / 8; c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8)); c.stroke(); }
    c.restore();
   }
   c.globalCompositeOperation = 'source-over';
   drawCracks(R, p, gather, { edge: '#ffd77a', core: '#fff8dc', dark: '#2a1605', glowHue: 42, sat: 95, sparkHue: 45, width: 1.1 });
   c.globalCompositeOperation = 'lighter';
   /* 亀裂から漏れる光の筋(ゴッドレイ)。進行で長く・明るく。 */
   for (const f of cracks) {
    if (f.branch) continue;
    const q = gather ? 1 : Math.max(0, Math.min(1, (p - f.start) * 2.5)); if (q < .3) continue;
    const mid = f.pts[Math.floor(f.pts.length * .5)], a = Math.atan2(mid[1], mid[0]);
    const g = c.createLinearGradient(0, 0, Math.cos(a) * R, Math.sin(a) * R);
    g.addColorStop(0, `rgba(255,236,170,${.04 + intensity * .16})`); g.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - .07) * R, Math.sin(a - .07) * R); c.lineTo(Math.cos(a + .07) * R, Math.sin(a + .07) * R); c.closePath(); c.fill();
   }
   if (gather) for (let j = 0; j < 16; j++) { const a = j * Math.PI / 8 + t * .07; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.strokeStyle = '#ffd773'; c.globalAlpha = .06 + p * .12; c.lineWidth = 5; c.stroke(); }
   /* 花びらと金粉 */
   for (let j = 0; j < 95; j++) {
    const v = (j / 95 + t * .11) % 1, a = j * 2.399, r = v * R * .7, x = Math.cos(a) * r, y = (v - .5) * h;
    c.save(); c.translate(x, y); c.rotate(a + t * .5); c.globalAlpha = Math.sin(v * Math.PI) * .8; c.fillStyle = j % 3 ? '#ffe0a0' : '#ffc4d8';
    c.beginPath(); c.ellipse(0, 0, 3, 7, 0, 0, Math.PI * 2); c.fill(); c.restore();
   }
   if (!reduced && now - lastSpark > 140 - intensity * 100) { lastSpark = now; emitSparks(0, 0, 4 + Math.floor(intensity * 10), 48, 120 + intensity * 160, .9); }
   c.globalAlpha = 1;
   if (gather) { glow(0, 0, 40 + p * 90, 45, .35 + p * .4, 95); glow(0, 0, 14 + p * 24, 50, .8, 100); }
  } else {
   /* ===== 炎: 鏡面の封印が砕け、溶岩の亀裂から炎が立ち上る(v49の造形を継承) ===== */
   c.globalCompositeOperation = 'source-over';
   for (let j = 0; j < 22; j++) {
    const a = j * Math.PI * 2 / 22, open = gather ? Math.min(1, p * 2) : Math.max(0, p - .45) * .4;
    const shift = open * (35 + j % 4 * 14), outer = R * (.5 + j % 3 * .12), inner = 12 + open * 45;
    c.save(); c.translate(Math.cos(a) * shift, Math.sin(a) * shift); c.rotate(gather ? open * (j % 2 ? 1 : -1) * .07 : 0);
    const ax = Math.cos(a) * outer, ay = Math.sin(a) * outer, bx = Math.cos(a + .26) * outer, by = Math.sin(a + .26) * outer;
    c.beginPath(); c.moveTo(Math.cos(a + .1) * inner, Math.sin(a + .1) * inner); c.lineTo(ax, ay); c.lineTo(bx, by); c.closePath();
    const shade = c.createLinearGradient(ax, ay, bx, by);
    shade.addColorStop(0, '#02060d'); shade.addColorStop(.48, j % 3 ? '#0c1a29' : '#243744'); shade.addColorStop(.51, '#344657'); shade.addColorStop(.54, '#09111d'); shade.addColorStop(1, '#02050a');
    c.globalAlpha = gather ? Math.max(0, 1 - p * 1.7) : Math.min(1, p * 2); c.fillStyle = shade; c.fill(); c.lineWidth = .6; c.strokeStyle = '#7ca2b54a'; c.stroke(); c.restore();
   }
   c.globalAlpha = 1;
   c.globalCompositeOperation = 'lighter';
   glow(0, 0, 110 + 100 * p, 25, .22 + intensity * .2, 90);
   c.globalCompositeOperation = 'source-over';
   drawCracks(R, p, gather, { edge: '#ff9a4a', core: '#fff1d0', dark: '#1a0804', glowHue: 28, sat: 100, sparkHue: 30, width: 1.2 });
   c.globalCompositeOperation = 'lighter';
   if (!reduced && now - lastSpark > 120 - intensity * 90) { lastSpark = now; emitSparks(0, 0, 5 + Math.floor(intensity * 14), 28, 160 + intensity * 220, .8); }
   if (gather) {
    for (let j = 0; j < 30; j++) {
     const x = (j / 29 - .5) * w, y = h * .35, reach = (.2 + p * .6) * h * (.4 + (j % 7) / 10);
     c.beginPath(); c.moveTo(x, y);
     c.bezierCurveTo(x - 25 * Math.sin(t * 3 + j), y - reach * .3, x + 30 * Math.cos(t * 2 + j), y - reach * .7, x + 12 * Math.sin(t * 4 + j), y - reach);
     c.strokeStyle = j % 3 ? '#ff641b' : '#ffe1a0'; c.globalAlpha = .1 + p * .18; c.lineWidth = 4 + j % 5; c.stroke();
    }
    c.globalAlpha = 1;
    for (let arm = 0; arm < 6; arm++) for (let pass = 0; pass < 2; pass++) {
     c.beginPath();
     for (let k = 0; k <= 65; k++) { const u = k / 65, a = arm * Math.PI / 3 + u * 5.5 - t * (.45 + p * .65), r = (20 + Math.pow(u, 1.6) * Math.min(w, h) * .78) * (1 - p * .4), x = Math.cos(a) * r, y = Math.sin(a) * r * .62 + Math.sin(u * 12 + t) * 8; k ? c.lineTo(x, y) : c.moveTo(x, y); }
     c.globalAlpha = pass ? .65 : .09; c.strokeStyle = `hsl(${15 + arm * 7},85%,${pass ? 78 : 48}%)`; c.lineWidth = pass ? 1.5 : 16 + p * 15; c.stroke();
    }
    c.globalAlpha = 1;
    for (let j = 0; j < 65; j++) { const a = j * 2.399 + t * (.6 + j % 3 * .15) * (1 + p), rad = (.12 + (j % 11) / 18) * (1 - p * .67) * Math.min(w, h), x = Math.cos(a) * rad, y = Math.sin(a) * rad * .58; glow(x, y, 25 + (j % 7) * 8, 15 + j % 4 * 12, .045 + .06 * p, 85); }
    for (const d of dust) {
     const v = (d.s + t * .28 * (1 + p)) % 1, r = (1 - v) * (1 - p * .6) * R * d.r, a = d.a + t * (.7 + d.z) * (1 + p) + v * 1.8, x = Math.cos(a) * r, y = Math.sin(a) * r * .62;
     c.globalAlpha = Math.sin(v * Math.PI) * d.z * .9; c.strokeStyle = `hsl(${15 + d.h / 12},85%,70%)`; c.lineWidth = .3 + d.z * .8;
     c.beginPath(); c.moveTo(x, y); const a2 = a - .045 - d.z * .055; c.lineTo(Math.cos(a2) * (r + (12 + 20 * p) * d.z), Math.sin(a2) * (r + (12 + 20 * p) * d.z) * .62); c.stroke();
    }
    c.globalAlpha = 1;
    glow(0, 0, 30 + p * 65, 215, .6, 80); glow(0, 0, 12 + p * 18, 40, .8, 100);
   } else glow(0, 0, 9 + 12 * p, 210, .45 * p, 80);
  }

  /* ===== 共通: 衝撃波・破片・稲妻(炎/祝福)・火花・色ずれ・最後の解放 ===== */
  c.globalCompositeOperation = 'lighter';
  if (!reduced) {
   for (let j = 0; j < 3; j++) {
    const wave = Math.abs((t * .48 + j / 3) % 1), r = Math.max(0, wave * Math.min(w, h) * .95);
    c.globalAlpha = (1 - wave) * intensity * .45; c.strokeStyle = theme === 'dragon' ? `hsl(${190 + j * 8},85%,75%)` : theme === 'blessing' ? `hsl(${42 + j * 6},85%,75%)` : `hsl(${20 + j * 10},85%,72%)`; c.lineWidth = 1 + (1 - wave) * 2;
    c.beginPath(); c.ellipse(0, 0, r, r * .65, -.3, 0, Math.PI * 2); c.stroke();
   }
   if (theme !== 'dragon') LightningFX.draw(c, { time: t, radius: R * (.25 + intensity * .4), color: theme === 'blessing' ? '#ffe9a8' : '#ffb86b', power: intensity, count: gather ? 4 : 2, reduced });
   for (let j = 0; j < 36; j++) {
    const v = (j / 36 + t * .17) % 1, a = j * 2.399, r = (gather ? 1 - v : v) * R * .7, x = Math.cos(a) * r, y = Math.sin(a) * r * .8;
    c.save(); c.translate(x, y); c.rotate(a + t * .4); c.globalAlpha = Math.sin(v * Math.PI) * intensity * .7; const z = 2 + j % 4;
    c.fillStyle = j % 3 ? (theme === 'dragon' ? '#b9e6ff' : theme === 'blessing' ? '#ffe7b0' : '#96c8dc') : '#fff0c4';
    c.beginPath(); c.moveTo(-z, -z * 2); c.lineTo(z * .7, -z); c.lineTo(z, z * 2); c.closePath(); c.fill(); c.restore();
   }
  }
  c.globalAlpha = 1;
  drawSparks(dt);
  if (gather) {
   const hue = theme === 'dragon' ? 195 : theme === 'blessing' ? 45 : 280;
   glow(0, 0, 60 + p * 100, hue, .18 + p * .18, 90); glow(0, 0, 15 + p * 40, theme === 'dragon' ? 180 : 45, .5, 100);
   /* 最後の0.5秒: 画面全体が白く弾ける(解放) */
   const flare = Math.max(0, (p - .9) / .1);
   if (flare) { glow(0, 0, Math.max(w, h) * flare, theme === 'dragon' ? 190 : theme === 'blessing' ? 48 : 30, flare * .9, 90); if (!flareSent) { flareSent = true; emitSparks(0, 0, 90, theme === 'dragon' ? 195 : theme === 'blessing' ? 48 : 30, 420, 1.2); notify('flare', { theme }); } }
  }
  c.restore();

  /* 色ずれ(クロマ): 強度が高いときだけ、画面の両端に赤/青のゴーストを薄く重ねる */
  if (!reduced && intensity > .55) {
   const k = (intensity - .55) * 6;
   c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .08 * k;
   c.drawImage(canvas, -3 * k, 0, w, h); c.globalAlpha = .06 * k; c.drawImage(canvas, 3 * k, 0, w, h); c.restore();
  }
  /* 四隅の暗がり: 進むほど縁が光る(衝撃の圧) */
  const vg = c.createRadialGradient(w * .5, h * .5, Math.min(w, h) * .3, w * .5, h * .5, Math.max(w, h) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${.55 - intensity * .35})`);
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
  if (!reduced) raf = requestAnimationFrame(draw);
 }

 function sync() {
  const next = host.dataset.scene || host.dataset.phase;
  if (next === phase) return;
  phase = next; since = performance.now(); draw.last = since;
  if (raf) cancelAnimationFrame(raf); raf = 0;
  if (['rift', 'gather'].includes(phase)) {
   theme = host.dataset.theme || 'fire';
   layer.dataset.freezeTheme = theme;
   if (phase === 'rift') { sparks = []; fired = new Set(); lastBolt = -1; flareSent = false; }
   const text = { fire: ['灼熱崩壊', '炎神覚醒', 'INFERNO AWAKENING'], dragon: ['龍眼開眼', '雷龍降臨', 'THUNDER DRAGON'], blessing: ['祝福の封印', '奇跡の開花', 'GOLDEN BLESSING'] }[theme];
   const strong = title.querySelector('strong');
   strong.textContent = text[phase === 'rift' ? 0 : 1]; strong.dataset.text = strong.textContent;
   title.querySelector('small').textContent = text[2];
   title.querySelector('em').textContent = phase === 'rift' ? '静寂の先に、奇跡。' : '伝説が、目を覚ます。';
   resize();
   raf = requestAnimationFrame(draw);
  }
 }

 new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ['data-scene', 'data-phase'] });
 addEventListener('resize', () => { resize(); if (reduced) draw(performance.now()); });
 document.addEventListener('visibilitychange', () => { if (!document.hidden && ['rift', 'gather'].includes(phase)) { since = performance.now(); if (!raf) raf = requestAnimationFrame(draw); } });
 sync();
})();
