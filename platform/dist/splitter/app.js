import { analyzeImage, selectRegion } from './engine.js';
import { buildLayerZip, buildOra, buildPsd, encodePng, downloadBlob, safeFilename } from './export.js';
import { createDemo } from './demo.js';

const $ = id => document.getElementById(id);
const icons = {
  upload:'<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.7.9c0 2.1-2.9 2.4-2.9 4.1m0 3h.01"/>',
  'chevron-down':'<path d="m7 10 5 5 5-5"/>',
  'arrow-right':'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
  'arrow-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>',
  'arrow-down':'<path d="M12 4v16m-6-6 6 6 6-6"/>',
  layers:'<path d="m3 7 9-5 9 5-9 5zm0 5 9 5 9-5m-18 5 9 5 9-5"/>',
  focus:'<path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4"/><rect x="8" y="7" width="8" height="10" rx="3"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  undo:'<path d="M3 10h10a6 6 0 0 1 0 12M3 10l5-5m-5 5 5 5" transform="translate(0 -3)"/>',
  redo:'<path d="M21 10H11a6 6 0 0 0 0 12m10-12-5-5m5 5-5 5" transform="translate(0 -3)"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  cursor:'<path d="m5 3 15 10-7 1-4 7z"/>',
  select:'<path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M3 11v2m18-2v2M11 3h2m-2 18h2"/>',
  lasso:'<path d="M7 18C3 16 2 13 3 9S8 3 13 3s9 4 8 8-5 7-10 7H7Zm0 0c-3 1-2 5 2 4 3-1 3-4 1-5"/>',
  wand:'<path d="m4 20 12-12 4 4L8 24z" transform="translate(0 -3)"/><path d="m12 9 4 4M5 2v4M3 4h4m13-3v4m-2-2h4m-3 13v4m-2-2h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':'<path d="m3 3 18 18M10 5c6-2 12 7 12 7a20 20 0 0 1-4 4m-3 2C9 22 2 12 2 12a19 19 0 0 1 4-4m4 2a3 3 0 0 0 4 4"/>',
  lightbulb:'<path d="M9 18h6m-5 3h4M8 15c-5-4-3-12 4-12s9 8 4 12l-1 3H9z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  replace:'<path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.layers}</svg>`; }
function paintIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
paintIcons();

const state = {
  image:null, originalCanvas:null, originalName:'', sourceSize:null, fileBytes:0,
  width:0, height:0, layers:[], selectedId:null, processed:false, demoId:null,
  mode:'balanced', view:'composite', tool:'select', zoom:1, busy:false,
  selection:null, selectionSource:null, drag:null, analysis:null,
  undo:[], redo:[], previewUrl:null, loadSequence:0, opacitySnapshot:false, exportUrl:null,
};
let canvasCache = new Map();
let boundsCache = new WeakMap();
const canvas = $('mainCanvas'), overlay = $('selectionCanvas');
const ctx = canvas.getContext('2d'), octx = overlay.getContext('2d');
const types = {foreground:'主体区域',detail:'细节区域',background:'背景区域',color:'颜色分组',original:'原始像素',selection:'手动提取'};
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const uid = () => globalThis.crypto?.randomUUID?.() || `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const selected = () => state.layers.find(l => l.id === state.selectedId);
const project = () => ({width:state.width,height:state.height,layers:state.layers,name:state.originalName.replace(/\.[^.]+$/, ''),originalName:state.originalName});

function toast(message, error=false) {
  const item=document.createElement('div');item.className='toast'+(error?' error':'');item.textContent=message;
  $('toastContainer').append(item);setTimeout(()=>item.remove(),error?6000:3600);
}
function setText(id,text) { $(id).textContent=text; }
function rangePaint(input) {
  const percent=(+input.value - +input.min)/(+input.max - +input.min)*100;
  input.style.background=`linear-gradient(90deg,#a592f2 ${percent}%,#ece9f5 ${percent}%)`;
}
document.querySelectorAll('.range').forEach(rangePaint);

function getLayerCanvas(layer) {
  let result=canvasCache.get(layer.rgba);
  if(!result) {
    result=document.createElement('canvas');result.width=layer.width;result.height=layer.height;
    result.getContext('2d').putImageData(new ImageData(layer.rgba,layer.width,layer.height),0,0);
    canvasCache.set(layer.rgba,result);
    while(canvasCache.size>2)canvasCache.delete(canvasCache.keys().next().value);
  }
  return result;
}
function getBounds(layer) {
  if(!layer) return null;
  if(boundsCache.has(layer.rgba)) return boundsCache.get(layer.rgba);
  const d=layer.rgba,w=layer.width,h=layer.height;let x0=w,y0=h,x1=-1,y1=-1,count=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;}}
  const b=count?{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,count}:null;
  boundsCache.set(layer.rgba,b);return b;
}
function thumbnail(layer,width=100,height=70) {
  const c=document.createElement('canvas');c.width=width;c.height=height;
  const scale=Math.min(width/state.width,height/state.height);
  c.getContext('2d').drawImage(getLayerCanvas(layer),(width-state.width*scale)/2,(height-state.height*scale)/2,state.width*scale,state.height*scale);
  return c;
}

