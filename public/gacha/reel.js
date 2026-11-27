'use strict';
const $=s=>document.querySelector(s),stage=$('#stage'),canvas=$('#atmosphere'),ctx=canvas.getContext('2d');
const themeNames={fire:'炎 刃 解 放',dragon:'龍 神 降 臨',blessing:'運 命 の 宝 箱'};
let theme='fire',run=null,sequence=[],playing=false,startAt=0,sceneAt=0,scene='home',muted=false,loading=false,loadToken=0,variant=0,tier='base',W=560,H=900,lastTime=0,pausedAt=null,particles=[],cutCount=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let audio,volume,source=null;const buffers={},urls={};
for(const n of ['intro','count','victory','prize','summon','dragon'])urls['old_'+n]='audio/'+n+'.mp3?v=13';
for(const n of ['intro','count','victory','prize','summon','dragon','curtain','celebrate','awaken','shutoff'])urls[n]='original-audio/'+n+'.mp3?v=16';
const score=new GachaScore();let preload;
function ensureAudio(){if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();volume=audio.createGain();volume.gain.value=muted?0:.82;const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-4;limiter.knee.value=3;limiter.ratio.value=10;volume.connect(limiter);limiter.connect(audio.destination)}GachaAudio.prime(audio);return audio}
function initAudio(){ensureAudio();if(!preload)preload=Promise.all(Object.entries(urls).map(async([key,url])=>{const response=await fetch(url);if(!response.ok)throw Error('音源を読み込めません');buffers[key]=await audio.decodeAudioData(await response.arrayBuffer())})).catch(e=>{preload=null;throw e});return preload}
function stopAudio(){if(source){try{source.stop()}catch{}source.disconnect();source=null}}
function track(name){stopAudio();if(!name||!audio)return;let key=theme!=='blessing'&&buffers['old_'+name]?'old_'+name:name;if(!buffers[key])return;source=audio.createBufferSource();source.buffer=buffers[key];const fx=audio.createGain();fx.gain.value=.38;source.connect(fx);fx.connect(volume);source.onended=()=>fx.disconnect();source.start()}
function pulse(){stage.classList.remove('flash');void stage.offsetWidth;if(!reduced)stage.classList.add('flash')}
function setTier(v){tier=v;stage.dataset.tier=v}
function makeSequence(effect,rank,timing='auto'){let list=[['seal',1.5],['draw',1.9],['charge1',1.15],['charge2',1.15],['charge3',1.15]];
 if(effect==='preview')list.push(['preview',3.3],['awaken',1.6]);
 if(effect==='revival')list.push(['miss',1.4],['silence',1.2],['whisper',1.3],['awaken',2]);
 else if(effect==='premium')list.push(['silence',.75],['awaken',2]);
 list.push(...ButtonAnticipation.sequence(effect));
 if(['SS','S','A'].includes(rank))list.push(['strike',1.2]);else list.push(['miss',.8]);
 if(rank==='SS')list.push(['rush',2.7]);
 list.push(['reveal',2.5]);if(effect==='freeze')list=FreezePatterns.insert(list,theme,timing);let end=0;return list.map(([name,duration])=>({name,start:end,end:end+=duration}));}
