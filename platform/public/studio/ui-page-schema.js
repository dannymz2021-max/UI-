import {validateUIPageV2,uiPlanningPromptV2} from './ui-page-schema-v2.js';
import {uiChildren} from './ui-component-library.js';
export {UI_COMPONENTS} from './ui-component-library.js';
export const uiPlanningPrompt=uiPlanningPromptV2;
export {UI_TEXT_STYLES};
const allowed={stack:['type','children','direction','surface','gap','padding','align'],grid:['type','children','columns','gap'],text:['type','text','textStyle','color'],button:['type','text','leftIcon','rightIcon','target'],input:['type','label','placeholder','inputType','required'],image:['type','alt','asset'],'source-block':['type','family','block','title','subtitle','buttonLabel']};
const choice=(v,options,fallback,label)=>{if(v===undefined)return fallback;if(!options.includes(v))throw Error('未支持的'+label+'：'+v);return v;};
export function validateUIPage(raw){
 if(raw?.format==='megwin-ui-v2')return validateUIPageV2(raw);
 if(!raw||raw.format!=='megwin-ui-v1')throw Error('未收到有效 UI 方案，请检查豆包中的回复。');
 const keys=['format','title','summary','mode','width','root','questions','gaps'];if(Object.keys(raw).some(k=>!keys.includes(k)))throw Error('UI 方案包含未允许的内容。');
 if(typeof raw.title!=='string'||raw.title.length>120||typeof raw.summary!=='string'||raw.summary.length>600)throw Error('UI 方案标题或说明无效。');
 const mode=choice(raw.mode,['dark','light'],'dark','变量模式'),width=choice(raw.width,[390,768,1440,1600],1440,'页面宽度');
 for(const key of ['questions','gaps'])if(!Array.isArray(raw[key])||raw[key].length>20||raw[key].some(x=>typeof x!=='string'||x.length>500))throw Error('UI 核对事项无效。');
 let count=0;const used=new Set();
 function visit(n,depth=0){if(++count>80||depth>8||!n||!Object.hasOwn(allowed,n.type)||Object.keys(n).some(k=>!allowed[n.type].includes(k)))throw Error('UI 方案使用了未接通组件或超出结构限制。');const result={type:n.type};
  if(['stack','grid'].includes(n.type)){if(!Array.isArray(n.children)||n.children.length>24)throw Error('UI 布局子项无效。');result.children=n.children.map(c=>visit(c,depth+1));result.gap=choice(n.gap,['none','xs','sm','md','lg'],'md','间距');if(n.type==='grid')result.columns=choice(n.columns,[1,2,3,4],2,'列数');else{result.direction=choice(n.direction,['row','column'],'column','方向');result.surface=choice(n.surface,['transparent','default','surface1','surface2'],'transparent','背景变量');result.padding=choice(n.padding,['none','sm','md','lg'],'md','内边距');result.align=choice(n.align,['start','center','stretch'],'stretch','对齐');}}
  if(n.type==='text'||n.type==='button'){if(typeof n.text!=='string'||n.text.length>(n.type==='button'?80:1800))throw Error('UI 文案过长或格式无效。');result.text=n.text;}
  if(n.type==='text'){result.textStyle=choice(n.textStyle,UI_TEXT_STYLES,'Body/sm','文字样式');result.color=choice(n.color,['primary','secondary','muted','brand'],'primary','文字颜色变量');}
  if(n.type==='button'){used.add('button');result.leftIcon=n.leftIcon===true;result.rightIcon=n.rightIcon===true;result.target=n.target===undefined?null:n.target;if(result.target!==null&&(!Number.isInteger(result.target)||result.target<0||result.target>24))throw Error('按钮跳转目标无效。');}
  if(n.type==='input'){used.add('input');for(const k of ['label','placeholder'])if(n[k]!==undefined&&(typeof n[k]!=='string'||n[k].length>160))throw Error('输入框文案无效。');result.label=n.label||'';result.placeholder=n.placeholder||'';result.inputType=choice(n.inputType,['text','email','password','number','search','tel'],'text','输入类型');result.required=n.required===true;}
  if(n.type==='image'){if(n.asset!=='reference:0'||typeof n.alt!=='string'||n.alt.length>240)throw Error('方案引用了未知图片；不会下载模型编造的地址。');result.asset=n.asset;result.alt=n.alt;}
  if(n.type==='source-block'){if(!Object.hasOwn(UI_SOURCE_BLOCKS,n.family)||!Object.hasOwn(UI_SOURCE_BLOCKS[n.family],n.block))throw Error('方案引用了未知原稿区块。');result.family=n.family;result.block=n.block;const editable=n.block==='page'||n.block===(n.family==='main'?'banners':'hero'),limits=n.family==='main'?{title:32,subtitle:80,buttonLabel:20}:{title:80,subtitle:260,buttonLabel:40};for(const [key,max]of Object.entries(limits)){if(n[key]===undefined)continue;if(!editable||typeof n[key]!=='string'||n[key].length>max)throw Error('此原稿区块的文案不可修改或超过原稿长度。');result[key]=n[key];}}
  return result;
 }
 const root=raw.questions.length&&raw.root===null?null:visit(raw.root);if(root&&!['stack','grid'].includes(root.type))throw Error('页面根节点必须为布局容器。');
 return {format:raw.format,title:raw.title,summary:raw.summary,mode,width,root,questions:raw.questions.slice(),gaps:raw.gaps.slice(),components:[...used],nodeCount:count};
}
export function legacyUIPlanningPrompt(prompt,{mode='auto',width='auto',hasReference=false,previousPlan=null}={}){return `你是一名 UI 设计师。只输出一个 JSON 对象，不输出代码，不调用绘图、视频、搜索或付费工具。根据用户的原始需求${hasReference?'和已上传参考图':''}规划页面。使用 Megwin 真实组件和变量，禁止自行编造组件、颜色值、字体或图片 URL。参考图用于理解布局；除非用户明确要求整图作为素材，不要把参考截图贴成页面。
只允许这个结构：{"format":"megwin-ui-v1","title":"页面标题","summary":"说明如何理解用户需求","mode":"dark或light","width":${[390,768,1440,1600].includes(width)?width:1440},"root":{"type":"stack","children":[]},"questions":[],"gaps":[]}。
可用布局：stack {children,direction:row或column,surface:transparent或default或surface1或surface2,gap:none或xs或sm或md或lg,padding:none或sm或md或lg,align:start或center或stretch}；grid {children,columns:1到4,gap}。这是排版容器，不是假装新的 Figma 组件。
可用内容：text {text,textStyle:${UI_TEXT_STYLES.join('或')},color:primary或secondary或muted或brand}；button {text,leftIcon:false,rightIcon:false,target:可选的顶层区块序号} 对应 Common buttons 66:7883；input {label,placeholder,inputType:text或email或password或number或search或tel,required:false} 对应 Input-web 66:4266。image {alt,asset:"reference:0"} 只能在用户明确要求把上传素材放进页面时使用。
可复用真实原稿：source-block {family:main或activity,block:下列键,title:可选的实际首屏标题,subtitle:可选的实际首屏副标题,buttonLabel:可选的实际首屏按钮文案}。main：${Object.entries(UI_SOURCE_BLOCKS.main).map(([k,v])=>k+'（'+v.name+'）').join('、')}。activity：${Object.entries(UI_SOURCE_BLOCKS.activity).map(([k,v])=>k+'（'+v.name+'）').join('、')}。这些是桌面原稿区块，保持原图素材和组件位置、等比缩放；不是自适应手机组件。只在需求符合时选用，不能用于替代无关的新页面。只允许 main/banners、activity/hero 或完整page改 title/subtitle/buttonLabel；main字数上限32/80/20，activity为80/260/40，其余文案原样保留。若用户要求修改首屏文案，必须把文字写进对应source-block节点的title/subtitle/buttonLabel字段，仅改顶层title或summary不会修改画面。例如 {"type":"source-block","family":"activity","block":"hero","title":"VERANO 2026","subtitle":"Descubre tus recompensas.","buttonLabel":"Comenzar"}。用户要求修改其他区块的文案或交互请列入gaps，不要静默忽略。卡片、列表、指标、步骤、导航和表格可用上述布局与内容组合；不要假称这些组合是未读取的 Figma 组件。需要无法表达的控件、交互或其他设计库组件时，在 gaps 中明确列出；关键条件缺失才放入 questions，root 可为 null。最多80个节点、8层嵌套；不要把 PRD 的功能说明直接填进界面文案。表单使用真实输入控件，禁止以文字假装输入框。不在用户需求之外添加区块。模式要求：${mode}。页面宽度要求：${width}；auto 时按需求判断，手机优先390、平板768、桌面1440。只允许390、768、1440、1600。
${previousPlan?'以下是上一版方案，仅按新要求修改，其他内容保留：'+JSON.stringify(previousPlan):''}
【原始需求开始】\n${prompt}\n【原始需求结束】`;}
export function extractUIJSON(text){
 const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];let completeError=null;
 const parse=value=>{const raw=JSON.parse(value);validateUIPage(raw);return raw;};
 if(fenced){try{return parse(fenced);}catch(e){throw Object.assign(Error('页面方案校验失败：'+e.message),{code:'UI_PLAN_INVALID'});}}
 for(let start=text.indexOf('{');start>=0;start=text.indexOf('{',start+1)){let depth=0,quoted=false,escape=false;for(let i=start;i<text.length;i++){const c=text[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return parse(text.slice(start,i+1));}catch(e){if(start===text.indexOf('{'))completeError=e;break;}}}}
 if(completeError)throw Object.assign(Error('页面方案校验失败：'+completeError.message),{code:'UI_PLAN_INVALID'});
 throw Error('豆包回复还没有形成可验证的完整 UI 方案。');
}
import {UI_TEXT_STYLES} from './ui-library.js';
import {UI_SOURCE_BLOCKS} from './ui-source-library.js';
export function assertUISelection(raw,{mode='auto',width='auto'}={}){const plan=validateUIPage(raw);if(mode!=='auto'&&plan.mode!==mode)throw Error('方案没有遵守所选变量模式，未替换当前页面。');if(width!=='auto'&&plan.width!==Number(width))throw Error('方案没有遵守所选页面宽度，未替换当前页面。');return plan;}
// Verify explicit copy instructions against rendered node fields, never against
// the model's summary (which can claim edits that are absent from its plan).
export function reviewUICopy(raw,prompt){const texts=[],placeholders=[];function visit(n){if(!n)return;for(const key of ['text','label','placeholder','title','subtitle','buttonLabel','dataNote'])if(typeof n[key]==='string')texts.push(n[key]);for(const item of [...(n.items||[]),...(n.options||[])])if(item?.label)texts.push(item.label);if(n.type==='input'){if(typeof n.value==='string')texts.push(n.value);if(typeof n.placeholder==='string')placeholders.push(n.placeholder);}for(const c of uiChildren(n))visit(c);}visit(raw.root);const requested=[];const pattern=/(?:副标题|标题|按钮(?:文案)?)\s*(?:改成|改为|为|是|：|:)\s*(?:[“"「]([^”"」]+)[”"」]|([^，,。；;\n]+))/g;for(const m of String(prompt).matchAll(pattern)){const value=(m[1]||m[2]).trim();if(value.length&&value.length<=260)requested.push(value);}for(const clause of String(prompt).split(/[。；;\n]/)){if(!/显示|文案|金额|占位|默认|保留|标签|右侧|左侧/.test(clause))continue;for(const m of clause.matchAll(/(?:R\$|\$|¥|￥|€|£)\s?\d+(?:[.,]\d+)*/g)){if(/改成|改为|替换为/.test(clause.slice(m.index+m[0].length)))continue;requested.push(m[0]);}}const explicitPlaceholders=[...String(prompt).matchAll(/占位(?:符|文字)?\s*(?:(?:准确)?显示|改为|改成|为|是|[：:])?\s*(?:[“"「]([^”"」]+)[”"」]|((?:R\$|\$|¥|￥|€|£)\s?\d+(?:[.,]\d+)*))/g)].map(m=>m[1]||m[2]);const renderedMoney=new Set(texts.flatMap(t=>[...t.matchAll(/(?:R\$|\$|¥|￥|€|£)\s?\d+(?:[.,]\d+)*/g)].map(m=>m[0]))),unique=[...new Set(requested)];return{explicitCopy:unique,explicitPlaceholders,missing:[...unique.filter(value=>!texts.includes(value)&&!renderedMoney.has(value)),...explicitPlaceholders.filter(value=>!placeholders.includes(value)).map(value=>'占位文案：'+value)]};}