function snapshot() {return {layers:state.layers.map(l=>({...l})),selectedId:state.selectedId,processed:state.processed,analysis:state.analysis};}
function remember() {
  canvasCache.clear();
  state.undo.push(snapshot());state.redo=[];
  // Bound history by unique immutable pixel buffers, not only action count.
  while(state.undo.length>8)state.undo.shift();
  let unique=new Set();
  const bytes=()=>{unique=new Set();let n=0;for(const s of [...state.undo,snapshot()])for(const l of s.layers)if(!unique.has(l.rgba)){unique.add(l.rgba);n+=l.rgba.byteLength;}return n;};
  while(state.undo.length>1&&bytes()>200*1024*1024)state.undo.shift();
}
function restore(s) {state.layers=s.layers;state.selectedId=s.selectedId;state.processed=s.processed;state.analysis=s.analysis;state.opacitySnapshot=false;canvasCache.clear();clearSelection();render();updateAnalysisNotice();}
function undo() {if(state.busy||!state.undo.length)return;state.redo.push(snapshot());restore(state.undo.pop());toast('已撤销上一步');}
function redo() {if(state.busy||!state.redo.length)return;state.undo.push(snapshot());restore(state.redo.pop());}

function renderControls() {
  const loaded=!!state.image,layer=selected(),busy=state.busy;
  $('analyzeBtn').disabled=!loaded||busy;
  $('exportBtn').disabled=!state.layers.length||busy;
  $('undoBtn').disabled=!state.undo.length||busy;
  $('redoBtn').disabled=!state.redo.length||busy;
  $('clearBtn').disabled=!loaded||busy;
  $('uploadZone').disabled=busy;$('replaceBtn').disabled=busy;
  document.querySelectorAll('.mode-card,.demo-card,.tool-button').forEach(b=>b.disabled=busy);
  $('layerLimit').disabled=busy;$('colorTolerance').disabled=busy;
  $('showAllBtn').disabled=!state.layers.length||busy;
  $('analyzeLabel').textContent=busy?'正在处理…':state.processed?'重新自动拆分':'开始自动拆分';
  $('layerProperties').hidden=!layer;
  $('emptyState').hidden=loaded;
  $('canvasStage').hidden=!loaded||state.view==='layers';
  $('layerOverview').hidden=!loaded||state.view!=='layers';
  $('toolRail').hidden=!loaded||state.view==='layers'||state.view==='original';
  setText('layerCount',state.layers.length);
  setText('canvasSize',loaded?`${state.width} × ${state.height}`:'准备就绪');
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-selected',String(b.dataset.view===state.view));});
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===state.tool));
  $('imageFrame').classList.toggle('selecting',state.tool!=='select');
  updateHint();
  if(layer) {
    if(document.activeElement!==$('layerNameInput'))$('layerNameInput').value=layer.name;
    $('opacityRange').value=Math.round((layer.opacity??1)*100);rangePaint($('opacityRange'));
    setText('opacityValue',`${Math.round((layer.opacity??1)*100)}%`);
    setText('layerType',types[layer.type]||'像素图层');
    const bounds=getBounds(layer);
    setText('layerBounds',bounds?`${bounds.width} × ${bounds.height} px`:'透明图层');
    const at=state.layers.indexOf(layer);
    $('moveLayerUp').disabled=at===0||busy;$('moveLayerDown').disabled=at===state.layers.length-1||busy;
    $('deleteLayer').disabled=state.layers.length<=1||busy;
    $('downloadLayer').disabled=busy;$('layerNameInput').disabled=busy;$('opacityRange').disabled=busy;
  }
}
function renderLayers() {
  const list=$('layersList');list.replaceChildren();
  if(!state.layers.length){
    const blank=document.createElement('div');blank.className='no-layers';blank.innerHTML=`<span>${icon('layers')}</span><h3>每一层，都值得单独看见</h3><p>拆分完成后，图层会出现在这里。<br>独立查看、调整和导出。</p>`;list.append(blank);return;
  }
  state.layers.forEach((layer,index)=>{
    const row=document.createElement('div');row.className='layer-item'+(state.selectedId===layer.id?' selected':'')+(layer.visible===false?' hidden-layer':'');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',`选择图层 ${layer.name}`);row.dataset.layerId=layer.id;
    const num=document.createElement('span');num.className='layer-index';num.textContent=String(index+1).padStart(2,'0');
    const thumb=document.createElement('div');thumb.className='layer-item-thumb';thumb.append(thumbnail(layer,86,74));
    const title=document.createElement('div');title.className='layer-title';const strong=document.createElement('strong');strong.textContent=layer.name;strong.title=layer.name;const small=document.createElement('small');small.textContent=`${types[layer.type]||'像素图层'} · ${Math.round((layer.opacity??1)*100)}%`;title.append(strong,small);
    const eye=document.createElement('button');eye.className='icon-button';eye.setAttribute('aria-label',`${layer.visible===false?'显示':'隐藏'} ${layer.name}`);eye.title=layer.visible===false?'显示图层':'隐藏图层';eye.innerHTML=icon(layer.visible===false?'eye-off':'eye');eye.disabled=state.busy;
    eye.onclick=event=>{event.stopPropagation();if(state.busy)return;remember();state.layers=state.layers.map(l=>l.id===layer.id?{...l,visible:l.visible===false}:l);render();};
    const choose=()=>{if(state.busy)return;state.selectedId=layer.id;clearSelection();render();};
    row.onclick=choose;row.onkeydown=e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};
    row.ondblclick=()=>{$('layerNameInput').focus();$('layerNameInput').select();};
    row.append(num,thumb,title,eye);list.append(row);
  });
}
function renderOverview() {
  const container=$('layerOverview');container.replaceChildren();
  if(state.view!=='layers')return;
  state.layers.forEach((layer,index)=>{
    const card=document.createElement('button');card.className='overview-card'+(layer.id===state.selectedId?' selected':'');
    const preview=document.createElement('div');preview.className='overview-preview';preview.append(thumbnail(layer,460,310));
    const line=document.createElement('div'),name=document.createElement('span'),count=document.createElement('small');name.textContent=layer.name;count.textContent=String(index+1).padStart(2,'0');line.append(name,count);card.append(preview,line);
    card.onclick=()=>{state.selectedId=layer.id;state.view='single';clearSelection();render();};container.append(card);
  });
}
function renderCanvas() {
  if(!state.image)return;
  if(canvas.width!==state.width||canvas.height!==state.height){canvas.width=overlay.width=state.width;canvas.height=overlay.height=state.height;}
  ctx.clearRect(0,0,state.width,state.height);ctx.globalAlpha=1;
  if(state.view==='original')ctx.drawImage(state.originalCanvas,0,0);
  else if(state.view==='single'){
    const layer=selected();if(layer){ctx.globalAlpha=layer.opacity??1;ctx.drawImage(getLayerCanvas(layer),layer.x||0,layer.y||0);}
  } else {
    for(let i=state.layers.length-1;i>=0;i--){const l=state.layers[i];if(l.visible===false)continue;ctx.globalAlpha=l.opacity??1;ctx.drawImage(getLayerCanvas(l),l.x||0,l.y||0);}
  }
  ctx.globalAlpha=1;fitCanvas();drawOverlay();
}
function fitCanvas() {
  if(!state.image)return;
  const area=$('canvasArea'),spaceX=innerWidth<700?68:100,spaceY=innerWidth<700?48:72;
  const fit=Math.min((area.clientWidth-spaceX)/state.width,(area.clientHeight-spaceY)/state.height,1);
  const factor=Math.max(.02,fit)*state.zoom;
  $('imageFrame').style.width=`${Math.max(1,Math.round(state.width*factor))}px`;
  $('imageFrame').style.height=`${Math.max(1,Math.round(state.height*factor))}px`;
  setText('zoomFit',state.zoom===1?'适应画布':`${Math.round(factor*100)}%`);
}
function render(){renderControls();renderLayers();renderCanvas();renderOverview();}

