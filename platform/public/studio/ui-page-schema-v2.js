import {UI_COMPONENTS,UI_ICON_NAMES,uiChildren} from './ui-component-library.js';
import {UI_TEXT_STYLES} from './ui-library.js';
import {UI_SOURCE_BLOCKS} from './ui-source-library.js';
const fields={
 stack:['children','direction','surface','gap','padding','align'],grid:['children','columns','gap'],workspace:['header','sidebar','children'],form:['children','gap'],
 text:['text','textStyle','color'],button:['text','variant','action','target','leftIcon','rightIcon'],input:['label','placeholder','inputType','required','value','filterTarget'],
 select:['label','options','value','placeholder','required','filterTarget','filterColumn'],checkbox:['label','checked','disabled'],radio:['label','group','value','checked','disabled'],switch:['label','checked','disabled'],
 tabs:['items','selected'],navigation:['items','selected','orientation','label'],navbar:['items','selected','accountLabel','topLabel','language'],
 table:['title','dataNote','columns','rows','highlightRow','sortable','pageSize'],pagination:['tableKey','pageCount','current'],accordion:['title','children','open'],panel:['title','children','open'],
 alert:['title','text','tone'],progress:['label','value','max'],badge:['text','tone'],dialog:['title','text','children','open','tone'],empty:['title','text'],caption:['text','tone'],image:['alt','asset'],
 'source-block':['family','block','title','subtitle','buttonLabel'],
};
const fail=text=>{throw Error(text);};
const pick=(v,list,fallback)=>v===undefined?fallback:list.includes(v)?v:fail('组件变体无效：'+String(v));
const text=(v,max=240,fallback='')=>v===undefined?fallback:typeof v==='string'&&v.length<=max?v:fail('组件文案格式或长度无效。');
const int=(v,min,max,fallback)=>v===undefined?fallback:Number.isInteger(v)&&v>=min&&v<=max?v:fail('组件数值超出允许范围。');
const bool=v=>v===undefined?false:typeof v==='boolean'?v:fail('组件状态必须为布尔值。');
const key=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v)?v:fail('组件定位键无效。');
export function validateUIPageV2(raw){
 if(!raw||raw.format!=='megwin-ui-v2'||JSON.stringify(raw).length>220000)fail('页面方案格式或大小无效。');
 if(Object.keys(raw).some(k=>!['format','title','summary','mode','width','root','questions','gaps','coverage'].includes(k)))fail('页面方案包含未允许字段。');
 const result={format:raw.format,title:text(raw.title,120),summary:text(raw.summary,800),mode:pick(raw.mode,['dark','light'],'dark'),width:pick(raw.width,[390,768,1440,1600],1440)};
 for(const name of ['questions','gaps']){if(!Array.isArray(raw[name])||raw[name].length>30)fail('缺少需求核对事项。');result[name]=raw[name].map(v=>text(v,600));}
 const nodes=new Map(),used=new Set(),radioGroups=new Set(),references=[];let count=0;
 function array(a,max=40){if(!Array.isArray(a)||a.length>max)fail('组件列表无效或过长。');return a;}
 function visit(raw,depth=0,insideForm=false){if(++count>240||depth>12||!raw||!Object.hasOwn(fields,raw.type))fail('页面包含未接通组件或超出结构限制。');if(raw.type==='form'&&insideForm)fail('表单不能嵌套表单。');
  if(Object.keys(raw).some(k=>!['type','key',...fields[raw.type]].includes(k)))fail('组件 '+raw.type+' 包含未允许字段。');
  const n={type:raw.type,key:raw.key===undefined?'node-'+count:key(raw.key)};if(nodes.has(n.key))fail('组件定位键重复：'+n.key);nodes.set(n.key,n);if(UI_COMPONENTS[n.type])used.add(n.type);
  const children=(a=[])=>array(a).map(c=>visit(c,depth+1,insideForm||raw.type==='form'));
  if(['stack','grid','form','panel','accordion','dialog'].includes(n.type))n.children=children(raw.children);
  if(['stack','grid','form'].includes(n.type))n.gap=pick(raw.gap,['none','xs','sm','md','lg'],'md');
  if(n.type==='stack'){n.direction=pick(raw.direction,['row','column'],'column');n.surface=pick(raw.surface,['transparent','default','surface1','surface2'],'transparent');n.padding=pick(raw.padding,['none','sm','md','lg'],'none');n.align=pick(raw.align,['start','center','stretch'],'stretch');}
  if(n.type==='grid')n.columns=int(raw.columns,1,4,2);
  if(n.type==='workspace'){n.header=children(raw.header);n.sidebar=children(raw.sidebar);n.children=children(raw.children);}
  if(['text','button','badge','caption'].includes(n.type))n.text=text(raw.text,n.type==='text'?2400:160);
  if(n.type==='text'){n.textStyle=pick(raw.textStyle,UI_TEXT_STYLES,'Body/sm');n.color=pick(raw.color,['primary','secondary','muted','brand'],'primary');}
  if(n.type==='button'){n.variant=pick(raw.variant,['filled','secondary','outlined','ghost'],'filled');n.action=pick(raw.action,['none','submit','reset','scroll','open-dialog','close-dialog'],'none');n.target=raw.target===undefined?null:key(raw.target);n.leftIcon=bool(raw.leftIcon);n.rightIcon=bool(raw.rightIcon);if(['scroll','open-dialog'].includes(n.action)&&!n.target)fail('按钮操作缺少目标组件。');if(n.target)references.push({source:n,target:n.target,expected:n.action==='open-dialog'?'dialog':null});}
  if(['input','select'].includes(n.type)){n.label=text(raw.label,160);n.placeholder=text(raw.placeholder,160);n.required=bool(raw.required);n.value=text(raw.value,320);n.filterTarget=raw.filterTarget===undefined?null:key(raw.filterTarget);if(n.filterTarget)references.push({source:n,target:n.filterTarget,expected:'table'});}
  if(n.type==='input')n.inputType=pick(raw.inputType,['text','email','password','number','search','tel','date'],'text');
  if(n.type==='select'){n.options=array(raw.options,60).map(o=>typeof o==='string'?{label:text(o,120),value:text(o,120)}:(o&&Object.keys(o).every(k=>['label','value'].includes(k))?{label:text(o.label,120),value:text(o.value,120)}:fail('选择项无效。')));if(!n.options.length)fail('下拉选择缺少选项。');n.filterColumn=int(raw.filterColumn,0,13,0);if(n.value&&!n.options.some(o=>o.value===n.value))fail('下拉默认值不在选项中。');}
  if(['checkbox','radio','switch'].includes(n.type)){n.label=text(raw.label,320);n.checked=bool(raw.checked);n.disabled=bool(raw.disabled);}
  if(n.type==='radio'){n.group=key(raw.group);n.value=text(raw.value,120,n.key);if(n.checked){if(radioGroups.has(n.group))fail('同一组单选框不能有多个默认选中项。');radioGroups.add(n.group);}}
  if(['tabs','navigation','navbar'].includes(n.type)){n.items=array(raw.items,20).map(i=>{if(!i||Object.keys(i).some(k=>!['label','icon','target','children',...(n.type==='tabs'?['key']:[])].includes(k)))fail('导航或标签项无效。');const item={label:text(i.label,100)};if(n.type==='tabs'){if(i.key!==undefined){item.key=key(i.key);if(nodes.has(item.key))fail('标签页面板定位键重复：'+item.key);if(++count>240)fail('页面包含过多节点。');nodes.set(item.key,{type:'tab-panel',key:item.key});}item.children=children(i.children);}else{item.icon=pick(i.icon,UI_ICON_NAMES,'none');item.target=i.target===undefined?null:key(i.target);if(item.target)references.push({source:n,target:item.target});}return item;});if(!n.items.length)fail('导航或标签页不能为空。');n.selected=int(raw.selected,0,n.items.length-1,0);}
  if(n.type==='navigation'){n.orientation=pick(raw.orientation,['vertical','horizontal'],'vertical');n.label=text(raw.label,100,'页面导航');}
  if(n.type==='navbar'){n.accountLabel=text(raw.accountLabel,80);n.topLabel=text(raw.topLabel,100);n.language=text(raw.language,30);}
  if(n.type==='table'){n.title=text(raw.title,160);n.dataNote=text(raw.dataNote,240);n.columns=array(raw.columns,14).map(c=>text(c,120));if(!n.columns.length)fail('表格缺少列。');n.rows=array(raw.rows,50).map(row=>{if(!Array.isArray(row)||row.length!==n.columns.length)fail('表格行与列数不一致。');return row.map(c=>typeof c==='string'||typeof c==='number'?text(String(c),400):c&&['text','badge','button','checkbox'].includes(c.type)?visit(c,depth+1):fail('表格单元格只允许文字或已接通的基础组件。'));});n.highlightRow=int(raw.highlightRow,-1,n.rows.length-1,-1);n.sortable=bool(raw.sortable);n.pageSize=int(raw.pageSize,1,50,10);}
  if(n.type==='pagination'){n.tableKey=raw.tableKey===undefined?null:key(raw.tableKey);n.pageCount=int(raw.pageCount,1,100,1);n.current=int(raw.current,1,100,1);if(n.tableKey)references.push({source:n,target:n.tableKey,expected:'table'});else if(n.current>n.pageCount)fail('当前页大于总页数。');}
  if(['panel','accordion','dialog'].includes(n.type)){n.title=text(raw.title,180);n.open=bool(raw.open);}
  if(n.type==='dialog'){n.text=text(raw.text,1600);n.tone=pick(raw.tone,['success','warning','error'],'warning');}
  if(n.type==='alert'){n.title=text(raw.title,160);n.text=text(raw.text,1200);n.tone=pick(raw.tone,['info','success','warning','error'],'info');}
  if(n.type==='caption')n.tone=pick(raw.tone,['info','success','error'],'info');
  if(n.type==='badge')n.tone=pick(raw.tone,['pending','success','error','live'],'pending');
  if(n.type==='progress'){n.label=text(raw.label,160);n.max=int(raw.max,1,1000000,100);n.value=int(raw.value,0,n.max,0);}
  if(n.type==='empty'){n.title=text(raw.title,200);n.text=text(raw.text,600);}
  if(n.type==='image'){n.asset=pick(raw.asset,['reference:0'],'reference:0');n.alt=text(raw.alt,240);}
  if(n.type==='source-block'){if(!Object.hasOwn(UI_SOURCE_BLOCKS,raw.family)||!Object.hasOwn(UI_SOURCE_BLOCKS[raw.family],raw.block))fail('引用了未知原稿区块。');n.family=raw.family;n.block=raw.block;const editable=n.block==='page'||n.block===(n.family==='main'?'banners':'hero');for(const [k,max]of Object.entries(n.family==='main'?{title:32,subtitle:80,buttonLabel:20}:{title:80,subtitle:260,buttonLabel:40})){if(raw[k]===undefined)continue;if(!editable)fail('该原稿区块文案尚不可编辑，请用已接通组件重组页面。');n[k]=text(raw[k],max);}}
  return n;
 }
 result.root=result.questions.length&&raw.root===null?null:visit(raw.root);if(result.root&&!['stack','grid','workspace'].includes(result.root.type))fail('根节点须为布局或完整页面框架。');
 for(const r of references){const target=nodes.get(r.target);if(!target||r.expected&&target.type!==r.expected)fail('组件操作指向了不存在或不匹配的目标：'+r.target);if(r.source.type==='pagination'){r.source.pageCount=Math.max(1,Math.ceil(target.rows.length/target.pageSize));if(r.source.current>r.source.pageCount)fail('表格分页超出实际数据。');}if(r.source.type==='select'&&r.source.filterColumn>=target.columns.length)fail('下拉筛选指定了不存在的列。');}
 result.coverage=array(raw.coverage||[],60).map(c=>{if(!c||Object.keys(c).some(k=>!['requirement','targets'].includes(k)))fail('需求对应关系无效。');return{requirement:text(c.requirement,500),targets:array(c.targets,30).map(k=>{if(!nodes.has(k))fail('需求清单指向不存在的组件：'+k);return k;})};});
 result.components=[...used];result.nodeCount=count;return result;
}
export function uiPlanningPromptV2(prompt,{mode='auto',width='auto',hasReference=false,previousPlan=null}={}){
return `你是Megwin产品设计师。只输出一个json代码块，块内为完整合法JSON，使用缩进并配对全部括号。不得输出其他解释。不要生成HTML/JS代码，不调用绘图、视频、搜索或付费工具。${hasReference?'理解上传参考图的布局、文案、控件，':'理解PRD原话，'}用已接通组件生成完整页面，不能贴整张截图代替UI，不能添加未要求的业务区块。
格式：{"format":"megwin-ui-v2","title":"页面名","summary":"理解说明","mode":"dark","width":1440,"root":{},"questions":[],"gaps":[],"coverage":[{"requirement":"要求","targets":["节点key"]}]}。mode仅dark/light；width仅390/768/1440/1600。节点只含type、可选唯一英文key及下列字段；目标必须对应真实key。最多240节点12层。关键缺失才问questions；无法实现写gaps，不冒充已完成。
布局：workspace{header:节点数组,sidebar:节点数组,children:主体数组}；stack{children,direction:row/column,surface:transparent/default/surface1/surface2,gap:none/xs/sm/md/lg,padding:none/sm/md/lg,align:start/center/stretch}；grid{children,columns:1至4,gap}；form{children,gap}。
text{text,textStyle:${UI_TEXT_STYLES.join('|')},color:primary/secondary/muted/brand}。
button[66:7883]{text,variant:filled/secondary/outlined/ghost,action:none/submit/reset/scroll/open-dialog/close-dialog,target:目标key,leftIcon:false,rightIcon:false}。
input[66:4266]{label,placeholder,inputType:text/email/password/number/search/tel/date,required:false,value:默认文字,filterTarget:可选表格key}。
select{label,options:["选项"]或[{label,value}],value:默认value,placeholder,required:false,filterTarget:可选表格key,filterColumn:从0开始列号}。checkbox{label,checked:false,disabled:false}；radio{label,group:同组英文key,value,checked:false,disabled:false}；switch{label,checked:false,disabled:false}。
tabs{selected:0,items:[{label,key:可选面板定位key,children:节点数组}]}；navigation{label,orientation:vertical/horizontal,selected:0,items:[{label,icon:none/home/user/settings/notification/search/support/history/promotion/in-play,target:可选区块key}]}；navbar{items:[{label,icon,target}],selected:0,accountLabel,topLabel,language}，后三字段均可选，品牌沿用原稿。
table{title,dataNote:样例数据或来源说明,columns:["列名"],rows:[["单元格",{"type":"badge","text":"状态","tone":"success"}]],pageSize:10,sortable:true,highlightRow:-1}，行列数一致，至多14列50行，格内可为文字或text/badge/button/checkbox节点。pagination{tableKey:表格key,current:1}，依据实际行数分页。不关联表格时用pageCount。筛选选项value应与表格列文字相符，全部选项value为空串。
panel{title,open:true,children}为可收起内容面板；accordion{title,open:false,children}为FAQ；alert{title,text,tone:info/success/warning/error}；caption{text,tone:info/success/error}；badge{text,tone:pending/success/error/live}；progress{label,value:0,max:100}。
dialog{key,title,text,tone:success/warning/error,open:false,children}用按钮open-dialog+target打开，close-dialog关闭。empty{title,text}保留原稿赛事空状态插画，仅用于相符场景。image{alt,asset:"reference:0"}仅在用户要求图片作实际素材时使用。
source-block{family:main/activity,block:page,title,subtitle,buttonLabel}仅在明确保留完整原稿时选用；其他区块键仅沿用上一版已有值。静态原稿不替代可编辑新页面。
所有控件必须用对应type，禁止用文字模拟。所有被导航、按钮或coverage引用的节点必须显式填写唯一key；target不能是空串，不用的可选字段直接省略。颜色、圆角、字体由本地真实Figma组件与110变量决定，不写任意样式或URL。明确文案写入实际节点，不能只写summary。coverage将主要需求对应节点key；只做前端原型，业务接口不声称已连接。
强制模式=${mode}，宽度=${width}；auto按需求判断。
${previousPlan?'上一版方案（即使v1也转成v2，只按新要求修改其余保留）：'+JSON.stringify(previousPlan):''}
【用户原始需求开始】\n${prompt}\n【用户原始需求结束】`;
}

