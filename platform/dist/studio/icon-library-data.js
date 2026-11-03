/** Original model configurations shared by the gallery and offline renderer. */
export const ICON_LOOKS = [
  {id:'royal-coins',subject:'coin-stack',style:'royal-gold',title:'皇家金币',description:'抛光金属与滚花币缘，适用于钱包和奖励入口。',category:'casino',accessory:'sparkle'},
  {id:'ruby-chips',subject:'chips',style:'ruby-gold',title:'红釉筹码',description:'饱和红釉、黄金包边，保持清楚的叠放层次。',category:'casino',accessory:'sparkle'},
  {id:'obsidian-cards',subject:'cards',style:'obsidian-gold',title:'曜石王牌',description:'深色牌面与金色花色，适用于桌游分类。',category:'casino',accessory:null},
  {id:'ruby-dice',subject:'dice',style:'ruby-gold',title:'幸运双骰',description:'倾斜双骰、镶嵌点数和精致亮面。',category:'casino',accessory:null},
  {id:'gold-slot',subject:'slot-machine',style:'royal-gold',title:'黄金 Jackpot',description:'三列滚轮、侧拉杆与金属框架。',category:'casino',accessory:'sparkle'},
  {id:'gold-roulette',subject:'roulette',style:'obsidian-gold',title:'幸运轮盘',description:'红黑分区、黄金转轴与深色盘体。',category:'casino',accessory:null},
  {id:'amethyst-crown',subject:'crown',style:'amethyst-gold',title:'紫晶皇冠',description:'金色冠壁与紫晶镶嵌，适用于 VIP 等级。',category:'rewards',accessory:'sparkle'},
  {id:'sapphire-gem',subject:'diamond',style:'sapphire-chrome',title:'冰蓝钻石',description:'多层切面、冷暖明暗，保留清晰的底尖。',category:'rewards',accessory:null},
  {id:'amethyst-gift',subject:'gift',style:'amethyst-gold',title:'紫金礼盒',description:'亮漆盒身、金色丝带与立体蝴蝶结。',category:'rewards',accessory:'sparkle'},
  {id:'emerald-chest',subject:'chest',style:'emerald-gold',title:'翡翠宝箱',description:'打开的箱盖、深色内腔与金币奖励。',category:'rewards',accessory:null},
  {id:'gold-trophy',subject:'trophy',style:'royal-gold',title:'冠军奖杯',description:'流动金属反射与稳重底座，适用于赛事奖励。',category:'sports',accessory:'sparkle'},
  {id:'chrome-basketball',subject:'basketball',style:'sports-chrome',title:'竞技篮球',description:'橙铜球面和清晰沟槽，适用于体育分类。',category:'sports',accessory:null},
];

export function iconLookState(look, size=1024) {
  return {
    version:1,subject:look.subject,style:look.style,width:size,height:size,
    transparent:true,background:'#141021',gloss:86,shadow:68,lightDirection:-35,glow:8,yaw:-22,pitch:16,
    layers:[
      {id:'main',kind:look.subject,role:'main',x:0,y:.015,scale:1,rotation:look.subject==='roulette'?-4:-8,hidden:false},
      ...(look.accessory?[{id:'example-sparkle',kind:look.accessory,role:'decoration',x:.28,y:-.26,scale:.12,rotation:6,hidden:false}]:[]),
    ],
  };
}