function updateHint() {
  const layer=selected(),name=layer?.name||'当前图层';
  const hints={select:'点击画面选择图层 · 双击图层名称可重命名',rect:`框选「${name}」中的区域 · Shift 追加`,lasso:`圈出「${name}」中的元素 · 松开完成`,wand:`点击「${name}」的相近颜色 · Shift 追加`};
  if(state.view==='original')setText('toolHint','原始图片对照 · 切回合成图即可编辑');
  else if(state.view==='single')setText('toolHint',`单层预览 · ${hints[state.tool]}`);
  else if(state.view==='layers')setText('toolHint','点击任意图层，进入单层预览');
  else setText('toolHint',state.processed||state.tool!=='select'?hints[state.tool]:'点击「开始自动拆分」，或直接使用工具提取图层');
}
function showNotice(message){setText('analysisMessage',message);$('analysisNotice').hidden=!message;}
function updateAnalysisNotice(){
  const a=state.analysis;
  if(!a){showNotice('');return;}
  if(a.warnings?.length){showNotice(a.warnings.join(' '));return;}
  showNotice(`已按可见像素生成 ${state.layers.length} 个图层。点选图层可继续手动拆分；文字和图形均保留为像素内容。`);
}

function setBusy(busy,message='准备处理图像…') {
  state.busy=busy;$('busyOverlay').hidden=!busy;
  if(busy){setText('busyMessage',message);setText('progressText','0%');$('progressFill').style.width='0%';}
  renderControls();
}
function progress(value,message){$('progressFill').style.width=`${value}%`;setText('progressText',`${Math.round(value)}%`);if(message)setText('busyMessage',message);}

