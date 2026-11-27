/* Fractal discharge with a hot core, diffuse corona and tapered branches. */
(function(root){
 function draw(ctx,{time=0,x=0,y=0,radius=300,color='#87dcff',power=1,count=3,reduced=false}={}){
  if(reduced||power<=0)return;
  ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
  for(let bolt=0;bolt<count;bolt++){
   const cycle=time/.92+bolt*.31,epoch=Math.floor(cycle),age=cycle-epoch;
   if(age>.39)continue;
   const envelope=Math.min(1,age/.035)*Math.exp(-age*7)*Math.min(1,(.39-age)/.07)*Math.min(power,1);
   let seed=((epoch+1)*9719+(bolt+1)*7919)>>>0;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
   const angle=bolt*2.399+random()*.9,reach=radius*(.68+random()*.32),end=[Math.cos(angle)*reach,Math.sin(angle)*reach];
   function fracture(a,b,depth,spread){if(!depth)return[a,b];const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,j=(random()-.5)*spread,m=[(a[0]+b[0])/2-dy/len*j,(a[1]+b[1])/2+dx/len*j];const l=fracture(a,m,depth-1,spread*.53),r=fracture(m,b,depth-1,spread*.53);return l.slice(0,-1).concat(r)}
   const points=fracture([0,0],end,5,reach*.3);
   function stroke(path,width,strength){ctx.globalAlpha=envelope*strength;ctx.lineWidth=width;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke()}
   const branches=[];
   for(const at of [8,16,23]){const from=points[at],a=angle+(random()>.5?1:-1)*(.4+random()*.7),len=reach*(.14+random()*.18);branches.push(fracture(from,[from[0]+Math.cos(a)*len,from[1]+Math.sin(a)*len],3,len*.32))}
   ctx.shadowColor=color;ctx.shadowBlur=18;ctx.strokeStyle=color;stroke(points,7,.15);
   ctx.shadowBlur=7;stroke(points,2.8,.65);for(const branch of branches)stroke(branch,1.4,.4);
   ctx.shadowBlur=0;ctx.strokeStyle='#f3fcff';stroke(points,.95,.95);for(const branch of branches)stroke(branch,.45,.65);
   const glow=ctx.createRadialGradient(0,0,0,0,0,Math.min(55,reach*.15));glow.addColorStop(0,'#e5faff');glow.addColorStop(.15,color);glow.addColorStop(1,'transparent');ctx.globalAlpha=envelope*.3;ctx.fillStyle=glow;ctx.fillRect(-55,-55,110,110);
  }ctx.restore();
 }
 root.LightningFX={draw};if(typeof module!=='undefined')module.exports=root.LightningFX;
})(typeof window==='undefined'?globalThis:window);
