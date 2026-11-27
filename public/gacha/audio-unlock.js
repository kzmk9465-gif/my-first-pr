/* Unlock from the original tap, including the same-origin fire iframe. */
(function(root){
 const pending=new WeakMap();
 function prime(context){
  if(!context)return;
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
  const report=()=>{document.documentElement.dataset.audioState=context.state};report();
  if(!context.__gachaObserved){context.addEventListener('statechange',report);context.__gachaObserved=true}
  try{const s=context.createBufferSource();s.buffer=context.createBuffer(1,1,context.sampleRate);s.connect(context.destination);s.onended=()=>s.disconnect();s.start(0)}catch{}
  try{const p=context.resume();if(p&&p.catch)p.catch(()=>{})}catch{}
 }
 async function ready(context){
  prime(context);
  if(context.state==='running')return;
  await new Promise(resolve=>setTimeout(resolve,180));
  if(context.state==='running')return;
  if(pending.has(context))return pending.get(context);
  const promise=new Promise(resolve=>{
   const panel=document.createElement('div');panel.className='audio-unlock';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','音声を有効にする');
   const message=document.createElement('p');message.textContent='音を有効にして演出を再生します';
   const button=document.createElement('button');button.type='button';button.textContent='音を有効にして再生 ▶';panel.append(message,button);document.body.append(panel);
   const finish=()=>{if(context.state==='running'){context.removeEventListener('statechange',finish);panel.remove();pending.delete(context);resolve()}};
   context.addEventListener('statechange',finish);button.onclick=()=>{prime(context);finish()};button.focus();finish();
  });pending.set(context,promise);return promise;
 }
 root.GachaAudio={prime,ready};
})(window);
