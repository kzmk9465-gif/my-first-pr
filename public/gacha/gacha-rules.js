/* Demo weights only. No payment, stock or production lottery. */
(function(root){
const ranks=['SS','S','A','B','C'];
const weights=[3,9,18,25,45];
function weighted(random=Math.random){let n=random()*100;for(let i=0;i<weights.length;i++){n-=weights[i];if(n<0)return ranks[i]}return 'C'}
function choose(effect='auto',rank='auto',random=Math.random){
 let floor={chance:'A',chanceB:'B',chanceA:'A',chanceS:'S',premium:'SS',revival:'SS',freeze:'SS',preview:'SS'}[effect]||null;
 if(effect==='premium'||effect==='revival'||effect==='freeze'||effect==='preview')return {effect,rank:'SS',floor:'SS'};
 if(effect.startsWith('chance'))effect='chance';
 if(rank==='auto'){rank=weighted(random);if(floor&&ranks.indexOf(rank)>ranks.indexOf(floor))rank=floor}
 if(!ranks.includes(rank))throw Error('Unknown rank');
 if(floor&&ranks.indexOf(rank)>ranks.indexOf(floor))rank=floor;
 if(effect==='auto'){const n=random();effect=rank==='SS'?(n<.15?'preview':n<.3?'freeze':n<.65?'premium':n<.8?'revival':'normal'):(rank!=='C'&&n<.7?'chance':'normal');floor=['premium','revival','freeze','preview'].includes(effect)?'SS':effect==='chance'?rank:null}
 return {effect,rank,floor};
}
const patterns={
 countdown:{B:['火の粉増量','青炎拡大','数字の震動'],A:['赤炎変化','赤文字カウント','炎柱出現'],S:['金炎噴出','金文字カウント','カウント飛ばし'],SS:['虹炎降臨','逆回転の虹炎','暗転突破']},
 dragon:{B:['龍眼発光','一珠点灯','水面の龍影'],A:['赤眼覚醒','二珠点灯','龍の咆哮'],S:['金龍降臨','三金珠点灯','黄金雷撃'],SS:['虹龍降臨','三虹珠共鳴','龍神覚醒']},
 theater:{B:['照明増灯','幕の予兆','銀の紙吹雪'],A:['赤い照明','二重開幕','金光の予兆'],S:['黄金の幕','金の紙吹雪','金のスポット'],SS:['虹の幕','虹の照明','祝福のフィナーレ']}
};
function cues(theme,run,variant='auto',random=Math.random){if(run.effect==='normal'||run.effect==='revival'||run.effect==='freeze'||effect==='preview')return [];const floors=run.floor==='SS'?['B','A','S']:['B','A','S'].slice(0,['B','A','S'].indexOf(run.floor)+1);return floors.map((floor,i)=>{const v=variant==='auto'?Math.min(2,Math.floor(random()*3)):Number(variant);return {floor,variant:v,label:patterns[theme][floor][v],at:(i+1)/(floors.length+1)}})}
function timeline(theme,effect){let a=theme==='countdown'?[['intro',3.4],['count',9]]:theme==='dragon'?[['summon',4],['dragon',6]]:[['curtain',6],['celebrate',3]];
 if(effect==='freeze'){a=theme==='countdown'?[['intro',3.4],['count',.6]]:theme==='dragon'?[['summon',4]]:[['curtain',4]];a.push(['freezehold',.8],['shutoff',.65],['frozen',3.2],['awaken',4],['rainbow',3]);}
 else if(effect==='revival')a.push(['provisional',2.2],['blackout',1.5],['revive',2.8],['rainbow',4]);
 else if(effect==='premium')a.push(['blackout',1.8],['rainbow',4],['victory',2.8]);
 else a.push(['blackout',.7]);
 if(['freeze','premium','revival'].includes(effect))a.push(['breach',2.2],['slash',1.4],['packrush',4.2]);a.push(['prize',4]);let end=0;return a.map(([scene,duration])=>({scene,start:end,end:end+=duration}));
}
root.GachaRules={choose,timeline,ranks,patterns,cues};if(typeof module!=='undefined')module.exports=root.GachaRules;
})(typeof window==='undefined'?globalThis:window);