async function decodeImage(blob) {
  if(typeof createImageBitmap==='function') {
    try{return await createImageBitmap(blob,{imageOrientation:'from-image'});}catch{}
  }
  const url=URL.createObjectURL(blob);
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('这张图片无法解码，请重新导出为 PNG 或 JPG 后上传。'));image.src=url;});}
  finally{URL.revokeObjectURL(url);}
}
async function loadBlob(blob,name,demoId=null) {
  if(state.busy)return;
  if(blob.size>40*1024*1024){toast('图片超过 40 MB，请先压缩或缩小图片。',true);return;}
  if(blob.type&&!/^image\/(png|jpe?g|webp|avif|bmp|x-ms-bmp)$/i.test(blob.type)){toast('支持 PNG、JPG、WebP、AVIF 和 BMP 图片。',true);return;}
  const sequence=++state.loadSequence;setBusy(true,'正在读取图片…');setText('busyTitle','正在准备素材');
  let bitmap;
  try {
    bitmap=await decodeImage(blob);if(sequence!==state.loadSequence)return;
    const sourceWidth=bitmap.naturalWidth||bitmap.width,sourceHeight=bitmap.naturalHeight||bitmap.height;
    if(!sourceWidth||!sourceHeight)throw new Error('图片尺寸无效。');
    const factor=Math.min(1,2400/Math.max(sourceWidth,sourceHeight),Math.sqrt(2800000/(sourceWidth*sourceHeight)));
    const w=Math.max(1,Math.round(sourceWidth*factor)),h=Math.max(1,Math.round(sourceHeight*factor));
    const original=document.createElement('canvas');original.width=w;original.height=h;
    const oc=original.getContext('2d',{willReadFrequently:true});oc.imageSmoothingQuality='high';oc.drawImage(bitmap,0,0,w,h);
    const data=oc.getImageData(0,0,w,h);
    if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
    state.image=data;state.originalCanvas=original;state.originalName=String(name||'uploaded-image.png');state.sourceSize={width:sourceWidth,height:sourceHeight};state.fileBytes=blob.size;state.width=w;state.height=h;state.demoId=demoId;
    state.layers=[{id:uid(),name:'原始素材',type:'original',rgba:data.data,width:w,height:h,x:0,y:0,visible:true,opacity:1}];
    state.selectedId=state.layers[0].id;state.processed=false;state.analysis=null;state.view='composite';state.tool='select';state.zoom=1;state.undo=[];state.redo=[];state.opacitySnapshot=false;clearSelection();canvasCache.clear();boundsCache=new WeakMap();
    state.previewUrl=URL.createObjectURL(blob);$('sourceThumb').src=state.previewUrl;$('fileCard').hidden=false;
    setText('fileName',state.originalName);setText('fileInfo',`${sourceWidth} × ${sourceHeight} · ${blob.size<1048576?Math.round(blob.size/1024)+' KB':(blob.size/1048576).toFixed(1)+' MB'}`);
    $('workspaceName').replaceChildren(document.createTextNode(state.originalName.replace(/\.[^.]+$/,'')));
    const badge=document.createElement('span');badge.className='demo-badge';badge.id='demoBadge';badge.textContent='示例';badge.hidden=!demoId;$('workspaceName').append(badge);
    document.querySelectorAll('[data-demo]').forEach(b=>b.classList.toggle('selected',b.dataset.demo===demoId));
    if(factor<.999)showNotice(`原图为 ${sourceWidth} × ${sourceHeight}，已按比例缩至 ${w} × ${h} 以保持编辑流畅。导出使用此工作尺寸。`);else showNotice('');
    if(!demoId)toast('图片已就绪，可以自动拆分或手动提取');
  } catch(error){toast(error.message||'读取图片失败，请换一张图片重试。',true);}
  finally{bitmap?.close?.();setBusy(false);render();}
}
async function loadDemo(kind){
  if(state.busy)return;
  try{const item=await createDemo(kind);await loadBlob(item.blob,item.name,kind);}
  catch(error){toast('示例加载失败，请直接上传你的图片。',true);}
}
async function loadFiles(files){
  if(!files?.length)return;
  if(files.length>1)toast('每次处理一张图片，已选择第一张。');
  await loadBlob(files[0],files[0].name||'pasted-image.png');
}

