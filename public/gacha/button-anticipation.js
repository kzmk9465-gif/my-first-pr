/* A tease changes presentation only; it never changes the chosen prize. */
(function(root){
 function sequence(effect,random=Math.random){const appears=effect!=='normal'||random()>=.28;return [['pushtease',3.2],appears?['push',4]:['pushvoid',.9]]}
 root.ButtonAnticipation={sequence};if(typeof module!=='undefined')module.exports=root.ButtonAnticipation;
})(typeof window==='undefined'?globalThis:window);
