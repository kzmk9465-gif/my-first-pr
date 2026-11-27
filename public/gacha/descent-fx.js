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
 art.innerHTML = '<div class=dragon-eyes><i></i><i></i></div><img class=freeze-dragon src=real-dragon.png alt=""><div class=chest-burst></div><img class="freeze-chest freeze-chest-base" src=real-chest.png alt=""><img class="freeze-chest freeze-chest-lid" src=real-chest.png alt=""><div class=chest-light></div>';
 layer.append(art);

 const c = canvas.getContext('2d'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
 /* 軽量モード: スマホ幅 or CPUが少ない端末。線・火花・解像度を減らして描画が音に追いつくようにする */
 const LITE = (window.V50 && V50.lite != null) ? !!V50.lite : (matchMedia('(max-width: 560px)').matches || (navigator.hardwareConcurrency || 8) <= 4 || /iPhone|iPad|Android/i.test(navigator.userAgent));
 window.V50 = window.V50 || {}; V50.liteActive = LITE;
 const DUR = () => (window.V50 && V50.freezeDurations) || { fire: [4, 6], dragon: [3, 7], blessing: [5, 5] };

 let seed = 87031;
 const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

 /* 亀裂の骨格: 本線11本を中心から放射状に、角度を少しずつ揺らし、ときどき大きく折れる。
    進むたびに確率で枝が出て、枝からさらに細い枝(2段)。幅は根元で太く先端で細い。 */
 const cracks = [];
 function grow(x, y, angle, steps, step, width, depth, start) {
  const pts = [[x, y]];
  for (let j = 1; j <= steps; j++) {
   angle += (random() - .5) * .55 + (random() < .14 ? (random() - .5) * 1.5 : 0);
   const len = step * (.6 + random() * .8);
   x += Math.cos(angle) * len; y += Math.sin(angle) * len; pts.push([x, y]);
   if (depth > 0 && j > 1 && j < steps - 1 && random() < (depth === 2 ? (LITE ? .18 : .26) : (LITE ? .2 : .3))) {
    const side = random() > .5 ? 1 : -1, bLen = 2 + Math.floor(random() * Math.max(2, (steps - j) * .55));
    cracks.push(grow(x, y, angle + side * (.5 + random() * 1.0), bLen, step * .75, width * (depth === 2 ? .5 : .4), depth - 1, start + (j / steps) * .35 + random() * .05));
   }
  }
  return { pts, start, width, branch: depth < 2 };
 }
 for (let k = 0; k < (LITE ? 8 : 11); k++) {
  const angle = k * Math.PI * 2 / 11 + (random() - .5) * .35;
  cracks.push(grow(0, 0, angle, LITE ? 18 : 24, LITE ? .04 : .031, .75 + random() * .6, LITE ? 1 : 2, (k / 11) * .55 + random() * .08));
 }
 /* 毛細の割れ: 中心付近の短い細い線(本線が走った後に見える) */
 for (let k = 0; k < (LITE ? 6 : 18); k++) { const a = random() * Math.PI * 2, r = .05 + random() * .25; cracks.push(grow(Math.cos(a) * r, Math.sin(a) * r, a + (random() - .5) * 1.2, 3 + Math.floor(random() * 4), .02, .22 + random() * .15, 0, .25 + random() * .5)); }
 const dust = Array.from({ length: LITE ? 110 : 260 }, () => ({ a: random() * Math.PI * 2, r: .12 + random() * .8, z: .2 + random() * .8, h: random() * 360, s: random() }));

 let theme = 'fire', phase = '', since = 0, raf = 0, w = 0, h = 0, sparks = [], fired = new Set(), lastBolt = -1, lastSpark = 0, flareSent = false;

 /* 宝箱の蓋の継ぎ目: 画像の不透明部分を測り、その上から36%の位置を蓋の下端とする(要素内の%で CSS 変数 --lid に渡す) */
 let lidMeasured = false;
 function measureLid() {
  const img = art.querySelector('.freeze-chest-base'); if (!img || !img.naturalWidth) return;
  try {
   let box = measureLid.box;
   if (!box) { const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, cv.width, cv.height).data; let top = cv.height, bottom = 0; for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 4) if (px[(y * cv.width + x) * 4 + 3] > 40) { if (y < top) top = y; if (y > bottom) bottom = y; } box = measureLid.box = { top, bottom }; }
   const elW = img.clientWidth, elH = img.clientHeight; if (!elW || !elH) return;
   const sc = Math.min(elW / img.naturalWidth, elH / img.naturalHeight), offY = (elH - img.naturalHeight * sc) / 2;
   const seam = offY + (box.top + (box.bottom - box.top) * .36) * sc;
   art.style.setProperty('--lid', (seam / elH * 100).toFixed(2) + '%');
   lidMeasured = true;
  } catch (e) { art.style.setProperty('--lid', '38%'); }
 }
 function resize() {
  w = host.clientWidth; h = host.clientHeight; measureLid();
  const d = LITE ? 1 : Math.min(devicePixelRatio || 1, 1.5);
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
  const cap = LITE ? 160 : 420; if (sparks.length > cap) sparks.splice(0, sparks.length - cap);
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
 /* 破片: 本線の亀裂に沿って置く小さな欠片(位置は固定・進行で外へ流れる) */
 const shards = [];
 for (const f of cracks) if (!f.branch && f.pts.length > 14) for (const idx of (LITE ? [4, 10, 15] : [3, 7, 11, 15, 19])) shards.push({ f, idx, side: random() > .5 ? 1 : -1, size: 3 + random() * 6, rot: random() * 6.28, spin: (random() - .5) * 3 });
 /* 共通の亀裂描画。style={edge,core,dark,inner,shard,glowHue,width}
    幅=根元で太く先端で細く・区間ごとにうねる / 外側の柔らかい光 / 縁の影(右下へ) / 暗い溝 / 内部の強い光 / 白い芯 / 破片 */
 function drawCracks(R, p, gather, style) {
  const widen = gather ? 1 + p * 1.6 : 1;
  for (const f of cracks) {
   let q = gather ? 1 : Math.max(0, Math.min(1, (p - f.start) * 2.5));
   if (!q) continue;
   if (!gather && !fired.has(f) && q > 0) { fired.add(f); if (!f.branch) { const tip = f.pts[1]; emitSparks(tip[0] * R, tip[1] * R, 14, style.sparkHue, 150, .7); notify('crack', { strength: f.width }); } }
   const n = Math.max(2, Math.ceil(q * f.pts.length)), pts = f.pts.slice(0, n);
   const base = f.width * style.width * widen * (f.branch ? .7 : 1.25);
   const wAt = (i) => base * (1.3 - .95 * (i / f.pts.length)) * (1 + .4 * Math.sin(i * 1.9 + f.width * 7));
   const alpha = gather ? Math.max(.12, 1 - p * .75) : .95;
   const path = (dx = 0, dy = 0) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * R + dx, y * R + dy) : c.moveTo(x * R + dx, y * R + dy)); };
   /* 外側の光(柔らかく2段) */
   c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
   c.globalAlpha = alpha * (.07 + (gather ? p * .12 : 0)); c.strokeStyle = style.inner; c.lineWidth = base * 11; path(); c.stroke();
   c.globalAlpha = alpha * .16; c.lineWidth = base * 5; path(); c.stroke();
   /* 縁の影(右下に落ちる)と暗い溝: 区間ごとに幅を変える */
   c.globalCompositeOperation = 'source-over';
   for (let i = 1; i < n; i++) {
    const w = wAt(i), [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    c.globalAlpha = alpha * .85; c.strokeStyle = '#000'; c.lineWidth = w * 3.2; c.beginPath(); c.moveTo(x0 * R + 2.5, y0 * R + 2.5); c.lineTo(x1 * R + 2.5, y1 * R + 2.5); c.stroke();
    c.globalAlpha = alpha; c.strokeStyle = style.dark; c.lineWidth = w * 2.6; c.beginPath(); c.moveTo(x0 * R, y0 * R); c.lineTo(x1 * R, y1 * R); c.stroke();
   }
   /* 内部の強い光と白い芯 */
   c.globalCompositeOperation = 'lighter';
   for (let i = 1; i < n; i++) {
    const w = wAt(i), [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    c.globalAlpha = alpha * .9; c.strokeStyle = style.inner; c.lineWidth = w * 1.5; c.beginPath(); c.moveTo(x0 * R, y0 * R); c.lineTo(x1 * R, y1 * R); c.stroke();
    c.globalAlpha = alpha; c.strokeStyle = style.core; c.lineWidth = Math.max(.6, w * .55); c.beginPath(); c.moveTo(x0 * R, y0 * R); c.lineTo(x1 * R, y1 * R); c.stroke();
   }
   /* 縁の明るいハイライト(左上側)で厚みを出す */
   c.globalCompositeOperation = 'source-over'; c.globalAlpha = alpha * .35; c.strokeStyle = style.edge; c.lineWidth = Math.max(.5, base * .4); path(-1.2, -1.2); c.stroke();
   const tip = pts.at(-1);
   if (!gather) { c.globalCompositeOperation = 'lighter'; glow(tip[0] * R, tip[1] * R, 18, style.glowHue, .7 * q, style.sat); }
  }
  /* 破片: 亀裂の縁から欠けた小片。進行で外へ流れ、回る */
  c.globalCompositeOperation = 'source-over';
  for (const s of shards) {
   const q = gather ? 1 : Math.max(0, Math.min(1, (p - s.f.start) * 2.5)); if (q <= 0 || Math.ceil(q * s.f.pts.length) <= s.idx) continue;
   const [x, y] = s.f.pts[s.idx], [px, py] = s.f.pts[s.idx - 1], a = Math.atan2(y - py, x - px) + s.side * Math.PI / 2;
   const drift = (gather ? 6 + p * 34 : 2 + q * 3) * (1 + s.size / 9), gx = x * R + Math.cos(a) * drift, gy = y * R + Math.sin(a) * drift;
   c.save(); c.translate(gx, gy); c.rotate(s.rot + (gather ? p * s.spin : 0)); c.globalAlpha = gather ? Math.max(0, 1 - p * .9) : .9;
   const z = s.size * (gather ? 1 + p * .5 : 1);
   c.beginPath(); c.moveTo(-z, -z * .4); c.lineTo(z * .6, -z); c.lineTo(z, z * .7); c.lineTo(-z * .5, z * .8); c.closePath();
   const g = c.createLinearGradient(-z, -z, z, z); g.addColorStop(0, style.shard); g.addColorStop(.5, style.edge); g.addColorStop(1, style.dark);
   c.fillStyle = g; c.fill(); c.strokeStyle = style.core; c.lineWidth = .6; c.stroke(); c.restore();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
 }

 /* 祝福の封印。open=0 で無傷、open→1 で12枚の欠片に砕けて外へ飛ぶ。光源は左上からゆっくり回り、金属の反射が流れる。 */
 const sealPieces = Array.from({ length: 12 }, (_, k) => ({ a0: k * Math.PI / 6, a1: (k + 1) * Math.PI / 6, fly: 70 + random() * 90, spin: (random() - .5) * 1.2, lift: random() * .5 }));
 function drawSeal(Rs, open, t, p) {
  const lightA = -2.2 + t * .35, ease = open * open * (3 - 2 * open);
  const metal = (x0, y0, x1, y1, bright = 1) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#5a3408'); g.addColorStop(.22, '#c9922f'); g.addColorStop(.42, bright > 1 ? '#fff8dc' : '#ffe9a6'); g.addColorStop(.5, '#fff4c8'); g.addColorStop(.62, '#d9a63a'); g.addColorStop(.85, '#7a4a10'); g.addColorStop(1, '#3f2405'); return g; };
  for (const s of sealPieces) {
   const mid = (s.a0 + s.a1) / 2, dx = Math.cos(mid) * s.fly * ease, dy = Math.sin(mid) * s.fly * ease - s.lift * 40 * ease;
   c.save(); c.translate(dx, dy); c.rotate(s.spin * ease); c.globalAlpha = 1 - ease * .85;
   const wedge = (r) => { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, s.a0, s.a1); c.closePath(); };
   /* 厚み: 下にずらした暗い側面 */
   wedge(Rs); c.save(); c.translate(0, 7); c.fillStyle = '#2b1706'; c.fill(); c.restore();
   wedge(Rs); c.save(); c.translate(0, 4); c.fillStyle = '#6a4012'; c.fill(); c.restore();
   /* 表面: 光源方向に応じた反射の帯 */
   const lx = Math.cos(lightA) * Rs, ly = Math.sin(lightA) * Rs;
   const facing = Math.cos(mid - lightA);
   wedge(Rs); c.fillStyle = metal(lx, ly, -lx, -ly, facing > .3 ? 1.2 : 1); c.fill();
   /* 彫刻: 同心の溝(影+ハイライト)、花弁の筋、縁の鋲 */
   c.save(); wedge(Rs); c.clip();
   for (const rr of [.34, .58, .8]) {
    const r = Rs * rr; c.lineWidth = 2.2; c.strokeStyle = '#4a2a08'; c.beginPath(); c.arc(1, 1, r, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#fff1c2'; c.beginPath(); c.arc(-.8, -.8, r, 0, Math.PI * 2); c.stroke();
   }
   for (const a of [s.a0 + Math.PI / 18, mid, s.a1 - Math.PI / 18]) {
    const r0 = Rs * .36, r1 = Rs * .78;
    c.lineWidth = 2; c.strokeStyle = '#4a2a08'; c.beginPath(); c.moveTo(Math.cos(a) * r0 + 1, Math.sin(a) * r0 + 1); c.quadraticCurveTo(Math.cos(a + .12) * (r0 + r1) / 2, Math.sin(a + .12) * (r0 + r1) / 2, Math.cos(a) * r1 + 1, Math.sin(a) * r1 + 1); c.stroke();
    c.lineWidth = .9; c.strokeStyle = '#fff3c8'; c.beginPath(); c.moveTo(Math.cos(a) * r0 - 1, Math.sin(a) * r0 - 1); c.quadraticCurveTo(Math.cos(a + .12) * (r0 + r1) / 2, Math.sin(a + .12) * (r0 + r1) / 2, Math.cos(a) * r1 - 1, Math.sin(a) * r1 - 1); c.stroke();
   }
   const rv = Rs * .9, rx = Math.cos(mid) * rv, ry = Math.sin(mid) * rv;
   c.beginPath(); c.arc(rx + 1, ry + 1, 4.5, 0, Math.PI * 2); c.fillStyle = '#3a2006'; c.fill();
   const rg = c.createRadialGradient(rx - 1.5, ry - 1.5, 0, rx, ry, 4.5); rg.addColorStop(0, '#fff8dc'); rg.addColorStop(.6, '#d9a63a'); rg.addColorStop(1, '#6a4012');
   c.beginPath(); c.arc(rx, ry, 4.2, 0, Math.PI * 2); c.fillStyle = rg; c.fill();
   /* 流れる反射(細い明るい帯) */
   c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - ease) * .35 * Math.max(0, facing);
   c.fillStyle = metal(lx * .6, ly * .6, -lx * .6, -ly * .6, 1.2); wedge(Rs); c.fill();
   c.restore();
   /* 縁(ベベル) */
   c.globalAlpha = 1 - ease * .85; c.lineWidth = 5; c.strokeStyle = facing > 0 ? '#ffe7a8' : '#7a4a10'; c.beginPath(); c.arc(0, 0, Rs - 2.5, s.a0, s.a1); c.stroke();
   c.lineWidth = 1.2; c.strokeStyle = '#3a2006'; c.beginPath(); c.arc(0, 0, Rs - 6, s.a0, s.a1); c.stroke();
   c.restore();
  }
  /* 中央の飾り(紋章): 割れると光に飲まれる */
  c.save(); c.globalAlpha = 1 - ease; const rb = Rs * .2;
  const bg = c.createRadialGradient(-rb * .4, -rb * .4, 0, 0, 0, rb); bg.addColorStop(0, '#fff8dc'); bg.addColorStop(.55, '#d9a63a'); bg.addColorStop(1, '#5a3408');
  c.beginPath(); c.arc(2, 3, rb, 0, Math.PI * 2); c.fillStyle = '#2b1706'; c.fill();
  c.beginPath(); c.arc(0, 0, rb, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
  c.lineWidth = 1.4; c.strokeStyle = '#4a2a08'; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t * .1, r1 = rb * .85, r2 = rb * .35; c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.lineTo(Math.cos(a + Math.PI / 8) * r2, Math.sin(a + Math.PI / 8) * r2); } c.closePath(); c.stroke();
  c.restore();
  /* 割れ目から漏れる光: open が進むほど中心が白く膨らむ */
  c.globalCompositeOperation = 'lighter'; glow(0, 0, Rs * (.25 + ease * 1.1), 45, .25 + ease * .6, 95); c.globalCompositeOperation = 'source-over';
 }
 function draw(now) {
  raf = 0;
  if (!['rift', 'gather'].includes(phase) || document.hidden) return;
  const durations = DUR()[theme] || [4, 6], gather = phase === 'gather', duration = durations[gather ? 1 : 0];
  const tRaw = reduced ? duration * .65 : Math.max(0, Math.min((now - since) / 1000, duration));
  /* エネルギー場面の前半(音の静寂)は息を潜め、climaxAt で爆発する。p は「爆発の進み」(静寂中は 0) */
  const calmLen = gather ? Math.max(0, ((window.V50 && V50.climaxAt) || 7.6) - durations[0]) : 0;
  const t = tRaw, calm = gather && t < calmLen, p = gather ? Math.max(0, (t - calmLen) / Math.max(.1, duration - calmLen)) : t / duration, R = Math.max(w, h) * .8;
  const dt = Math.min(.05, (now - (draw.last || now)) / 1000); draw.last = now;
  const intensity = gather ? (calm ? .2 + .1 * Math.sin(t * 4) : .45 + p * .55) : p * .55;

  c.clearRect(0, 0, w, h);
  c.fillStyle = '#010205'; c.fillRect(0, 0, w, h);
  c.save();
  /* 画面の揺れ: 進むほど強く(最大±7px)。#world は触らず canvas だけを揺らす。 */
  const shake = reduced ? 0 : (gather ? (calm ? .6 : 1.5 + p * 5.5) : p * 2);
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
   drawCracks(R, p, gather, { edge: '#c9f4ff', core: '#ffffff', dark: '#03111d', inner: '#5fdcff', shard: '#eafcff', glowHue: 192, sat: 95, sparkHue: 195, width: 1.3 });
   c.globalCompositeOperation = 'lighter';
   /* 亀裂の先端から枝分かれする稲妻。進行で本数が増える。 */
   if (!reduced) {
    const bolts = gather ? (calm ? 1 : 3 + Math.floor(p * 3)) : 1 + Math.floor(p * 2);
    LightningFX.draw(c, { time: t, radius: R * (.3 + intensity * .45), color: '#8ff0ff', power: .5 + intensity * .5, count: bolts, reduced });
    const epoch = Math.floor(t / .92);
    if (epoch !== lastBolt) { lastBolt = epoch; emitSparks(0, 0, 10 + Math.floor(intensity * 25), 195, 220 + intensity * 200, .6); notify('bolt', { intensity }); }
   }
   /* 氷の粒が中心へ吸い込まれる */
   for (let j = 0, jn = LITE ? 48 : 95; j < jn; j++) {
    const v = (j / jn + t * .11) % 1, a = j * 2.399, r = (1 - v) * R * .7, x = Math.cos(a) * r, y = Math.sin(a) * r * .6;
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
   c.globalCompositeOperation = 'source-over';
   drawSeal(Math.min(w, h) * .34, gather ? Math.min(1, p * 1.25) : 0, t, p);
   drawCracks(R, p, gather, { edge: '#ffe9b0', core: '#fffaf0', dark: '#1d0f03', inner: '#ffc84a', shard: '#fff2c6', glowHue: 42, sat: 95, sparkHue: 45, width: 1.25 });
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
   for (let j = 0, jn = LITE ? 48 : 95; j < jn; j++) {
    const v = (j / jn + t * .11) % 1, a = j * 2.399, r = v * R * .7, x = Math.cos(a) * r, y = (v - .5) * h;
    c.save(); c.translate(x, y); c.rotate(a + t * .5); c.globalAlpha = Math.sin(v * Math.PI) * .8; c.fillStyle = j % 3 ? '#ffe0a0' : '#ffc4d8';
    c.beginPath(); c.ellipse(0, 0, 3, 7, 0, 0, Math.PI * 2); c.fill(); c.restore();
   }
   if (!reduced && !calm && now - lastSpark > 140 - intensity * 100) { lastSpark = now; emitSparks(0, 0, 4 + Math.floor(intensity * 10), 48, 120 + intensity * 160, .9); }
   /* 蓋が開いたら(gather 45%〜)、箱の中から光の柱と光線が噴き出す */
   if (gather && p > .1) {
    const k = Math.min(1, (p - .1) / .3), ly = -h * .1;
    const col = c.createLinearGradient(0, ly, 0, ly - h * .9);
    col.addColorStop(0, 'rgba(255,250,220,' + (.85 * k) + ')'); col.addColorStop(.35, 'rgba(255,225,140,' + (.45 * k) + ')'); col.addColorStop(1, 'rgba(255,210,120,0)');
    c.fillStyle = col; c.beginPath(); c.moveTo(-w * .16 * k, ly); c.lineTo(w * .16 * k, ly); c.lineTo(w * .55 * k, ly - h * .95); c.lineTo(-w * .55 * k, ly - h * .95); c.closePath(); c.fill();
    for (let j = 0; j < 14; j++) { const a = -Math.PI / 2 + (j - 6.5) * .16 + Math.sin(t * 2 + j) * .04; c.strokeStyle = 'rgba(255,240,190,' + (.12 + .2 * k) + ')'; c.lineWidth = 2 + (j % 3) * 2; c.beginPath(); c.moveTo(0, ly); c.lineTo(Math.cos(a) * h, ly + Math.sin(a) * h); c.stroke(); }
    glow(0, ly, 60 + k * 120, 48, .5 + k * .4, 100);
    if (!reduced && !calm && now - lastSpark > 50) { lastSpark = now; emitSparks(0, ly, 6 + Math.floor(k * 10), 48, 260 + k * 200, 1.1); }
   }
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
   drawCracks(R, p, gather, { edge: '#ffb070', core: '#fff6e0', dark: '#120502', inner: '#ff7a1e', shard: '#ffd9b0', glowHue: 28, sat: 100, sparkHue: 30, width: 1.3 });
   c.globalCompositeOperation = 'lighter';
   if (!reduced && !calm && now - lastSpark > 120 - intensity * 90) { lastSpark = now; emitSparks(0, 0, 5 + Math.floor(intensity * 14), 28, 160 + intensity * 220, .8); }
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
   for (let j = 0, jn = LITE ? 18 : 36; j < jn; j++) {
    const v = (j / jn + t * .17) % 1, a = j * 2.399, r = (gather ? 1 - v : v) * R * .7, x = Math.cos(a) * r, y = Math.sin(a) * r * .8;
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
   const flare = Math.max(0, (p - .5) / .5); /* 崩壊の前触れ後半で白く弾け、虹色の冒頭(一撃)へつなぐ */
   if (flare) { glow(0, 0, Math.max(w, h) * flare, theme === 'dragon' ? 190 : theme === 'blessing' ? 48 : 30, flare * .9, 90); if (!flareSent) { flareSent = true; emitSparks(0, 0, 90, theme === 'dragon' ? 195 : theme === 'blessing' ? 48 : 30, 420, 1.2); notify('flare', { theme }); } }
  }
  c.restore();

  /* 色ずれ(クロマ): 強度が高いときだけ、画面の両端に赤/青のゴーストを薄く重ねる */
  if (!reduced && !LITE && intensity > .55) {
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
   if (!lidMeasured) { const im = art.querySelector('.freeze-chest-base'); if (im) im.complete ? measureLid() : im.addEventListener('load', measureLid, { once: true }); }
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