async function analyze(){
  if(!state.image||state.busy)return;
  setBusy(true);setText('busyTitle','正在拆解图像');await nextFrame();
  try{
    const result=await analyzeImage(state.image,{mode:state.mode,maxLayers:+$('layerLimit').value,tolerance:+$('colorTolerance').value,fallback:'color'},({progress:p,stage})=>progress(p,stage));
    remember();state.layers=result.layers.map(l=>({...l,visible:true,opacity:1}));state.selectedId=state.layers[0]?.id;state.processed=true;state.analysis=result.analysis;state.view='composite';state.tool='select';clearSelection();progress(100,'拆分完成');
    updateAnalysisNotice();toast(`已生成 ${state.layers.length} 个独立像素图层`);
  }catch(error){toast(error.message||'自动拆分未完成，请使用手动工具提取。',true);}
  finally{setBusy(false);render();}
}

function clearSelection(){state.selection=null;state.selectionSource=null;state.drag=null;$('selectionActions').hidden=true;drawOverlay();}
function drawOverlay(){
  octx.clearRect(0,0,overlay.width,overlay.height);
  if(!state.image||state.view==='original'||state.view==='layers')return;
  const scale=state.width/Math.max(1,$('imageFrame').clientWidth);
  if(state.selection){
    const maskImage=octx.createImageData(state.width,state.height),d=maskImage.data;
    for(let i=0;i<state.selection.length;i++)if(state.selection[i]){const p=i*4;d[p]=151;d[p+1]=113;d[p+2]=255;d[p+3]=95;}
    octx.putImageData(maskImage,0,0);
  }
  octx.strokeStyle='#b395ff';octx.lineWidth=1.25*scale;octx.setLineDash([5*scale,4*scale]);
  if(state.drag){
    const d=state.drag;octx.fillStyle='#a98af329';octx.beginPath();
    if(d.tool==='rect'){const a=d.start,b=d.current;octx.rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
    else if(d.points.length){octx.moveTo(d.points[0].x,d.points[0].y);d.points.forEach(p=>octx.lineTo(p.x,p.y));octx.closePath();}
    octx.fill();octx.stroke();
  }else if(state.processed&&state.tool==='select'&&state.view==='composite'){
    const l=selected(),b=getBounds(l);
    if(b&&l.type!=='background'&&l.visible!==false){octx.strokeStyle='#cbb3ff';octx.strokeRect(b.x,b.y,b.width,b.height);}
  }
  octx.setLineDash([]);
}
function setSelection(mask,add=false){
  const layer=selected();if(!layer)return;
  const result=new Uint8Array(state.width*state.height);let count=0;
  for(let i=0;i<result.length;i++){if(layer.rgba[i*4+3]&&(mask[i]||(add&&state.selectionSource===layer.id&&state.selection?.[i]))){result[i]=1;count++;}}
  if(!count){clearSelection();toast('选区内没有当前图层的内容，请先选择对应图层。');return;}
  state.selection=result;state.selectionSource=layer.id;setText('selectionCount',`${count>10000?(count/10000).toFixed(1)+'万':count.toLocaleString()} 像素`);$('selectionActions').hidden=false;drawOverlay();
}
function pointerPosition(event){const rect=overlay.getBoundingClientRect();return{x:Math.max(0,Math.min(state.width-1,Math.floor((event.clientX-rect.left)/rect.width*state.width))),y:Math.max(0,Math.min(state.height-1,Math.floor((event.clientY-rect.top)/rect.height*state.height)))};}
function chooseAt(pos){
  if(state.view==='single')return;
  const p=(pos.y*state.width+pos.x)*4;
  const layer=state.layers.find(l=>l.visible!==false&&(l.opacity??1)>0&&l.rgba[p+3]>10);
  if(layer){state.selectedId=layer.id;clearSelection();render();}
}
overlay.addEventListener('pointerdown',event=>{
  if(state.busy||!state.image||state.view==='original'||event.button!==0)return;
  const pos=pointerPosition(event);
  if(state.tool==='select'){chooseAt(pos);return;}
  const l=selected();if(!l)return;
  if(state.tool==='wand'){
    if(!l.rgba[(pos.y*state.width+pos.x)*4+3]){toast('请点选当前图层中有内容的位置。');return;}
    const mask=selectRegion({data:l.rgba,width:state.width,height:state.height},pos.x,pos.y,+$('colorTolerance').value,true);setSelection(mask,event.shiftKey);return;
  }
  event.preventDefault();overlay.setPointerCapture(event.pointerId);
  state.drag={tool:state.tool,start:pos,current:pos,points:[pos],add:event.shiftKey};drawOverlay();
});
overlay.addEventListener('pointermove',event=>{if(!state.drag)return;const p=pointerPosition(event);state.drag.current=p;if(state.drag.tool==='lasso'){const last=state.drag.points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)>1)state.drag.points.push(p);}drawOverlay();});
function finishSelection(event){
  if(!state.drag)return;const drag=state.drag;state.drag=null;
  try{overlay.releasePointerCapture(event.pointerId);}catch{}
  const mask=new Uint8Array(state.width*state.height);
  if(drag.tool==='rect'){
    const x0=Math.min(drag.start.x,drag.current.x),x1=Math.max(drag.start.x,drag.current.x),y0=Math.min(drag.start.y,drag.current.y),y1=Math.max(drag.start.y,drag.current.y);
    if(x1-x0<2||y1-y0<2){drawOverlay();return;}
    for(let y=y0;y<=y1;y++)mask.fill(1,y*state.width+x0,y*state.width+x1+1);
  } else {
    if(drag.points.length<3){drawOverlay();return;}
    const temp=document.createElement('canvas');temp.width=state.width;temp.height=state.height;const tc=temp.getContext('2d',{willReadFrequently:true});tc.beginPath();tc.moveTo(drag.points[0].x,drag.points[0].y);drag.points.forEach(p=>tc.lineTo(p.x,p.y));tc.closePath();tc.fill();
    const d=tc.getImageData(0,0,state.width,state.height).data;for(let i=0;i<mask.length;i++)if(d[i*4+3]>127)mask[i]=1;
  }
  setSelection(mask,drag.add);
}
overlay.addEventListener('pointerup',finishSelection);
overlay.addEventListener('pointercancel',()=>{state.drag=null;drawOverlay();});

