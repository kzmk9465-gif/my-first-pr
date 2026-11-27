/* Seeded glass fractures and volumetric light, shared by all three themes. */
(()=>{
 const host=document.querySelector('#stage,#screen'),layer=host.querySelector('.descent-build');
 const canvas=document.createElement('canvas');canvas.className='descent-real';layer.prepend(canvas);
 const title=document.createElement('div');title.className='descent-title';title.innerHTML='<small>THE SEAL IS BREAKING</small><strong data-text=封印崩壊>封印崩壊</strong><em>その力を、解き放て。</em>';layer.append(title);
 const art=document.createElement('div');art.className='freeze-theme-art';art.innerHTML='<div class=dragon-eyes><i></i><i></i></div><img class=freeze-dragon src=real-dragon.png alt=""><img class=freeze-chest src=real-chest.png alt=""><div class=chest-light></div>';layer.append(art);
 const c=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let seed=87031;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const cracks=[];
 for(let k=0;k<11;k++){
  const angle=k*Math.PI*2/11+(random()-.5)*.3;let x=0,y=0,pts=[[0,0]];
  for(let j=1;j<=14;j++){const r=j*.052,a=angle+(random()-.5)*.15;x=Math.cos(a)*r;y=Math.sin(a)*r;pts.push([x,y]);
   if(j>2&&j%3===0){let branch=[[x,y]],ba=a+(random()>.5?1:-1)*(.4+random()*.7);for(let n=1;n<5;n++)branch.push([x+Math.cos(ba)*n*.021+(random()-.5)*.01,y+Math.sin(ba)*n*.021+(random()-.5)*.01]);cracks.push({pts:branch,start:j/22,width:.35+random()*.4});}
  }cracks.push({pts,start:random()*.15,width:.7+random()*.6});
 }
 const dust=Array.from({length:260},()=>({a:random()*Math.PI*2,r:.12+random()*.8,z:.2+random()*.8,h:random()*360,s:random()}));
 let theme='fire',phase='',since=0,raf=0,w=0,h=0;
 function resize(){w=host.clientWidth;h=host.clientHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=w*d;canvas.height=h*d;c.setTransform(d,0,0,d,0,0)}
 function glow(x,y,r,hue,alpha){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`hsla(${hue},65%,85%,${alpha})`);g.addColorStop(.18,`hsla(${hue},70%,60%,${alpha*.45})`);g.addColorStop(1,`hsla(${hue},70%,40%,0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2)}
 function draw(now){raf=0;if(!['rift','gather'].includes(phase)||document.hidden)return;
  const durations=theme==='dragon'?[3,5.8]:theme==='blessing'?[5,3.8]:[4,4.8],gather=phase==='gather',duration=durations[gather?1:0],t=reduced?duration*.65:Math.min((now-since)/1000,duration),p=t/duration,R=Math.max(w,h)*.8;
  c.clearRect(0,0,w,h);c.fillStyle='#010205';c.fillRect(0,0,w,h);c.save();c.translate(w*.5,h*.48);
  // Fractured reflective plates lift off the screen as the seal breaks.
  if(theme!=='fire'){
   c.globalCompositeOperation='lighter';
   if(theme==='dragon'){
    glow(0,0,Math.min(w,h)*.75,185,.22+p*.15);
    // Water spirals around the dragon; three pearls converge into its core.
    for(let j=0;j<7;j++){const r=(55+j*27)*(1-p*.25);c.beginPath();c.ellipse(0,35,r,r*.28,-.3+t*.08+j*.1,0,Math.PI*2);c.strokeStyle=`hsla(${175+j*6},85%,65%,${.15+p*.2})`;c.lineWidth=1.4;c.stroke()}
    for(let j=0;j<3;j++){const a=t*.6+j*Math.PI*2/3,r=(gather?1-p*.8:1)*w*.3;glow(Math.cos(a)*r,Math.sin(a)*r*.5,19,185,.7)}
    if(gather)LightningFX.draw(c,{time:t,radius:R*.65,color:'#7fe6ff',power:.6+p*.4,count:4,reduced});
   }else{
    glow(0,-30,Math.min(w,h)*.8,42,.2+p*.25);
    // Rotating gold seal opens into a crown of light, with drifting petals.
    for(let ring=0;ring<3;ring++){const r=(55+ring*40)*(gather?1+p*.9:1);c.save();c.rotate((ring%2?1:-1)*t*.13);c.strokeStyle='#ffe3a5';c.globalAlpha=.3+p*.25;c.lineWidth=1.2;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();for(let j=0;j<16;j++){const a=j*Math.PI/8;c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a)*(r+8),Math.sin(a)*(r+8));c.stroke()}c.restore()}
    if(gather)for(let j=0;j<16;j++){const a=j*Math.PI/8+t*.07;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*R,Math.sin(a)*R);c.strokeStyle='#ffd773';c.globalAlpha=.06+p*.1;c.lineWidth=5;c.stroke()}
   }
   for(let j=0;j<95;j++){const v=(j/95+t*.11)%1,a=j*2.399,r=(theme==='dragon'?1-v:v)*R*.7,x=Math.cos(a)*r,y=theme==='dragon'?Math.sin(a)*r*.6:(v-.5)*h;c.save();c.translate(x,y);c.rotate(a+t*.5);c.globalAlpha=Math.sin(v*Math.PI)*.8;c.fillStyle=theme==='dragon'?'#b7faff':j%3?'#ffe0a0':'#ffc4d8';c.beginPath();c.ellipse(0,0,theme==='dragon'?1.5:3,theme==='dragon'?4:7,0,0,Math.PI*2);c.fill();c.restore()}
   c.globalAlpha=1;if(gather&&p>.85)glow(0,0,R*(p-.85)/.15,theme==='dragon'?185:42,(p-.85)/.15*.7);
   c.restore();if(!reduced)raf=requestAnimationFrame(draw);return;
  }
  c.globalCompositeOperation='source-over';
  for(let j=0;j<22;j++){
   const a=j*Math.PI*2/22,open=gather?Math.min(1,p*2):Math.max(0,p-.45)*.4;
   const shift=open*(35+j%4*14),outer=R*(.5+j%3*.12),inner=12+open*45;
   c.save();c.translate(Math.cos(a)*shift,Math.sin(a)*shift);c.rotate(gather?open*(j%2?1:-1)*.07:0);
   const ax=Math.cos(a)*outer,ay=Math.sin(a)*outer,bx=Math.cos(a+.26)*outer,by=Math.sin(a+.26)*outer;
   c.beginPath();c.moveTo(Math.cos(a+.1)*inner,Math.sin(a+.1)*inner);c.lineTo(ax,ay);c.lineTo(bx,by);c.closePath();
   const shade=c.createLinearGradient(ax,ay,bx,by);shade.addColorStop(0,'#02060d');shade.addColorStop(.48,j%3?'#0c1a29':'#243744');shade.addColorStop(.51,'#344657');shade.addColorStop(.54,'#09111d');shade.addColorStop(1,'#02050a');
   c.globalAlpha=gather?Math.max(0,1-p*1.7):Math.min(1,p*2);c.fillStyle=shade;c.fill();c.lineWidth=.6;c.strokeStyle='#7ca2b54a';c.stroke();c.restore();
  }c.globalAlpha=1;
  c.globalCompositeOperation='lighter';glow(0,0,110+100*p,215,.22);
  // Fine white fracture edge, dark bevel and faint chromatic reflection.
  for(const f of cracks){let q=gather?1:Math.max(0,Math.min(1,(p-f.start)*2.5));if(!q)continue;
   const points=f.pts.slice(0,Math.max(2,Math.ceil(q*f.pts.length)));c.globalAlpha=gather?Math.max(.04,(1-p)*.8):.85;
   for(const [offset,color,width] of [[2,'#14252e',f.width*2.5],[-.8,'#53768a',f.width],[0,'#dcf0f5',f.width*.55]]){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*R+offset,y*R):c.moveTo(x*R+offset,y*R));c.strokeStyle=color;c.lineWidth=width;c.stroke()}
   const tip=points.at(-1);if(!gather)glow(tip[0]*R,tip[1]*R,14,205,.55*q);
  }
  c.globalAlpha=1;
  if(gather){
   // Flame tongues rise from the molten fracture, growing taller toward release.
   for(let j=0;j<30;j++){const x=(j/29-.5)*w,y=h*.35,reach=(.2+p*.6)*h*(.4+(j%7)/10);c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-25*Math.sin(t*3+j),y-reach*.3,x+30*Math.cos(t*2+j),y-reach*.7,x+12*Math.sin(t*4+j),y-reach);c.strokeStyle=j%3?'#ff641b':'#ffe1a0';c.globalAlpha=.1+p*.18;c.lineWidth=4+j%5;c.stroke()}c.globalAlpha=1;
   // Layered helical filaments: broad translucent body, narrow luminous edge.
   for(let arm=0;arm<6;arm++)for(let pass=0;pass<2;pass++){
    c.beginPath();for(let k=0;k<=65;k++){const u=k/65,a=arm*Math.PI/3+u*5.5-t*(.45+p*.65),r=(20+Math.pow(u,1.6)*Math.min(w,h)*.78)*(1-p*.4),x=Math.cos(a)*r,y=Math.sin(a)*r*.62+Math.sin(u*12+t)*8;k?c.lineTo(x,y):c.moveTo(x,y)}
    c.globalAlpha=pass?.65:.09;c.strokeStyle=`hsl(${15+arm*7},85%,${pass?78:48}%)`;c.lineWidth=pass?1.5:16+p*15;c.stroke();
   }c.globalAlpha=1;
   // Soft overlapping plasma volumes create depth without flat rainbow wedges.
   for(let j=0;j<65;j++){const a=j*2.399+t*(.6+j%3*.15)*(1+p),rad=(.12+(j%11)/18)*(1-p*.67)*Math.min(w,h),x=Math.cos(a)*rad,y=Math.sin(a)*rad*.58;glow(x,y,25+(j%7)*8,15+j%4*12,.045+.06*p)}
   for(const d of dust){const v=(d.s+t*.28*(1+p))%1,r=(1-v)*(1-p*.6)*R*d.r,a=d.a+t*(.7+d.z)*(1+p)+v*1.8,x=Math.cos(a)*r,y=Math.sin(a)*r*.62;
    c.globalAlpha=Math.sin(v*Math.PI)*d.z*.9;c.strokeStyle=`hsl(${15+d.h/12},85%,70%)`;c.lineWidth=.3+d.z*.8;c.beginPath();c.moveTo(x,y);const a2=a-.045-d.z*.055;c.lineTo(Math.cos(a2)*(r+(12+20*p)*d.z),Math.sin(a2)*(r+(12+20*p)*d.z)*.62);c.stroke();
   }c.globalAlpha=1;glow(0,0,30+p*65,215,.6);glow(0,0,12+p*18,40,.8);
   const flare=Math.max(0,(p-.88)/.12);if(flare){glow(0,0,Math.max(w,h)*flare,210,flare*.8)}
  }else{glow(0,0,9+12*p,210,.45*p)}
  
  // Staggered pressure waves, splinter highlights and branching electrical arcs.
  const intensity=gather?.45+p*.55:p*.55;
  if(!reduced){
   for(let j=0;j<3;j++){const wave=(t*.48+j/3)%1,r=wave*Math.min(w,h)*.95;c.globalAlpha=(1-wave)*intensity*.45;c.strokeStyle=`hsl(${20+j*10},85%,72%)`;c.lineWidth=1+(1-wave)*2;c.beginPath();c.ellipse(0,0,r,r*.65,-.3,0,Math.PI*2);c.stroke()}
   LightningFX.draw(c,{time:t,radius:R*(.25+intensity*.4),color:'#ffb86b',power:intensity,count:gather?4:2,reduced});
   for(let j=0;j<36;j++){const v=(j/36+t*.17)%1,a=j*2.399,r=(gather?1-v:v)*R*.7,x=Math.cos(a)*r,y=Math.sin(a)*r*.8;c.save();c.translate(x,y);c.rotate(a+t*.4);c.globalAlpha=Math.sin(v*Math.PI)*intensity*.7;const z=2+j%4;c.fillStyle=j%3?'#96c8dc':'#fff0c4';c.beginPath();c.moveTo(-z,-z*2);c.lineTo(z*.7,-z);c.lineTo(z,z*2);c.closePath();c.fill();c.restore()}
  }
  c.globalAlpha=1;
  if(gather){glow(0,0,60+p*100,280,.18+p*.18);glow(0,0,15+p*40,45,.5);}
  c.restore();if(!reduced)raf=requestAnimationFrame(draw);
 }
 function sync(){const next=host.dataset.scene||host.dataset.phase;if(next===phase)return;phase=next;since=performance.now();if(raf)cancelAnimationFrame(raf);raf=0;if(['rift','gather'].includes(phase)){theme=host.dataset.theme||'fire';layer.dataset.freezeTheme=theme;const text={fire:['灼熱崩壊','炎神覚醒','INFERNO AWAKENING'],dragon:['龍眼開眼','雷龍降臨','THUNDER DRAGON'],blessing:['祝福の封印','奇跡の開花','GOLDEN BLESSING']}[theme];const strong=title.querySelector('strong');strong.textContent=text[phase==='rift'?0:1];strong.dataset.text=strong.textContent;title.querySelector('small').textContent=text[2];title.querySelector('em').textContent=phase==='rift'?'静寂の先に、奇跡。':'伝説が、目を覚ます。';resize();raf=requestAnimationFrame(draw)}}
 new MutationObserver(sync).observe(host,{attributes:true,attributeFilter:['data-scene','data-phase']});addEventListener('resize',()=>{resize();if(reduced)draw(performance.now())});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['rift','gather'].includes(phase)){since=performance.now();if(!raf)raf=requestAnimationFrame(draw)}});sync();
})();