export function walkUIV2(root){const nodes=[];function visit(n){if(!n)return;nodes.push(n);for(const c of uiChildren(n))visit(c);}visit(root);return nodes;}
export function reviewUIComponents(raw,prompt){
 const used=new Set(walkUIV2(raw.root).map(n=>n.type)),missing=[],requirements={select:/下拉(?:选择|框)?|select\b/i,checkbox:/复选框|checkbox\b/i,radio:/单选框|radio\b/i,switch:/开关|switch\b/i,tabs:/标签页|tabs?\b/i,table:/数据表格|表格|table\b/i,pagination:/分页|pagination\b/i,accordion:/FAQ|常见问题|折叠问答/i,dialog:/弹窗|对话框|dialog\b/i,progress:/进度条|progress\b/i,navbar:/品牌导航|顶部导航栏/i,navigation:/左侧导航|侧边导航|侧栏导航/i};
 const clauses=String(prompt).split(/[。；;\n]/);
 for(const [type,pattern]of Object.entries(requirements)){const requested=clauses.some(clause=>{const match=pattern.exec(clause);if(!match)return false;const before=clause.slice(0,match.index);return !/(?:不要|不需要|不添加|不使用|不含|移除|删除|去掉)[^，,。；;]{0,40}$/.test(before);});if(requested&&!used.has(type))missing.push(UI_COMPONENTS[type].label);}
 return{missing,types:[...used].filter(type=>UI_COMPONENTS[type])};
}