async function extract(){
  if(!state.selection||state.busy)return;
  const source=selected();if(!source||source.id!==state.selectionSource)return;
  if(state.layers.length>=24||state.layers.length*state.width*state.height*4>220*1024*1024){toast('当前图层较多，请先导出项目，再继续处理其他元素。',true);return;}
  const split=new Uint8ClampedArray(source.rgba.length),rest=source.rgba.slice();let remainder=0;
  for(let i=0;i<state.selection.length;i++){const p=i*4;if(state.selection[i]){split[p]=rest[p];split[p+1]=rest[p+1];split[p+2]=rest[p+2];split[p+3]=rest[p+3];rest[p]=rest[p+1]=rest[p+2]=rest[p+3]=0;}else if(rest[p+3])remainder++;}
  remember();const id=uid(),at=state.layers.indexOf(source),newLayer={...source,id,name:`提取图层 ${String(state.layers.filter(l=>l.type==='selection').length+1).padStart(2,'0')}`,type:'selection',rgba:split};
  state.layers=[...state.layers.slice(0,at),newLayer,...(remainder?[{...source,rgba:rest}]:[]),...state.layers.slice(at+1)];state.selectedId=id;state.processed=true;state.tool='select';clearSelection();render();toast('选区已成为独立图层，原位置保持不变');
}
function setTool(tool){if(state.busy||!state.image)return;state.tool=tool;if(state.view==='original'||state.view==='layers')state.view='composite';renderControls();renderCanvas();}

function setLayerProperty(key,value,withHistory=true){
  const layer=selected();if(!layer||state.busy||layer[key]===value)return;if(withHistory)remember();state.layers=state.layers.map(l=>l.id===layer.id?{...l,[key]:value}:l);render();
}
function reorder(direction){
  if(state.busy)return;const at=state.layers.findIndex(l=>l.id===state.selectedId),next=at+direction;if(next<0||next>=state.layers.length)return;
  remember();const layers=[...state.layers];[layers[at],layers[next]]=[layers[next],layers[at]];state.layers=layers;render();
}

