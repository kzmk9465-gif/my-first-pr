/* Music and user-supplied reference effects share the mute and limiter. */
class GachaScore{
 constructor(){this.buffers={};this.voices=new Set();this.bed=null}
 async prepare(context,output){this.ac=context;this.output=output;if(!this.ready)this.ready=Promise.all(['opening-fire','opening-dragon','opening-blessing','build','resolve','push','hit','cue1','cue2','cue3','powerdown','burst','descent-reference'].map(async n=>{const r=await fetch('score/'+({'opening-fire':'opening-fire-bright','opening-dragon':'opening-dragon-bright','opening-blessing':'opening-blessing-bright',powerdown:'reference-powerdown',burst:'reference-burst'}[n]||n)+'.mp3');if(!r.ok)throw Error('score');this.buffers[n]=await context.decodeAudioData(await r.arrayBuffer())})).catch(e=>{this.ready=null;throw e});return this.ready}
 play(name,loop=false,level=.5){if(!this.buffers[name])return;const s=this.ac.createBufferSource(),g=this.ac.createGain();s.buffer=this.buffers[name];s.loop=loop;g.gain.value=level;s.connect(g);g.connect(this.output);this.voices.add(s);s.onended=()=>{this.voices.delete(s);s.disconnect();g.disconnect()};s.start();return s}
 start(name,loop=false){this.stop();this.bed=this.play(name,loop,.48)}
 cue(level){this.play('cue'+Math.min(3,level),false,.55)}
 stop(){for(const s of this.voices){try{s.stop()}catch{}}this.voices.clear();this.bed=null}
}
