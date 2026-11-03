/** Icon Studio's authored models and palettes. No network or AI service required. */
import { renderIconScene } from './icon-3d-engine.js';
export const ICON_SUBJECTS = [
  {id:'coin-stack',name:'金币堆',category:'casino',note:'立币与精密滚花边'},
  {id:'chips',name:'赌场筹码',category:'casino',note:'亮漆筹码与金属环'},
  {id:'cards',name:'王牌扑克',category:'casino',note:'黑桃 A 与红心 A'},
  {id:'dice',name:'幸运骰子',category:'casino',note:'双骰与镶嵌点数'},
  {id:'slot-machine',name:'老虎机',category:'casino',note:'三列滚轮与金色拉杆'},
  {id:'roulette',name:'幸运轮盘',category:'casino',note:'红黑盘格与金属转轴'},
  {id:'crown',name:'VIP 皇冠',category:'rewards',note:'黄金冠壁与宝石镶嵌'},
  {id:'diamond',name:'切面钻石',category:'rewards',note:'多层切面与明暗折射'},
  {id:'gift',name:'奖励礼盒',category:'rewards',note:'金属丝带与立体蝴蝶结'},
  {id:'chest',name:'奖励宝箱',category:'rewards',note:'开启的宝箱与金币'},
  {id:'trophy',name:'冠军奖杯',category:'sports',note:'抛光杯壁与黑金底座'},
  {id:'medal',name:'荣誉勋章',category:'rewards',note:'金属勋章与双尾绶带'},
  {id:'shield',name:'VIP 盾徽',category:'rewards',note:'亮漆盾面与金色边框'},
  {id:'wallet',name:'奖励钱包',category:'casino',note:'皮革结构与金币卡片'},
  {id:'football',name:'足球',category:'sports',note:'缝线球面与金色徽环'},
  {id:'basketball',name:'篮球',category:'sports',note:'橙铜球面与立体沟槽'},
];
export const ICON_STYLES = [
  {id:'royal-gold',name:'皇家鎏金',note:'黄金 · 紫晶',primary:'#edb434',accent:'#8c41de',metal:'#efb32c',body:'#4a245f',dark:'#54240b',gem:'#9944e7',metallic:true},
  {id:'ruby-gold',name:'红宝石金',note:'红釉 · 黄金',primary:'#ba1748',accent:'#efb83d',metal:'#efb32c',body:'#a81437',dark:'#350920',gem:'#df1b64',metallic:true},
  {id:'emerald-gold',name:'祖母绿金',note:'翡翠 · 黄金',primary:'#0b9875',accent:'#ebbc4a',metal:'#e9b54b',body:'#087e63',dark:'#073d36',gem:'#0ed095',metallic:true},
  {id:'sapphire-chrome',name:'冰蓝铂银',note:'蓝晶 · 铂银',primary:'#2864dd',accent:'#6ce6ff',metal:'#b8cfdf',body:'#204ac5',dark:'#071c5a',gem:'#3a9bff',metallic:true},
  {id:'amethyst-gold',name:'紫晶鎏金',note:'紫晶 · 香槟金',primary:'#8432c6',accent:'#e9b766',metal:'#e8bd6b',body:'#6e209c',dark:'#2d0e55',gem:'#b04dff',metallic:true},
  {id:'rose-gold',name:'玫瑰金',note:'玫铜 · 烟晶',primary:'#d58468',accent:'#d954a9',metal:'#df9b78',body:'#7f2956',dark:'#4e1832',gem:'#ff66b5',metallic:true},
  {id:'obsidian-gold',name:'曜石黑金',note:'黑釉 · 黄金',primary:'#232438',accent:'#efb636',metal:'#e3ad35',body:'#1b2034',dark:'#080b17',gem:'#cf8d20',metallic:true},
  {id:'sports-chrome',name:'竞技铬橙',note:'熔橙 · 铬银',primary:'#ef6a20',accent:'#5acbff',metal:'#b6c8d6',body:'#df4d13',dark:'#402112',gem:'#f28e29',metallic:true},
];
export const ICON_ACCESSORIES = [
  {id:'coin',name:'金币'}, {id:'chip',name:'筹码'}, {id:'gem',name:'宝石'},
  {id:'sparkle',name:'四角星光'}, {id:'star',name:'金星'}, {id:'ring',name:'金属光环'},
  {id:'lightning',name:'闪电'}, {id:'laurel',name:'桂冠'},
];
export const ICON_DEFAULTS = {
  version:1,subject:'coin-stack',style:'royal-gold',width:1024,height:1024,transparent:true,background:'#141021',
  gloss:86,shadow:68,lightDirection:-35,glow:12,yaw:-22,pitch:16,
  layers:[{id:'main',kind:'coin-stack',role:'main',x:0,y:0,scale:1,rotation:-8,hidden:false},{id:'decor-1',kind:'sparkle',role:'decoration',x:.30,y:-.27,scale:.22,rotation:0,hidden:false}],
};
const subjects=new Set(ICON_SUBJECTS.map(x=>x.id)),styles=new Set(ICON_STYLES.map(x=>x.id)),kinds=new Set([...subjects,...ICON_ACCESSORIES.map(x=>x.id)]);
const clamp=(v,a,b,f)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):f));
export function normalizeIconState(input={}) {
  if(!input||typeof input!=='object')input={};
  const result={...ICON_DEFAULTS,...input};
  result.version=1;result.subject=subjects.has(input.subject)?input.subject:ICON_DEFAULTS.subject;result.style=styles.has(input.style)?input.style:ICON_DEFAULTS.style;
  result.width=Math.round(clamp(result.width,128,2048,1024));result.height=Math.round(clamp(result.height,128,2048,1024));
  result.gloss=clamp(result.gloss,0,100,86);result.shadow=clamp(result.shadow,0,100,68);result.glow=clamp(result.glow,0,100,12);
  result.lightDirection=clamp(result.lightDirection,-180,180,-35);result.yaw=clamp(result.yaw,-55,55,-22);result.pitch=clamp(result.pitch,-35,45,16);
  result.transparent=typeof result.transparent==='boolean'?result.transparent:true;result.background=/^#[0-9a-f]{6}$/i.test(result.background)?result.background:'#141021';
  const used=new Set();
  result.layers=(Array.isArray(input.layers)?input.layers:ICON_DEFAULTS.layers).slice(0,12).filter(layer=>layer&&kinds.has(layer.kind)).map((layer,i)=>{
    let id=typeof layer.id==='string'?layer.id.replace(/[^\w-]/g,'').slice(0,60):`layer-${i}`;if(!id||used.has(id))id=`layer-${i}-${used.size}`;used.add(id);
    return {id,kind:layer.kind,role:layer.role==='main'?'main':'decoration',x:clamp(layer.x,-.7,.7,0),y:clamp(layer.y,-.7,.7,0),scale:clamp(layer.scale,.1,1.8,1),rotation:clamp(layer.rotation,-180,180,0),hidden:Boolean(layer.hidden)};
  });
  return result;
}
export function renderIcon(canvas,input={}) {
  const state=normalizeIconState(input),palette=ICON_STYLES.find(x=>x.id===state.style);
  const metadata=renderIconScene(canvas,state,palette);
  return {...metadata,rendererVersion:6,width:state.width,height:state.height,transparent:state.transparent,subject:state.subject,style:state.style};
}
export function renderIconThumbnail(canvas,subjectId,styleId='royal-gold',size=128) {
  const kind=kinds.has(subjectId)?subjectId:'coin-stack';
  return renderIcon(canvas,{subject:subjects.has(kind)?kind:'coin-stack',style:styleId,width:size,height:size,shadow:45,glow:0,
    layers:[{id:'main',kind,role:'main',x:0,y:0,scale:1,rotation:-6,hidden:false}]});
}