async function exportOne(){
  const layer=selected();if(!layer||state.busy)return;
  const btn=$('downloadLayer');btn.disabled=true;
  try{const pixels=layer.rgba.slice();const opacity=layer.opacity??1;for(let p=3;p<pixels.length;p+=4)pixels[p]=Math.round(pixels[p]*opacity);const blob=await encodePng(layer.width,layer.height,pixels);downloadBlob(blob,safeFilename(layer.name)+'.png');toast('已下载透明 PNG，保留当前不透明度和完整画布尺寸');}
  catch(error){toast(error.message||'PNG 导出失败，请重试。',true);}finally{btn.disabled=false;}
}
function openExport(){if(!state.layers.length||state.busy)return;commitLayerName();setText('exportSummary',`${state.layers.length} 个像素图层 · ${state.width} × ${state.height} px · 保留隐藏图层`);setText('exportProgress','');$('saveExport').hidden=true;$('exportDialog').showModal();}
async function exportProject(){
  if(state.busy||!state.layers.length)return;
  const format=document.querySelector('input[name="format"]:checked').value;
  const builders={psd:buildPsd,zip:buildLayerZip,ora:buildOra};state.busy=true;
  $('confirmExport').disabled=true;$('saveExport').hidden=true;$('exportDialog').querySelector('.modal-close button').disabled=true;document.querySelectorAll('.format-card input').forEach(i=>i.disabled=true);
  try{
    await nextFrame();const blob=await builders[format](project(),(p,message)=>setText('exportProgress',`${message} · ${Math.round(p)}%`));
    if(state.exportUrl)URL.revokeObjectURL(state.exportUrl);state.exportUrl=URL.createObjectURL(blob);
    const link=$('saveExport');link.href=state.exportUrl;link.download=`${safeFilename(project().name)}-layers.${format}`;link.hidden=false;link.click();setText('exportProgress',`文件已生成 · ${(blob.size/1048576).toFixed(1)} MB · 若未开始下载，请点击下方保存`);toast('图层文件已生成');
  }catch(error){setText('exportProgress','导出未完成，请重试。');toast(error.message||'导出失败，请稍后重试。',true);}
  finally{state.busy=false;$('confirmExport').disabled=false;$('exportDialog').querySelector('.modal-close button').disabled=false;document.querySelectorAll('.format-card input').forEach(i=>i.disabled=false);renderControls();}
}

function clearProject(){
  if(state.busy)return;
  if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
  Object.assign(state,{image:null,originalCanvas:null,layers:[],selectedId:null,processed:false,demoId:null,width:0,height:0,undo:[],redo:[],analysis:null,previewUrl:null,opacitySnapshot:false});clearSelection();$('fileCard').hidden=true;setText('workspaceName','未命名项目');showNotice('');canvasCache.clear();boundsCache=new WeakMap();render();toast('工作区已清空，可上传新的图片');
}

