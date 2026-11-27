/* Timings change suspense only; the chosen SS prize never changes. */
(function(root){
const ids=['opening','arrival','charge','push','miss','impact'];
function insert(list,kind,selected='auto',random=Math.random){
 const id=ids.includes(selected)?selected:ids[Math.min(5,Math.floor(random()*6))];
 const anchors=kind==='fire'?{opening:'tunnel',arrival:'arrive',charge:'sword',push:'push',miss:'sword',impact:'swing'}:{opening:'seal',arrival:'draw',charge:'charge2',push:'push',miss:'charge3',impact:'strike'};
 const result=list.map(x=>x.slice());let at=result.findIndex(x=>x[0]===anchors[id]);if(at<0)throw Error('Missing freeze anchor');
 if(id==='opening')result[at][1]=.65;
 if(id==='charge')result[at][1]=.6;
 const durations=kind==='dragon'?[3,7]:kind==='blessing'?[5,5]:[4,6];
 const cut=kind==='fire'?[['shutdown',1.98],['black',3],['rift',durations[0]],['gather',durations[1]],['rainbow',2.6]]:[['hold',.2],['shutdown',1.98],['silence',3],['rift',durations[0]],['gather',durations[1]],['rainbow',2.6]];
 if(id==='miss')cut.unshift(['miss',1.3]);
 // Freeze is the finale: do not resume charging, PUSH, or premium scenes.
 const prize=result.find(x=>x[0]===(kind==='fire'?'win':'reveal'));
 if(!prize)throw Error('Missing freeze prize');
 result.splice(at+1,result.length-at-1,...cut,prize);return result;
}
root.FreezePatterns={ids,insert};if(typeof module!=='undefined')module.exports=root.FreezePatterns;
})(typeof window==='undefined'?globalThis:window);