function enter(name){scene=name;sceneAt=performance.now();stage.dataset.scene=name;stage.dataset.cue='none';particles=[];const label=$('#scene-title');label.textContent='';label.style.animation='none';void label.offsetWidth;label.style.animation='';
 if(name==='seal'){stopAudio();score.start('opening-'+theme,true);label.textContent=themeNames[theme];emit(55)}
 if(name==='draw'){label.textContent='運命を掴め';score.cue(1);emit(70)}
 if(name.startsWith('charge')){let level=Number(name.at(-1));/* Theme music continues through charging. */
  const max={B:1,A:2,S:3,SS:3}[run.floor]||0;
  if(run.effect==='chance'||run.effect==='premium'){const show=Math.min(level,max);setTier(['base','B','A','S'][show]);if(show){score.cue(show);stage.dataset.cue=String(variant);for(const el of [$('#character-cut'),$('#charged-runes')]){el.style.animation='none';void el.offsetWidth;el.style.animation=''}cutCount++;}}
  label.textContent=theme==='fire'?['','力を込めろ','刃が、応える','解き放て'][level]:theme==='dragon'?['','一珠、共鳴','龍眼、開眼','龍神を呼べ'][level]:['','運命の選択','箱が、応える','光を掴め'][level];emit(25+level*15);if(level===3&&run.floor)pulse();
 }
 if(name==='preview'){$('#preview-name').textContent=theme==='dragon'?'龍神、覚醒。':'祝福の扉、開く。';track('awaken')}
 if(name==='pushtease'){stopAudio();score.start('push',true)}
 if(name==='pushvoid'){stopAudio();score.stop()}
 if(name==='push'){stopAudio();score.start('push',true);$('#cinema-push-button').focus({preventScroll:true})}
 if(name==='hold'){stopAudio();score.stop()}
 if(name==='shutdown'){score.stop();stopAudio();score.play('powerdown',false,.95)}
 if(name==='silence'||name==='whisper'){stopAudio();score.stop()}
 if(name==='rift'){stopAudio();score.stop();score.start('descent-reference')}
 if(name==='gather'){stopAudio();/* Continue the reference through the energy scene. */}
 if(name==='rainbow'){stopAudio();setTier('SS');if(run.effect!=='freeze')score.start('burst');emit(190);label.textContent=''}
 if(name==='awaken'){score.start('resolve');setTier('SS');track('awaken');pulse();emit(150)}
 if(name==='strike'){score.start('resolve');$('#strike b').textContent=theme==='fire'?'一 閃':theme==='dragon'?'咆 哮':'開 放';if(!['SS','S'].includes(run.rank))setTier('A');track('victory');pulse();emit(120)}
 if(name==='rush'){setTier('SS');$('#pack .pack-front>img:not(.relic-face)').src='real-shizuku.png';track(theme==='blessing'?'celebrate':'victory');pulse();emit(130)}
 if(name==='miss'){score.stop();stopAudio();$('#miss small').hidden=run.effect!=='revival';}
 if(name==='reveal'){setTier(run.rank);$('#reveal-rank').textContent=run.rank+' RANK';$('#reveal-title').textContent={SS:'極 彩 降 臨',S:'特 賞 獲 得',A:'A RANK',B:'B RANK',C:'C RANK'}[run.rank];if(['SS','S','A'].includes(run.rank)){track('prize');pulse();emit(100)}else stopAudio()}
}
async function begin(){if(theme==='fire'){openSword();return}if(loading)return;loading=true;const token=++loadToken;$('#start').disabled=true;$('#again').disabled=true;$('#start').textContent='音を準備中…';try{await initAudio();await score.prepare(audio,volume);await GachaAudio.ready(audio)}catch(e){if(token===loadToken){$('#start').textContent='読み込み失敗・再試行';$('#start').disabled=false;$('#again').disabled=false;loading=false}return}if(token!==loadToken)return;loading=false;$('#start').disabled=false;$('#again').disabled=false;$('#start').innerHTML='演出をスタート <span>▶</span>';$('#settings').open=false;run=GachaRules.choose($('#effect').value,$('#rank').value);variant=$('#variant').value==='auto'?Math.floor(Math.random()*3):Number($('#variant').value);sequence=makeSequence(run.effect,run.rank,$('#freeze-timing').value);setTier('base');$('#pack .pack-front>img:not(.relic-face)').src='real-shizuku.png';$('#home').hidden=true;$('#result').hidden=true;$('#movie').hidden=false;$('#controls').hidden=false;playing=true;cutCount=0;startAt=performance.now();enter('seal')}
function finish(){if(!run)return;playing=false;stopAudio();score.stop();scene='result';stage.dataset.scene=scene;setTier(run.rank);particles=[];$('#movie').hidden=true;$('#controls').hidden=true;$('#result').hidden=false;$('#result-rank').textContent=run.rank+' RANK';$('#result-name').textContent=run.rank+'ランク景品（仮）'}
function home(){loadToken++;loading=false;playing=false;stopAudio();score.stop();scene='home';stage.dataset.scene=scene;setTier('base');particles=[];$('#home').hidden=false;$('#movie').hidden=true;$('#result').hidden=true;$('#controls').hidden=true;$('#start').disabled=false;$('#again').disabled=false;$('#start').innerHTML='演出をスタート <span>▶</span>'}
let wasFixed=false;function sync(){$('#freeze-setting').hidden=!['freeze','auto'].includes($('#effect').value);const fixed=['freeze','premium','revival','preview'].includes($('#effect').value);$('#rank').disabled=fixed;if(fixed)$('#rank').value='SS';else if(wasFixed)$('#rank').value='auto';wasFixed=fixed}
$('#effect').onchange=sync;sync();$('#start').onclick=begin;$('#again').onclick=begin;$('#exit').onclick=home;$('#back').onclick=home;$('#skip').onclick=finish;$('#brand').onclick=e=>{e.preventDefault();home()};$('#sound').onclick=()=>{muted=!muted;if(volume)volume.gain.value=muted?0:.82;if(!muted&&audio)GachaAudio.prime(audio);$('#sound').textContent=muted?'SOUND OFF':'SOUND ON'};
for(const button of document.querySelectorAll('[data-theme]'))if(button.tagName==='BUTTON')button.onclick=()=>{theme=button.dataset.theme;stage.dataset.theme=theme;for(const b of document.querySelectorAll('.theme-picker button')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button))}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')home()});document.addEventListener('visibilitychange',()=>{if(document.hidden){pausedAt=performance.now();audio?.suspend()}else{if(pausedAt!==null&&playing){const delay=performance.now()-pausedAt;startAt+=delay;sceneAt+=delay}pausedAt=null;audio&&GachaAudio.prime(audio)}});
function resize(){W=stage.clientWidth;H=stage.clientHeight;const ratio=(matchMedia('(max-width: 560px)').matches||(navigator.hardwareConcurrency||8)<=4||/iPhone|iPad|Android/i.test(navigator.userAgent))?1:Math.min(devicePixelRatio,2);/* v50: 軽量端末は等倍 */canvas.width=W*ratio;canvas.height=H*ratio;ctx.setTransform(ratio,0,0,ratio,0,0)}addEventListener('resize',resize);resize();
function emit(n){if(reduced)return;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=3+Math.random()*13;particles.push({x:W*.5,y:H*.48,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,size:2+Math.random()*7,angle:a})}}
function render(t){requestAnimationFrame(render);if(document.hidden)return;const dt=Math.min(2,(t-lastTime)/16.67||1);lastTime=t;ctx.clearRect(0,0,W,H);if(playing){const elapsed=(t-startAt)/1000;const next=sequence.find(x=>elapsed<x.end);if(!next){finish();return}if(next.name!==scene)enter(next.name)}
 if(['shutdown','silence','whisper','hold'].includes(scene))return;
 const age=(t-sceneAt)/1000,hot=['rainbow','awaken','strike','rush','reveal'].includes(scene),charging=scene.startsWith('charge');let color={base:theme==='fire'?'#ff9d43':theme==='dragon'?'#55e9ee':'#bc8fff',B:'#5bcbff',A:'#ff664d',S:'#ffdc69',SS:'#ffe5ac',C:'#809ab5'}[tier]||'#ffd77c';
 if(playing&&(scene==='charge3'||scene==='strike'))LightningFX.draw(ctx,{time:age,x:W*.5,y:H*.42,radius:H*.5,color:theme==='dragon'?'#81eaff':'#ead0ff',power:.65,count:3,reduced});
 ctx.save();ctx.globalCompositeOperation='screen';
 // Perspective trails move from the vanishing point toward all four edges.
 if(playing&&!reduced&&scene!=='miss'){const count=hot?58:charging?30:scene==='draw'?45:18;ctx.strokeStyle=color;for(let i=0;i<count;i++){const a=i*2.39996,p=((age*(hot?.65:.35)+i*.073)%1),r=40+p*p*Math.max(W,H),length=12+p*p*(hot?150:60);ctx.globalAlpha=p*(hot?.65:.35);ctx.lineWidth=1+p*2;ctx.beginPath();ctx.moveTo(W/2+Math.cos(a)*r,H*.48+Math.sin(a)*r);ctx.lineTo(W/2+Math.cos(a)*(r+length),H*.48+Math.sin(a)*(r+length));ctx.stroke()}}
 if(playing&&['draw','rush','strike'].includes(scene)&&!reduced){for(let i=0;i<26;i++){const p=(age*.4+i/26)%1,a=i*2.4,r=30+p*p*Math.max(W,H)*.75;ctx.save();ctx.translate(W/2+Math.cos(a)*r,H*.48+Math.sin(a)*r);ctx.rotate(a+age*(i%2?2:-2));ctx.globalAlpha=Math.sin(p*Math.PI)*.8;ctx.fillStyle=i%3?color:'#eefaff';const z=3+p*15;if(scene==='draw'){ctx.beginPath();ctx.ellipse(0,0,1.2,z*.8,0,0,Math.PI*2);ctx.fill()}else{ctx.beginPath();ctx.moveTo(-z,-z*.5);ctx.lineTo(z*.5,-z);ctx.lineTo(z,z*.8);ctx.closePath();ctx.fill()}ctx.restore()}}
 if(!playing||charging){for(let i=0;i<28;i++){const x=(i*97+t*.012)%W,y=H-((t*.035+i*83)%H);ctx.globalAlpha=.15+.25*Math.abs(Math.sin(t*.001+i));ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,1+i%3,0,7);ctx.fill()}}
 particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.05*dt;p.life-=.018*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle+age);ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*2);ctx.restore()}
 ctx.restore();}
