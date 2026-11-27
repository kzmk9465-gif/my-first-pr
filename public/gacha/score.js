/* v50: 参考音源(動画抽出)は使わない。プチュン/炸裂/降臨は scripts/make_original_descent.mjs で合成したオリジナル(wav)。キー名 descent-reference は同期のため据え置き。 */
class GachaScore{
 constructor(){this.buffers={};this.voices=new Set();this.bed=null}
 async prepare(context,output){this.ac=context;if(!this.air||this.airFor!==output){this.air=context.createBiquadFilter();this.air.type='highshelf';this.air.frequency.value=2600;this.air.gain.value=(window.V50&&V50.airDb)||0;this.air.connect(output);this.airFor=output}this.output=this.air;if(!this.ready)this.ready=Promise.all(['opening-fire','opening-dragon','opening-blessing','build','resolve','push','hit','cue1','cue2','cue3','powerdown','burst','descent-reference'].map(async n=>{const r=await fetch('score/'+({'opening-fire':'opening-fire-bright.mp3','opening-dragon':'opening-dragon-bright.mp3','opening-blessing':'opening-blessing-bright.mp3',powerdown:'original-powerdown.wav',burst:'original-burst.wav','descent-reference':'original-descent.wav'}[n]||n+'.mp3'));if(!r.ok)throw Error('score');this.buffers[n]=await context.decodeAudioData(await r.arrayBuffer())})).catch(e=>{this.ready=null;throw e});return this.ready}
 play(name,loop=false,level=.5){if(!this.buffers[name])return;const s=this.ac.createBufferSource(),g=this.ac.createGain();s.buffer=this.buffers[name];s.loop=loop;g.gain.value=level;s.connect(g);g.connect(this.output);this.voices.add(s);s.onended=()=>{this.voices.delete(s);s.disconnect();g.disconnect()};s.start();return s}
 start(name,loop=false){this.stop();this.bed=this.play(name,loop,.48)}
 cue(level){this.play('cue'+Math.min(3,level),false,.55)}
 stop(){for(const s of this.voices){try{s.stop()}catch{}}this.voices.clear();this.bed=null;if(this.onStop)this.onStop()}
 /* v50: 外部で作った音源(oscillator等)を登録。stop()で一緒に止まる。 */
 track(node){this.voices.add(node);node.onended=()=>{this.voices.delete(node);try{node.disconnect()}catch{}}}
}