// UI wiring. Every control either changes pixels/state or performs a real export.
['uploadZone','replaceBtn','emptyUpload'].forEach(id=>$(id).onclick=()=>{if(!state.busy)$('fileInput').click();});
$('fileInput').onchange=async e=>{await loadFiles(e.target.files);e.target.value='';};
$('analyzeBtn').onclick=analyze;$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('clearBtn').onclick=clearProject;
$('exportBtn').onclick=openExport;$('confirmExport').onclick=exportProject;$('downloadLayer').onclick=exportOne;
['helpBtn','tipsHelp'].forEach(id=>$(id).onclick=()=>$('helpDialog').showModal());$('closeHelp').onclick=()=>$('helpDialog').close();
$('dismissNotice').onclick=()=>$('analysisNotice').hidden=true;
document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{if(state.busy)return;state.mode=btn.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-checked',String(b===btn));});});
document.querySelectorAll('[data-demo]').forEach(btn=>btn.onclick=()=>loadDemo(btn.dataset.demo));
document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>{if(state.busy)return;state.view=btn.dataset.view;clearSelection();render();});
document.querySelectorAll('[data-tool]').forEach(btn=>btn.onclick=()=>setTool(btn.dataset.tool));
$('layerLimit').oninput=e=>{rangePaint(e.target);setText('layerLimitValue',`${e.target.value} 层`);};
$('colorTolerance').oninput=e=>{rangePaint(e.target);setText('toleranceValue',e.target.value);};
$('zoomOut').onclick=()=>{state.zoom=Math.max(.4,state.zoom/1.2);fitCanvas();drawOverlay();};
$('zoomIn').onclick=()=>{state.zoom=Math.min(5,state.zoom*1.2);fitCanvas();drawOverlay();};
$('zoomFit').onclick=()=>{state.zoom=1;fitCanvas();drawOverlay();};
$('clearSelection').onclick=clearSelection;$('extractSelection').onclick=extract;
$('invertSelection').onclick=()=>{if(!state.selection)return;const inverse=state.selection.map(v=>v?0:1);setSelection(inverse);};
function commitLayerName(){const input=$('layerNameInput'),name=input.value.trim().slice(0,80);if(name)setLayerProperty('name',name);else input.value=selected()?.name||'';}
$('layerNameInput').onchange=commitLayerName;
$('layerNameInput').onblur=commitLayerName;
$('layerNameInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commitLayerName();e.target.blur();}};
$('opacityRange').addEventListener('pointerdown',()=>{if(!state.busy){remember();state.opacitySnapshot=true;}});
$('opacityRange').oninput=e=>{if(!state.opacitySnapshot){remember();state.opacitySnapshot=true;}setLayerProperty('opacity',+e.target.value/100,false);};
$('opacityRange').onchange=()=>state.opacitySnapshot=false;
['pointerup','pointercancel','blur'].forEach(event=>$('opacityRange').addEventListener(event,()=>state.opacitySnapshot=false));
$('moveLayerUp').onclick=()=>reorder(-1);$('moveLayerDown').onclick=()=>reorder(1);
$('deleteLayer').onclick=()=>{if(state.layers.length<=1||state.busy)return;const at=state.layers.findIndex(l=>l.id===state.selectedId);remember();state.layers=state.layers.filter(l=>l.id!==state.selectedId);state.selectedId=state.layers[Math.min(at,state.layers.length-1)].id;clearSelection();render();toast('图层已删除，可通过撤销恢复');};
$('showAllBtn').onclick=()=>{if(state.busy||state.layers.every(l=>l.visible!==false))return;remember();state.layers=state.layers.map(l=>({...l,visible:true}));render();};
document.querySelectorAll('input[name="format"]').forEach(input=>input.onchange=()=>{document.querySelectorAll('.format-card').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));setText('confirmExportLabel',{psd:'下载分层 PSD',zip:'下载 PNG 图层包',ora:'下载 OpenRaster 工程'}[input.value]);});
$('exportDialog').addEventListener('cancel',e=>{if(state.busy)e.preventDefault();});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog&&!state.busy){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
window.addEventListener('resize',()=>{fitCanvas();drawOverlay();});
new ResizeObserver(()=>fitCanvas()).observe($('canvasArea'));
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(state.busy)return;
  if(e.key==='Escape'){clearSelection();return;}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey){const tool={v:'select',m:'rect',l:'lasso',w:'wand'}[e.key.toLowerCase()];if(tool){e.preventDefault();setTool(tool);}}
});
document.addEventListener('paste',e=>{
  if(state.busy||document.querySelector('dialog[open]')||e.target.closest('input,textarea,[contenteditable="true"]'))return;
  const items=[...(e.clipboardData?.items||[])];const file=items.find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();
  if(file){e.preventDefault();loadBlob(file,file.name||'pasted-image.png');}
});
let dragCount=0;
document.addEventListener('dragenter',e=>{if([...e.dataTransfer?.types||[]].includes('Files')){e.preventDefault();dragCount++;if(!state.busy)$('dropOverlay').hidden=false;}});
document.addEventListener('dragover',e=>{if([...e.dataTransfer?.types||[]].includes('Files'))e.preventDefault();});
document.addEventListener('dragleave',()=>{dragCount=Math.max(0,dragCount-1);if(!dragCount)$('dropOverlay').hidden=true;});
document.addEventListener('drop',e=>{e.preventDefault();dragCount=0;$('dropOverlay').hidden=true;if(!state.busy&&e.dataTransfer?.files.length)loadFiles(e.dataTransfer.files);});

// Same-origin handoff from the creative studio. Raster content is decoded locally.
const embedded = new URLSearchParams(location.search).get('embedded') === '1';
if (embedded) {
  document.body.classList.add('embedded');
  window.addEventListener('message', async event => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (event.data?.type === 'layerlab:export') { if (!state.busy) openExport(); return; }
    if (event.data?.type !== 'layerlab:import') return;
    if (state.busy) { toast('当前拆层操作尚未完成，请稍后重新发送作品。', true); return; }
    const data = event.data.dataUrl;
    if (typeof data !== 'string' || data.length > 58 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) { toast('收到的图片格式无效。', true); return; }
    try {
      const comma = data.indexOf(','), mime = data.slice(5, data.indexOf(';')), binary = atob(data.slice(comma + 1));
      const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await loadBlob(new Blob([bytes], {type: mime}), String(event.data.name || '设计工作台作品.png').slice(0,180));
    } catch { toast('作品传入失败，请下载图片后重新上传。', true); }
  });
}
render();
await loadDemo('sports');
if (embedded && window.parent !== window) window.parent.postMessage({type:'layerlab:ready'},location.origin);
