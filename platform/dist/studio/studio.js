import { mountIconStudio } from './icon-studio.js';
import { ICON_SUBJECTS, ICON_STYLES, ICON_DEFAULTS, normalizeIconState } from './icon-renderer.js';
import { ICON_LOOKS, iconLookState } from './icon-library-data.js';
import { mountUIStudio } from './ui-studio.js';
import { mountDesignSystem } from './design-system.js';
import { mountStudioHome } from './studio-home.js';

const uuid = () => { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16)); bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 home:'m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8',
 type:'M4 5h16M12 5v15M8 20h8M4 5v4M20 5v4',
 sparkles:'m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3ZM20 3v4m-2-2h4',
 layers:'m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 5 9-5M3 18l9 5 9-5',
 layout:'M3 4h18v16H3V4Zm0 5h18M9 9v11',
 components:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm14 0 4 4-4 4-4-4 4-4Z',
 inspiration:'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 .8-1 2-1 2H9s0-1.2-1-2Z',
 folder:'M3 6h7l2 2h9v12H3V6Z',
 info:'M12 8h.01M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
 menu:'M4 6h16M4 12h16M4 18h16',
 image:'M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M8 7h.01',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
 arrow:'M5 12h14m-5-5 5 5-5 5',
 link:'m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 2-2a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0',
 trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
 check:'m5 12 4 4L19 6',
 refresh:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3'
};
paths.palette=paths.components; paths.compass=paths.inspiration; paths.help=paths.info;
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.image}"/></svg>`;
function icons(root = document) { $$('[data-icon]', root).forEach(e => e.innerHTML = icon(e.dataset.icon)); }
let toastTimer;
function toast(message, action) {
 const e = $('#toast'); e.hidden=false; e.replaceChildren(); const label=document.createElement('span');label.textContent=String(message);e.append(label);
 if(action?.run){const button=document.createElement('button');button.textContent=action.label||'撤销';button.onclick=async()=>{button.disabled=true;try{await action.run();}catch(error){toast(error.message||'操作未完成，请重试。');}};e.append(button);}
 e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{e.classList.remove('show');e.hidden=true;},action?12000:4800);
}
const names = {start:'工作室首页',icons:'Icon 生成工作台',image:'AI 图像生成',splitter:'图片图层拆解',ui:'UI 页面生成',system:'组件与变量',references:'灵感素材库',assets:'我的作品'};
const mounted = new Map();
let active = 'start', service = {generationReady:false,editReady:false,uiReady:false,loaded:false};
let splitterReady = false, pendingSplit = null;
let imageReference = null, generatedImage = null, imageBusy = false;
let assetURLs = [], referenceURLs = [], noticeURL = null;
const referenceURL = '/studio/icon-samples/contact-sheet.png';
const casinoReferenceURL = 'https://huaban.com/search?q=casino+icon&search_word_type=%E6%89%8B%E5%8A%A8%E8%BE%93%E5%85%A5%E6%90%9C%E7%B4%A2%E8%AF%8D&top=&original=';
const figmaSources = {
 main:{name:'Megwin · 主站与变量',url:'https://www.figma.com/design/ZFDvXEgggNZ49dZU7hmSLP/Megwin?node-id=3607-898490'},
 activity:{name:'Megwin · 活动界面',url:'https://www.figma.com/design/2EBmHXzEU62LfXXaE1CEza/Megwin?node-id=1113-422724'}
};
function heading(kicker, title, text, tag='') { return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${text}</p></div>${tag ? `<span class="heading-tag">${tag}</span>`:''}</div>`; }
function readLocal(key, fallback) { try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function saveLocal(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* A disabled local store does not block editing. */ } }

let database;
function db() {
 if (!database) database = new Promise((resolve,reject) => {
  const req=indexedDB.open('layerlab-studio-v2',1);
  req.onupgradeneeded=() => { const d=req.result; d.createObjectStore('assets',{keyPath:'id'}); d.createObjectStore('references',{keyPath:'id'}); };
  req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(new Error('浏览器作品库不可用，请直接下载作品。'));
 });
 return database;
}
async function readAll(store) { const d=await db(); return new Promise((resolve,reject)=>{const r=d.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.createdAt-a.createdAt));r.onerror=()=>reject(r.error);}); }
async function put(store,value) { const d=await db(); return new Promise((resolve,reject)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(new Error('浏览器存储空间不足，请下载作品后清理。'));}); }
async function remove(store,id) { const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); }
async function updateCount() { try { $('#asset-count').textContent=(await readAll('assets')).length; } catch { $('#asset-count').textContent='—'; } }
async function saveAsset(asset) {
 if (!(asset?.blob instanceof Blob)||!asset.blob.size) throw new Error('作品为空，无法保存。');
 if (asset.blob.size>40*1024*1024) throw new Error('单个作品超过 40 MB，请直接下载。');
 const all=await readAll('assets');if(all.length>=100) throw new Error('作品库已达到 100 个，请下载并删除部分作品后继续。');
 await put('assets',{id:uuid(),blob:asset.blob,name:String(asset.name||'UI工作室.png').slice(0,180),type:asset.type||'image',width:asset.width,height:asset.height,createdAt:Date.now()});
 await updateCount();if(active==='assets') await renderAssets();
}
function download(blob,name) {
 if(noticeURL) URL.revokeObjectURL(noticeURL); noticeURL=URL.createObjectURL(blob);
 const bar=$('#download-notice');bar.replaceChildren();
 const label=document.createElement('span');label.textContent='文件已准备好';const a=document.createElement('a');a.href=noticeURL;a.download=name;a.textContent='点击下载 '+name;const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','关闭下载提示');close.onclick=()=>bar.hidden=true;
 bar.append(label,a,close);bar.hidden=false;a.click();
}
async function blobDataURL(blob) { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('无法读取图片。'));r.readAsDataURL(blob);}); }
async function safeReference(file) {
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片。');
 if(file.size>20*1024*1024) throw new Error('参考图请小于 20 MB。');
 const img=await createImageBitmap(file);if(img.width*img.height>70000000){img.close();throw new Error('参考图分辨率过大，请先缩小。');}
 const scale=Math.min(1,1536/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);img.close();
 const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob||blob.size>6*1024*1024)throw new Error('压缩后的参考图仍超过 6 MB，请使用较小图片。');
 return {blob,dataUrl:await blobDataURL(blob),name:file.name||'参考图片',width:c.width,height:c.height};
}
async function sendToSplitter({blob,name}) {
 if(!(blob instanceof Blob))throw new Error('没有可拆解的图片。');
 pendingSplit={type:'layerlab:import',dataUrl:await blobDataURL(blob),name:name||'创意作品.png'};await show('splitter');
 if(splitterReady){$('#splitter-frame').contentWindow.postMessage(pendingSplit,location.origin);pendingSplit=null;}
 toast('作品已发送到拆层工作台，可选择拆解模式继续。');
}
window.addEventListener('message',e=>{const frame=$('#splitter-frame');if(e.origin!==location.origin||e.source!==frame.contentWindow)return;if(e.data?.type==='layerlab:ready'){splitterReady=true;if(pendingSplit){frame.contentWindow.postMessage(pendingSplit,location.origin);pendingSplit=null;}}});

async function getStatus() {
 try {const r=await fetch('/api/studio/status',{cache:'no-store',credentials:'same-origin'});const value=await r.json();if(!r.ok||!value.ok)throw new Error();service={...value,loaded:true};}
 catch {service={generationReady:false,editReady:false,uiReady:false,loaded:true,statusUnavailable:true};}
 const badge=$('.nav-item[data-view="image"] small');if(badge){badge.textContent=service.generationReady?'AI':'待接入';badge.title=service.generationReady?'生成服务已就绪':'模型服务尚未配置';}
 if(mounted.has('image')) updateImageStatus(); mounted.get('ui')?.refresh?.();return service;
}
async function api(path,body) {
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),190000);
 try {const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body),signal:controller.signal});let v;try{v=await r.json();}catch{throw new Error('服务没有返回完整结果，请检查网络后再试。');}if(!r.ok||v.ok===false)throw new Error(v.error?.message||v.message||'请求未完成，请稍后重试。');return v;}
 catch(e){if(e.name==='AbortError')throw new Error('本次生成等待超时。请求可能仍在处理，请先查看作品结果，不要连续重复提交。');throw e;}finally{clearTimeout(timeout);}
}
async function requestUI(brief) {
 const values=brief.designSystem?.values||{};
 const r=await api('/api/studio/ui-plan',{requestId:uuid(),prompt:`${brief.prompt}\n语言：${brief.language}；设备：${brief.device}；现有页面内容：${JSON.stringify(brief.currentConfig||{}).slice(0,4500)}`,pageType:brief.template,...(brief.referenceDataUrl?{referenceDataUrl:brief.referenceDataUrl}:{}),tokens:{primaryColor:values.primary,backgroundColor:values.background,textColor:values.text,fontFamily:values.fontFamily}});
 const p=r.plan;const cards=p.sections.flatMap(s=>s.items).slice(0,6).map(item=>({title:item.title,subtitle:item.description,tag:''}));
 return {config:{title:p.title,subtitle:p.subtitle,buttonLabel:p.cta,cta:p.cta,cards},message:'AI 已优化内容；预览与导出继续使用当前组件和变量。'};
}
function chooseFigmaSource() {
 const dialog=$('#studio-dialog'),content=$('#dialog-content');content.innerHTML=`<h2>同步 Figma 设计变量</h2><p>选择这次要读取的设计文件。成功后，变量会绑定到 UI 页面；手动覆盖的值仍可在组件与变量中调整。</p><div class="button-group"><button class="btn primary" data-source="activity">活动界面 · 已定位画板</button><button class="btn" data-source="main">主站与变量</button></div><p class="fine-print">主站来源：体育首页 Homepage（3607:898490）；活动来源：新客奖励 Homepage（10002:56600）。此操作通过当前访问者的 Figma 连接读取最新变量，源文件需要相应访问权限。</p>`;
 dialog.showModal();return new Promise(resolve=>{const close=()=>{cleanup();resolve(null);};const cleanup=()=>dialog.removeEventListener('close',close);dialog.addEventListener('close',close,{once:true});$$('[data-source]',content).forEach(b=>b.onclick=()=>{cleanup();dialog.close();resolve(b.dataset.source);});});
}
async function syncFigma() {
 throw new Error('在线同步服务尚未接入。可继续使用已保存的 Figma 快照，或导入变量 JSON。');
 /* The original service requires a separate authorization backend.
 const source=await chooseFigmaSource();if(!source)throw new Error('已取消同步，当前变量保持可用。');
 const result=await api('/api/studio/figma',{source});
 if(result.status!=='success'){
  if(result.status==='reauthentication_required'&&typeof result.reconnectHref==='string'&&result.reconnectHref.startsWith('/')){
   const d=$('#studio-dialog');$('#dialog-content').innerHTML='<h2>连接 Figma</h2><p>当前访问者需要完成站点授权，才能读取设计变量。</p>';const a=document.createElement('a');a.className='btn primary';a.href=result.reconnectHref;a.target='_top';a.textContent='连接 Figma';$('#dialog-content').append(a);d.showModal();
  }
  throw new Error(result.message||'本次没有读取到 Figma 变量。请在 Figma 中选择具体页面或组件后重试，或导入变量 JSON。');
 }
 return {rawTokens:result.rawTokens,verifiedFigma:true,source:{...figmaSources[source],kind:'figma',syncedAt:result.syncedAt}};
 */
}

function initialIconState() { return normalizeIconState(readLocal('ui-studio-icon-draft-v1', {})); }
function applyRequestedIcon() {
 const params=new URLSearchParams(location.search),sample=ICON_LOOKS.find(item=>item.id===params.get('sample'));
 const subject=ICON_SUBJECTS.find(item=>item.id===params.get('subject')),style=ICON_STYLES.find(item=>item.id===params.get('style'));
 if(!sample&&!subject)return;
 const next=sample?iconLookState(sample):normalizeIconState({...ICON_DEFAULTS,subject:subject.id,style:style?.id||ICON_DEFAULTS.style,layers:[{id:'main',kind:subject.id,role:'main',x:0,y:0,scale:1,rotation:-8,hidden:false}]});
 mounted.get('icons')?.applySettings?.(next,'应用图标样例');
 for(const key of ['sample','subject','style'])params.delete(key);
 history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+'#icons');
}
async function show(view) {
 if(view==='art'||view==='icon')view='icons';
 if(!names[view])view='start';const changing=active!==view;active=view;
 $$('.studio-view').forEach(e=>e.hidden=e.id!=='view-'+view);$$('.nav-item[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(changing)window.scrollTo(0,0);$('#view-name').textContent=names[view];document.title=names[view]+' · UI工作室';document.body.classList.remove('nav-open');
 if(location.hash!=='#'+view)history.replaceState(null,'','#'+view);
 try {
  if(!mounted.has(view)) {
   const container=$('#view-'+view);
   if(view==='start')mounted.set(view,mountStudioHome(container,{onOpen:async(next,mode)=>{await show(next);if(mode)mounted.get('ui')?.selectWorkspace?.(mode);},getDraft:()=>mounted.get('icons')?.getSettings?.()||readLocal('ui-studio-icon-draft-v1',null),getAssetCount:async()=>(await readAll('assets')).length}));
   else if(view==='icons')mounted.set(view,mountIconStudio(container,{toast,onAsset:saveAsset,onSendToSplitter:sendToSplitter,initialState:initialIconState()}));
   else if(view==='ui')mounted.set(view,mountUIStudio(container,{toast,onAsset:saveAsset,onSendToSplitter:sendToSplitter,requestAI:requestUI,getServiceStatus:()=>service}));
   else if(view==='system')mounted.set(view,mountDesignSystem(container,{toast,onTokensChanged:()=>mounted.get('ui')?.refresh?.(),onSyncFigma:syncFigma}));
   else if(view==='splitter'){mounted.set(view,true);$('#splitter-frame').src='/splitter/index.html?embedded=1';}
   else if(view==='image'){mounted.set(view,true);renderImage();}
   else mounted.set(view,true);
  }
  if(view==='assets')await renderAssets();if(view==='references')await renderReferences();if(view==='icons')applyRequestedIcon();if(view==='ui'||view==='start')mounted.get(view)?.refresh?.();
 } catch(e){toast(e.message||'工作区暂时无法打开。');}
}
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
$$('.sidebar-nav [data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#splitter-export-project').onclick=()=>{if(splitterReady)$('#splitter-frame').contentWindow.postMessage({type:'layerlab:export'},location.origin);else toast('拆层工作台正在准备，请稍候。');};
$('#menu-toggle').onclick=()=>{const expanded=document.body.classList.toggle('nav-open');$('#menu-toggle').setAttribute('aria-expanded',String(expanded));};
$('#about-button').onclick=()=>{const d=$('#studio-dialog');$('#dialog-content').innerHTML='<p class="eyebrow">UI工作室 / HOW IT WORKS</p><h2>从灵感，到可以带走的设计</h2><h3>Icon 与图像</h3><p>Icon 工作台使用可编辑的本地 3D 模型，选择 Casino、奖励或体育主体，再调整金属、亮漆、宝石配色与灯光。按「选择主体 → 材质灯光 → 装饰构图 → 导出」完成创作，支持撤销、重做、图层删除和透明 PNG。图片拆层使用颜色与连通区域算法，手动选区可处理复杂图片。普通照片无法还原被遮挡的原始图层。</p><h3>AI 与 Figma</h3><p>点击 AI 生成时，提示词和所选参考图会发送给配置的模型服务。模型密钥保存在服务端。Figma 同步使用访问者自己的连接，只在读取成功后更新变量；主站首页与活动页面使用各自已读取的原稿节点；自由模板提供独立的通用布局。</p><h3>保存与素材来源</h3><p>作品、参考图和已导入变量保存在当前浏览器，清除站点数据后会丢失，请及时下载。花瓣链接用于浏览和收藏灵感，不代表已经抓取网站内容或训练模型。Icon 对照图保存在当前浏览器，不会被自动识别或训练；AI 图像区的参考只有主动提交生成时才随请求发送。</p>';d.showModal();};

const imagePresets=[
 {name:'活动主视觉',prompt:'为 MEGWIN 创作高级游戏活动主视觉。简洁深紫色舞台，有清晰窄倒角的3D金币、筹码与晶体模型，黄金反射与饱和珐琅材质，方向性摄影棚主光、深侧面和精致投影，画面右侧为主体，左侧大面积干净留白。风格化3D建模，有明显厚度与体积，图形化商业渲染，反射层次清晰，不做照片写实。无文字，无水印。'},
 {name:'霓虹背景',prompt:'制作游戏活动网页横幅背景。午夜深紫与电光蓝的配色，有厚度的圆角3D几何环与立体星形装饰，有方向的主光、冷暖轮廓光、精致亮漆与金属反射，主体集中在右侧，左侧留白。风格化3D建模，非写实，无文字。'},
 {name:'Casino Icon',prompt:'设计一枚用于 Casino 奖励入口的商业 3D 图标：紫金宝箱半开，少量黄金金币露出，主体约占方形画布70%。深紫亮漆箱体、精密黄金包边、宽明暗金属反射带、窄亮倒角；左上主光、右侧少量轮廓光，深色内腔与精致接触阴影。非写实，非黏土白模，不使用幼儿玩具比例。透明背景，无文字、无水印、无外框。'}
];
function renderImage() {
 const c=$('#view-image'),saved=readLocal('layerlab-image-brief-v2',{});
 c.innerHTML=heading('AI IMAGE STUDIO','把想象，变成下一张作品','描述画面或添加参考图，生成后可保存、下载，也可以继续拆层。','PROMPT → IMAGE')+`
 <div class="image-layout"><section class="studio-card image-controls"><div id="image-service" class="service-note">正在检查生成服务…</div>
 <div class="form-group"><label for="image-prompt">画面描述 <span>越具体，越接近你的想法</span></label><textarea id="image-prompt" class="field" maxlength="12000" rows="7" placeholder="例如：深紫色舞台上的金色奖杯，霓虹灯光，右侧主体，左侧预留活动标题空间…"></textarea><div class="preset-grid">${imagePresets.map((p,i)=>`<button class="preset-item" data-preset="${i}">${p.name} ↗</button>`).join('')}</div></div>
 <div class="form-group"><label>参考图片 <span>可选 · PNG / JPG / WebP</span></label><label class="reference-drop" id="image-ref-label" for="image-reference-file">${icon('upload')}点击上传一张参考图<br><span class="fine-print">参考图将随生成请求发送给模型</span></label><input type="file" id="image-reference-file" accept="image/png,image/jpeg,image/webp" hidden><button class="btn subtle" id="remove-image-ref" hidden>移除参考图</button></div>
 <div class="form-row"><div class="form-group"><label for="image-size">画布尺寸</label><select id="image-size" class="field"><option value="1536x1024">横版 · 1536 × 1024</option><option value="1024x1024">方形 · 1024 × 1024</option><option value="1024x1536">竖版 · 1024 × 1536</option></select></div><div class="form-group"><label for="image-quality">生成质量</label><select id="image-quality" class="field"><option value="medium">标准</option><option value="high">精细</option><option value="low">快速</option></select></div></div>
 <div class="form-group"><label class="check-row"><input type="checkbox" id="image-transparent">透明背景 PNG</label></div><button class="btn primary wide" id="generate-image">${icon('sparkles')}生成图片</button><div class="button-group" style="margin-top:10px"><button class="btn" id="copy-image-prompt">复制提示词</button><button class="btn" id="export-image-brief">导出生成任务</button></div><p class="fine-print">一次生成一张图片。未接入模型时，可以复制提示词到常用的生图工具；参考图需要在对应工具中另行上传。</p></section>
 <section class="studio-card image-preview-panel"><div class="card-head"><h2>作品预览</h2><span id="image-result-tag">等待你的创意</span></div><div class="image-preview" id="image-result"><div class="empty-visual"><div class="empty-orbit">${icon('sparkles')}</div><p class="eyebrow">A SPACE FOR YOUR NEXT IDEA</p><h2>让下一次灵感，在这里发生</h2><p>选择一个灵感起点，或者描述你想要的画面。<br>你的生成结果会出现在这里。</p></div></div><div class="image-actions"><span id="image-result-info">PNG · 支持透明背景</span><div class="button-group"><button class="btn" id="image-to-splitter" disabled>${icon('layers')}继续拆层</button><button class="btn" id="image-save" disabled>${icon('folder')}加入作品</button><button class="btn primary" id="image-download" disabled>${icon('download')}下载</button></div></div></section></div>`;
 $('#image-prompt').value=saved.prompt||'';if(['1536x1024','1024x1024','1024x1536'].includes(saved.size))$('#image-size').value=saved.size;if(['low','medium','high'].includes(saved.quality))$('#image-quality').value=saved.quality;$('#image-transparent').checked=Boolean(saved.transparent);
 const persist=()=>saveLocal('layerlab-image-brief-v2',{prompt:$('#image-prompt').value,size:$('#image-size').value,quality:$('#image-quality').value,transparent:$('#image-transparent').checked});
 ['image-prompt','image-size','image-quality','image-transparent'].forEach(id=>$('#'+id).addEventListener('input',persist));
 $$('[data-preset]',c).forEach(b=>b.onclick=()=>{$('#image-prompt').value=imagePresets[Number(b.dataset.preset)].prompt;if(b.dataset.preset==='2')$('#image-transparent').checked=true;persist();$('#image-prompt').focus();});
 $('#image-reference-file').onchange=async e=>{try{if(e.target.files[0]){imageReference=await safeReference(e.target.files[0]);updateImageReference();}}catch(e){toast(e.message);}finally{e.target.value='';}};
 $('#remove-image-ref').onclick=()=>{imageReference=null;updateImageReference();};$('#generate-image').onclick=generateImage;
 $('#copy-image-prompt').onclick=async()=>{const prompt=$('#image-prompt').value.trim();if(!prompt){toast('先写一段画面描述。');return;}try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(prompt);else{$('#image-prompt').focus();$('#image-prompt').select();if(!document.execCommand('copy'))throw new Error();}toast('提示词已复制，参考图需在目标工具中另行上传。');}catch{toast('请选中提示词后使用 Ctrl / ⌘ C 复制。');$('#image-prompt').focus();$('#image-prompt').select();}};
 $('#export-image-brief').onclick=()=>{const prompt=$('#image-prompt').value.trim();if(!prompt){toast('先写一段画面描述。');return;}const [width,height]=$('#image-size').value.split('x').map(Number);download(new Blob([JSON.stringify({version:1,prompt,width,height,quality:$('#image-quality').value,transparent:$('#image-transparent').checked,referenceImage:imageReference?.dataUrl||null,referenceName:imageReference?.name||null},null,2)],{type:'application/json'}),'UI工作室-generation-brief.json');};
 $('#image-download').onclick=()=>generatedImage&&download(generatedImage.blob,generatedImage.name);
 $('#image-save').onclick=async()=>{try{await saveAsset(generatedImage);toast('图片已加入我的作品。');}catch(e){toast(e.message);}};
 $('#image-to-splitter').onclick=()=>generatedImage&&sendToSplitter(generatedImage).catch(e=>toast(e.message));
 updateImageStatus();updateImageReference();
}
function updateImageReference() {if(!mounted.has('image'))return;const e=$('#image-ref-label');e.innerHTML=imageReference?`<img src="${imageReference.dataUrl}" alt="生成参考图"><span>${escapeHTML(imageReference.name)}</span>`:`${icon('upload')}点击上传一张参考图<br><span class="fine-print">参考图将随生成请求发送给模型</span>`;$('#remove-image-ref').hidden=!imageReference;updateImageStatus();}
function updateImageStatus() {
 const e=$('#image-service');if(!e)return;
 const ready=imageReference?service.editReady:service.generationReady;e.classList.toggle('ready',Boolean(ready));
 e.textContent=!service.loaded?'正在检查生成服务…':ready?'生成服务已就绪。提交后会发送提示词和所选参考图。':service.statusUnavailable?'暂时无法读取服务状态。提示词会保留，请稍后再试。':'AI 服务尚未配置。提示词与参数会保留；Icon 生成、图片拆层及 UI 模板导出可直接使用。';
 $('#generate-image').disabled=imageBusy;$('#generate-image').innerHTML=icon('sparkles')+(imageBusy?'正在生成，请稍候…':ready?'生成图片':'检查服务并生成');
}
async function generateImage() {
 if(imageBusy)return;const prompt=$('#image-prompt').value.trim();if(!prompt){toast('先写一段画面描述，或选择一个灵感起点。');$('#image-prompt').focus();return;}
 await getStatus();if(!(imageReference?service.editReady:service.generationReady)){toast('AI 服务尚未配置模型密钥，当前无法执行生成。你的提示词已保留。');return;}
 imageBusy=true;updateImageStatus();const result=$('#image-result'),old=result.innerHTML;result.innerHTML='<div class="loading-label"><div class="spinner"></div>正在把想法变成画面…<br><span class="fine-print">通常需要 1–3 分钟，请勿重复提交。</span></div>';
 $('#image-result-tag').textContent='生成中';['image-to-splitter','image-save','image-download'].forEach(id=>$('#'+id).disabled=true);
 try{
  const [width,height]=$('#image-size').value.split('x').map(Number);const r=await api('/api/studio/generate',{requestId:uuid(),prompt,width,height,quality:$('#image-quality').value,transparent:$('#image-transparent').checked,kind:'image',...(imageReference?{referenceDataUrl:imageReference.dataUrl}:{})});
  const binary=atob(r.image.b64_json),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const blob=new Blob([bytes],{type:'image/png'});if(generatedImage?.url)URL.revokeObjectURL(generatedImage.url);generatedImage={blob,name:`UI工作室-AI-${Date.now()}.png`,width:r.image.width,height:r.image.height,type:'image',url:URL.createObjectURL(blob)};
  const img=new Image();img.alt=prompt.slice(0,160);img.src=generatedImage.url;result.replaceChildren(img);$('#image-result-tag').textContent='生成完成';$('#image-result-info').textContent=`${r.image.width} × ${r.image.height} · PNG`;
 }catch(e){result.innerHTML=old;$('#image-result-tag').textContent='本次生成未完成';toast(e.message);}finally{imageBusy=false;updateImageStatus();['image-to-splitter','image-save','image-download'].forEach(id=>$('#'+id).disabled=!generatedImage);}
}

async function renderAssets(filter='all') {
 const c=$('#view-assets');assetURLs.forEach(u=>URL.revokeObjectURL(u));assetURLs=[];
 c.innerHTML=heading('YOUR CREATIVE LIBRARY','每一次创作，都有下一种可能','作品保存在这个浏览器里。下载后，可以在其他设计工具中继续编辑。','LOCAL WORKSPACE')+`<div class="assets-toolbar"><div class="chips"><button class="chip ${filter==='all'?'selected':''}" data-filter="all">全部作品</button><button class="chip ${filter==='icon'?'selected':''}" data-filter="icon">3D Icon</button><button class="chip ${filter==='art'?'selected':''}" data-filter="art">历史作品</button><button class="chip ${filter==='image'?'selected':''}" data-filter="image">AI 图像</button><button class="chip ${filter==='ui-page'?'selected':''}" data-filter="ui-page">UI 页面</button></div><span class="section-counter" id="asset-total"></span></div><div id="assets-content"></div>`;
 $$('[data-filter]',c).forEach(b=>b.onclick=()=>renderAssets(b.dataset.filter));
 let all;try{all=await readAll('assets');}catch(e){$('#assets-content').innerHTML=`<div class="studio-card error-panel">${escapeHTML(e.message)}</div>`;return;}
 $('#asset-total').textContent=`${all.length} 个作品`;const list=all.filter(a=>filter==='all'||a.type===filter);
 if(!list.length){$('#assets-content').innerHTML=`<div class="studio-card empty-assets">${icon('folder')}<h2>${all.length?'这个分类里还没有作品':'把第一份灵感，留在这里'}</h2><p>在 Icon、图像生成或 UI 工作区点击「加入作品」。<br>你也可以下载文件，保存到自己的项目中。</p><button class="btn primary" id="asset-create">${icon('components')}制作 Icon</button></div>`;$('#asset-create').onclick=()=>show('icons');return;}
 const grid=document.createElement('div');grid.className='asset-grid';
 for(const a of list){const url=URL.createObjectURL(a.blob);assetURLs.push(url);const card=document.createElement('article');card.className='studio-card asset-card';card.innerHTML=`<img class="asset-image" src="${url}" alt="${escapeHTML(a.name)}"><div class="asset-info"><h3>${escapeHTML(a.name)}</h3><p>${a.width&&a.height?`${a.width} × ${a.height} · `:''}${new Date(a.createdAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Tokyo'})} · ${(a.blob.size/1024).toFixed(0)} KB</p><div class="button-group"><button class="btn" data-act="download">${icon('download')}下载</button><button class="btn" data-act="split">${icon('layers')}拆层</button><button class="btn danger" data-act="delete" aria-label="删除此作品">${icon('trash')}</button></div></div>`;
 $('[data-act="download"]',card).onclick=()=>download(a.blob,a.name);$('[data-act="split"]',card).onclick=()=>sendToSplitter(a).catch(e=>toast(e.message));$('[data-act="delete"]',card).onclick=()=>confirmDelete(a,filter);grid.append(card);}
 $('#assets-content').append(grid);
}
function confirmDelete(asset,filter) {
 const dialog=$('#studio-dialog');$('#dialog-content').innerHTML=`<h2>删除这个作品？</h2><p>${escapeHTML(asset.name)}</p><p>这会删除当前浏览器中的记录。已下载的文件不受影响。</p><div class="button-group"><button class="btn danger" id="confirm-delete">删除作品</button><button class="btn" id="cancel-delete">保留作品</button></div>`;dialog.showModal();$('#cancel-delete').onclick=()=>dialog.close();$('#confirm-delete').onclick=async()=>{try{await remove('assets',asset.id);dialog.close();await updateCount();await renderAssets(filter);toast('作品已删除。',{label:'撤销删除',run:async()=>{await put('assets',asset);await updateCount();if(active==='assets')await renderAssets(filter);toast('作品已恢复。');}});}catch(error){toast(error.message);}};
}
async function renderReferences() {
 const c=$('#view-references');referenceURLs.forEach(u=>URL.revokeObjectURL(u));referenceURLs=[];
 c.innerHTML=heading('INSPIRATION & REFERENCES','给每一个想法，一个起点','把喜欢的风格留在这里，带着参考继续制作。','COLLECT → CREATE')+`<div class="reference-layout"><div><section class="studio-card reference-intro"><div class="huaban-logo">花</div><div><h2>从花瓣，发现下一次灵感</h2><p>浏览并收藏参考链接，或上传你选中的图片作为设计对照。<br>只有上传的参考图会随你主动提交的 AI 请求使用。</p></div><a class="btn" style="margin-left:auto;flex-shrink:0" href="${casinoReferenceURL}" target="_blank" rel="noopener noreferrer">Casino Icon 参考 ↗</a></section><div class="reference-grid" id="reference-grid"><article class="studio-card reference-card"><img class="reference-image" src="${referenceURL}" alt="Icon 工作台生成的 Casino、奖励与体育图标样例"><div class="reference-body"><h3>Casino Icon · 原创工作台样例 <span class="section-counter">12 款</span></h3><p>金属、亮漆与切面宝石。每个图标都由工作台同一模型生成，可以继续修改材质、灯光和装饰。</p><div class="button-group"><button class="btn primary" id="reference-to-icons">${icon('components')}制作 Icon</button><a class="btn" href="./icon-library.html" target="_blank" rel="noopener">查看图标样例 ↗</a></div></div></article><article class="studio-card reference-card custom"><button class="reference-drop" style="width:100%;min-height:240px;border:0;border-bottom:1px dashed var(--line);border-radius:0" id="upload-reference-card">${icon('upload')}<strong style="display:block;margin:12px 0 8px">加入你的下一张参考</strong>PNG、JPG、WebP · 单张最多 20 MB</button><div class="reference-body"><h3>个人参考图</h3><p>上传作品参考、色彩灵感或活动主视觉。可以送到 Icon 对照、AI 生图或拆层工作区。</p><button class="btn" id="upload-reference-button">${icon('upload')}选择图片</button></div></article></div><div id="reference-bookmarks"></div></div><aside class="studio-card reference-sidebar"><h2>项目参考来源</h2><div class="source-row"><span class="source-icon">F</span><div><strong>Megwin 主站</strong><p>页面规范、设计组件与变量</p><a href="${figmaSources.main.url}" target="_blank" rel="noopener noreferrer">在 Figma 中查看 ↗</a></div></div><div class="source-row"><span class="source-icon">F</span><div><strong>Megwin 活动</strong><p>活动页面与营销视觉参考</p><a href="${figmaSources.activity.url}" target="_blank" rel="noopener noreferrer">在 Figma 中查看 ↗</a></div></div><div class="source-row"><span class="source-icon">花</span><div><strong>花瓣 · Casino Icon</strong><p>浏览你指定的图标搜索方向，选中图片后可以上传作对照。</p><a href="${casinoReferenceURL}" target="_blank" rel="noopener noreferrer">浏览 Casino 图标 ↗</a></div></div><form class="reference-link-form" id="bookmark-form"><label class="form-label" for="bookmark-title">收藏一个花瓣参考</label><input class="field" id="bookmark-title" placeholder="给这份灵感起个名字" maxlength="80"><input class="field" id="bookmark-url" type="url" placeholder="https://huaban.com/pins/…" required><button class="btn wide" type="submit">${icon('link')}保存参考链接</button><p class="fine-print">收藏的是链接。需要用于生成时，请上传选中的参考图片。</p></form></aside></div>`;
 $('#upload-reference-card').onclick=$('#upload-reference-button').onclick=()=>$('#reference-upload').click();$('#reference-to-icons').onclick=()=>show('icons');
 $('#bookmark-form').onsubmit=e=>{e.preventDefault();try{const u=new URL($('#bookmark-url').value);if(u.protocol!=='https:'||!(u.hostname==='huaban.com'||u.hostname.endsWith('.huaban.com')))throw new Error('请输入有效的花瓣 HTTPS 链接。');const list=readLocal('layerlab-bookmarks-v2',[]);if(list.length>=60)throw new Error('最多收藏 60 个链接，请先移除旧记录。');list.unshift({id:uuid(),url:u.href,title:$('#bookmark-title').value.trim()||'花瓣灵感参考'});saveLocal('layerlab-bookmarks-v2',list);$('#bookmark-form').reset();renderBookmarks();toast('参考链接已收藏。');}catch(error){toast(error.message);}};
 renderBookmarks();
 try {const list=await readAll('references');for(const a of list){const url=URL.createObjectURL(a.blob);referenceURLs.push(url);const card=document.createElement('article');card.className='studio-card reference-card custom';card.innerHTML=`<img class="reference-image" src="${url}" alt="${escapeHTML(a.name)}"><div class="reference-body"><h3>${escapeHTML(a.name)}</h3><p>${a.width} × ${a.height} · 个人参考图</p><div class="button-group"><button class="btn" data-act="icons">Icon 对照</button><button class="btn" data-act="ai">AI 参考</button><button class="btn" data-act="split">拆层</button><button class="btn danger" data-act="delete" aria-label="移除参考图">×</button></div></div>`;
  $('[data-act="icons"]',card).onclick=async()=>{await show('icons');mounted.get('icons').setReference(a);};$('[data-act="ai"]',card).onclick=async()=>{await show('image');imageReference={...a,dataUrl:await blobDataURL(a.blob)};updateImageReference();};$('[data-act="split"]',card).onclick=()=>sendToSplitter(a).catch(e=>toast(e.message));$('[data-act="delete"]',card).onclick=async()=>{try{await remove('references',a.id);await renderReferences();toast('参考图已移除。',{label:'撤销移除',run:async()=>{await put('references',a);if(active==='references')await renderReferences();toast('参考图已恢复。');}});}catch(error){toast(error.message);}};$('#reference-grid').append(card);}
 }catch(e){toast(e.message);}
}
function renderBookmarks() {const target=$('#reference-bookmarks');if(!target)return;target.replaceChildren();const list=readLocal('layerlab-bookmarks-v2',[]);for(const row of list){let u;try{u=new URL(row.url);if(u.protocol!=='https:'||!(u.hostname==='huaban.com'||u.hostname.endsWith('.huaban.com')))continue;}catch{continue;}const e=document.createElement('div');e.className='bookmark-row';e.innerHTML=icon('link');const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=row.title+' ↗';const b=document.createElement('button');b.textContent='×';b.setAttribute('aria-label','移除链接');b.onclick=()=>{saveLocal('layerlab-bookmarks-v2',readLocal('layerlab-bookmarks-v2',[]).filter(x=>x.id!==row.id));renderBookmarks();toast('参考链接已移除。',{label:'撤销移除',run:async()=>{const current=readLocal('layerlab-bookmarks-v2',[]);if(!current.some(x=>x.id===row.id))current.unshift(row);saveLocal('layerlab-bookmarks-v2',current);renderBookmarks();toast('参考链接已恢复。');}});};e.append(a,b);target.append(e);}}
$('#reference-upload').onchange=async e=>{const files=[...e.target.files];try{const current=await readAll('references');if(current.length+files.length>30)throw new Error('参考图最多保存 30 张，请先移除不需要的图片。');let count=0;for(const file of files){const ref=await safeReference(file);await put('references',{id:uuid(),blob:ref.blob,name:ref.name,width:ref.width,height:ref.height,createdAt:Date.now()});count++;}toast(`已加入 ${count} 张参考图。`);if(active==='references')await renderReferences();}catch(error){toast(error.message);}finally{e.target.value='';}};
window.addEventListener('beforeunload',()=>{const s=mounted.get('icons')?.getSettings?.();if(s)saveLocal('ui-studio-icon-draft-v1',s);});
icons();await show(location.hash.slice(1)||'start');await Promise.allSettled([getStatus(),updateCount()]);