requestAnimationFrame(render);

const swordFrame=$('#sword-embed');let swordLoaded=false;let pendingSword=false;
function openSword(){ensureAudio();stopAudio();score.stop();playing=false;stage.hidden=true;swordFrame.hidden=false;if(swordLoaded&&typeof swordFrame.contentWindow.begin==='function'){swordFrame.contentWindow.begin({effect:$('#effect').value,rank:$('#rank').value,variant:$('#variant').value,freezeTiming:$('#freeze-timing').value,audioContext:audio,muted})}else pendingSword=true}
swordFrame.addEventListener('load',()=>{swordLoaded=true;if(pendingSword){pendingSword=false;swordFrame.contentWindow.begin({effect:$('#effect').value,rank:$('#rank').value,variant:$('#variant').value,freezeTiming:$('#freeze-timing').value,audioContext:audio,muted})}});
window.closeSwordPreview=()=>{pendingSword=false;swordFrame.hidden=true;stage.hidden=false;home()};
function syncThemeSettings(){$('#settings').hidden=false;$('.demo-note').textContent='無料の演出サンプル · 景品は仮画像'}
for(const btn of document.querySelectorAll('.theme-picker button'))btn.addEventListener('click',syncThemeSettings);syncThemeSettings();

$('#cinema-push-button').onclick=()=>{if(!playing||scene!=='push')return;const part=sequence.find(x=>x.name==='push');startAt=performance.now()-part.end*1000;score.play('hit',false,.65);pulse()};
