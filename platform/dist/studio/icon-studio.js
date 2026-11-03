import { ICON_SUBJECTS, ICON_STYLES, ICON_ACCESSORIES, ICON_DEFAULTS, normalizeIconState, renderIcon, renderIconThumbnail } from './icon-renderer.js';
import { createArtHistory, cloneArtState } from './art-history.js';

const STORAGE_KEY = 'ui-studio-icon-draft-v1';
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  arrow:'M4 12h16m-5-5 5 5-5 5', download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  undo:'M9 4 4 9l5 5M4 9h10a7 7 0 0 1 0 14', redo:'m15 4 5 5-5 5m5-5H10a7 7 0 0 0 0 14',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  copy:'M9 8h11v13H9zM5 16H3V3h11v2',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeoff:'m3 3 18 18M9 5.5A13 13 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.5 4M5.5 6.5A18 18 0 0 0 2 12s4 7 10 7a14 14 0 0 0 4-1',
  up:'m6 14 6-6 6 6', down:'m6 10 6 6 6-6', reset:'M3 11a9 9 0 1 1 3 7M3 4v7h7',
  layers:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  folder:'M3 7h7l2 2h9v11H3zM3 7V4h6l3 3', image:'M3 3h18v18H3zM3 17l5-5 4 4 3-3 6 6M7 8h1',
  close:'m6 6 12 12M18 6 6 18', plus:'M12 5v14M5 12h14', check:'m5 12 4 4L19 6',
  sparkle:'m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.sparkle}"/></svg>`;
const pause = () => new Promise(resolve => setTimeout(resolve, 25));
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const nameOf = kind => [...ICON_SUBJECTS, ...ICON_ACCESSORIES].find(item => item.id === kind)?.name || '图标';
const readDraft = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } };
const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('PNG 编码未完成，请重试。')), 'image/png'));

function attachStyles(doc) {
  if (doc.querySelector('link[data-icon-studio-css]')) return;
  const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./icon-studio.css', import.meta.url).href;
  link.dataset.iconStudioCss = 'true'; doc.head.append(link);
}

/** Browser-local, undoable icon composition. Reference images are for comparison only. */
export function mountIconStudio(container, options = {}) {
  if (!container?.appendChild) throw new Error('Icon 工作台需要有效的容器。');
  const doc = container.ownerDocument || document;
  attachStyles(doc);
  const incoming = options.initialState && Object.keys(options.initialState).length ? options.initialState : readDraft();
  let state = normalizeIconState(cloneArtState(incoming || ICON_DEFAULTS));
  let selected = state.layers.find(layer => layer.role === 'main')?.id || state.layers.at(-1)?.id || null;
  let category = 'casino', activeStep = 1, destroyed = false, renderTimer = 0, thumbTimer = 0, thumbEpoch = 0;
  let revision = 0, renderedRevision = -1, renderMeta = null, renderError = null, busy = false, dragging = null;
  let referenceURL = null, referenceName = '', downloadURL = null, toastTimer = 0, layerFingerprint = '', storageWarned = false;
  const abort = new AbortController(), history = createArtHistory(state, { limit: 80 });
  const root = doc.createElement('section'); root.className = 'icon-root'; root.setAttribute('aria-label', 'Icon 生成工作台');
  root.innerHTML = `
    <header class="icon-heading"><div><div class="icon-eyebrow">ICON DESIGN STUDIO <i></i> CASINO & SPORTS</div><h1>Icon 生成工作台 <span>${ICON_SUBJECTS.length} 种立体主体</span></h1><p>从一个图标开始，定义材质、灯光与构图，输出可以直接用于 UI 的透明素材。</p></div><div class="icon-heading-actions"><a class="icon-btn quiet" href="./icon-library.html" target="_blank" rel="noopener">查看图标示例 ${svg('arrow')}</a><button class="icon-btn quiet" data-action="reference">${svg('image')}添加对照图</button></div></header>
    <nav class="icon-flow" aria-label="图标创作流程">${[['主体选择','01'],['材质与灯光','02'],['装饰与构图','03'],['检查与导出','04']].map(([name,n],i)=>`<button type="button" data-step="${i+1}" ${i===0?'aria-current="step"':''}><span>${n}</span><strong>${name}</strong></button>`).join('')}<span class="icon-draft-state" role="status">本地草稿已载入</span></nav>
    <div class="icon-workspace">
      <aside class="icon-controls" aria-label="图标参数">
        <section class="icon-section" data-section="1"><div class="icon-section-head"><h2>01 · 选择图标主体</h2><span>${ICON_SUBJECTS.length} MODELS</span></div><div class="icon-category" role="group" aria-label="图标分类">${[['casino','Casino'],['rewards','奖励'],['sports','体育'],['all','全部']].map(([id,name])=>`<button type="button" data-category="${id}" aria-pressed="${id===category}">${name}</button>`).join('')}</div><div class="icon-subjects" role="group" aria-label="图标主体"></div><p class="icon-subject-note"></p><button class="icon-next" data-step="2">下一步：定义材质 ${svg('arrow')}</button></section>
        <section class="icon-section" data-section="2"><div class="icon-section-head"><h2>02 · 材质与灯光</h2><span>${ICON_STYLES.length} FINISHES</span></div><div class="icon-styles" role="group" aria-label="材质风格">${ICON_STYLES.map(style=>`<button type="button" class="icon-style" data-style="${style.id}" aria-pressed="false"><span class="icon-style-swatch" style="--swatch:${style.primary};--detail:${style.accent}"></span><span><strong>${escapeHTML(style.name)}</strong><small>${escapeHTML(style.note)}</small></span></button>`).join('')}</div>
          <div class="icon-slider-group">${[
            ['gloss','高光与反射',0,100,1,'%'],['shadow','投影强度',0,100,1,'%'],['lightDirection','灯光方向',-180,180,5,'°'],['glow','轮廓光强度',0,60,1,'%'],['yaw','水平视角',-55,55,1,'°'],['pitch','俯仰视角',-35,45,1,'°']
          ].map(([key,label,min,max,step,unit])=>`<label class="icon-slider"><span>${label}<output data-output="${key}"></output></span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" data-unit="${unit}" aria-label="${label}"></label>`).join('')}</div><button class="icon-next" data-step="3">下一步：添加装饰 ${svg('arrow')}</button>
        </section>
        <section class="icon-section" data-section="3"><div class="icon-section-head"><h2>03 · 装饰与构图</h2><span>独立图层</span></div><p class="icon-help">点击添加装饰；可重复添加。选中画布或图层后，自由移动、缩放、旋转和删除。</p><div class="icon-accessories" role="group" aria-label="添加装饰">${ICON_ACCESSORIES.map(item=>`<button type="button" data-accessory="${item.id}" title="添加${item.name}"><canvas width="96" height="96" data-accessory-thumb="${item.id}" aria-hidden="true"></canvas><span>${item.name}</span><i>${svg('plus')}</i></button>`).join('')}</div><div class="icon-accessory-actions"><span class="icon-layer-limit"></span><button class="icon-link" data-action="clear-decor">清空装饰</button></div><button class="icon-next" data-step="4">下一步：检查并导出 ${svg('arrow')}</button></section>
        <section class="icon-section icon-inspiration"><h2>参考方向</h2><p>反光金属、宝石切面、亮漆与深色侧面。图标采用本地 3D 模型生成，添加对照图可辅助人工调整。</p><a href="https://huaban.com/search?q=casino+icon" target="_blank" rel="noopener noreferrer">花瓣 · casino icon ${svg('arrow')}</a><small>链接用于浏览灵感；不会自动抓取或复刻外站素材。</small></section>
      </aside>
      <div class="icon-content" aria-label="图标预览与导出">
        <section class="icon-preview-card"><div class="icon-toolbar" role="toolbar" aria-label="图标编辑操作"><div><button class="icon-tool" data-action="undo" title="撤回 Ctrl / ⌘ Z" aria-label="撤回">${svg('undo')}撤回</button><button class="icon-tool" data-action="redo" title="重做 Ctrl / ⌘ Shift Z" aria-label="重做">${svg('redo')}重做</button><span class="icon-history-count"></span></div><div><button class="icon-tool" data-action="duplicate" aria-label="复制选中图层">${svg('copy')}复制</button><button class="icon-tool danger" data-action="delete" aria-label="删除选中图层">${svg('trash')}删除</button><button class="icon-tool" data-action="reset" title="恢复初始图标，可撤回">${svg('reset')}重置</button></div></div>
          <div class="icon-preview-bar"><strong><i></i>实时画布 <span class="icon-dimensions"></span></strong><div class="icon-tone" role="group" aria-label="画布预览底色"><button data-tone="dark" aria-pressed="true" title="深色预览">深色</button><button data-tone="light" aria-pressed="false" title="浅色预览">浅色</button></div></div>
          <div class="icon-stage" data-tone="dark"><div class="icon-canvas-wrap"><canvas class="icon-canvas" width="512" height="512" tabindex="0" aria-label="图标实时预览，可选中并拖动图层"></canvas><div class="icon-selection" hidden><span></span><i></i><i></i><i></i><i></i></div></div><div class="icon-empty" hidden>${svg('layers')}<strong>画布里还没有图标</strong><p>选择左侧主体，或撤回刚才的删除。</p></div><div class="icon-render-error" hidden role="status"><strong>预览暂时无法渲染</strong><p></p><button class="icon-btn" data-action="retry">重新渲染</button></div><span class="icon-stage-note">拖动选中图层 · 预览底色不会写入透明 PNG</span></div>
          <div class="icon-preview-footer"><span class="icon-current-description"></span><span class="icon-render-status" role="status">准备画布…</span></div>
        </section>
        <section class="icon-layer-card"><div class="icon-layer-heading"><h2>${svg('layers')}图层 <span class="icon-layer-count"></span></h2><span>上方图层位于前景</span></div><div class="icon-layer-list" aria-label="图层列表"></div><div class="icon-inspector" hidden><div class="icon-inspector-head"><strong class="icon-selected-name"></strong><div><button class="icon-tool" data-action="back">${svg('down')}后移</button><button class="icon-tool" data-action="front">${svg('up')}前移</button><button class="icon-link" data-action="center">居中</button></div></div><div class="icon-transform-grid">${[['x','水平位置',-50,50,1],['y','垂直位置',-50,50,1],['scale','大小',10,170,1],['rotation','旋转',-180,180,1]].map(([key,label,min,max,step])=>`<label class="icon-slider"><span>${label}<output data-layer-output="${key}"></output></span><input type="range" data-transform="${key}" min="${min}" max="${max}" step="${step}" aria-label="选中图层${label}"></label>`).join('')}</div></div><p class="icon-selection-hint">点击图层可选中；Delete 删除，方向键微调，Shift + 方向键加速。</p></section>
        <section class="icon-export-card" data-section="4"><div class="icon-section-head"><h2>04 · 检查与导出</h2><span>PNG + 可编辑项目</span></div><div class="icon-export-settings"><label>导出尺寸<select class="icon-size" aria-label="图标导出尺寸">${[128,256,512,1024,2048].map(size=>`<option value="${size}">${size} × ${size}${size===1024?' · 推荐':''}</option>`).join('')}</select></label><label class="icon-checkbox"><input type="checkbox" class="icon-transparent">透明背景</label><label class="icon-background" hidden>背景色<input type="color" aria-label="图标导出背景色"></label></div><p class="icon-export-summary"></p><div class="icon-export-actions"><button class="icon-btn primary" data-action="png" disabled>${svg('download')}下载 PNG</button><button class="icon-btn" data-action="asset" disabled>${svg('folder')}加入作品</button><button class="icon-btn" data-action="splitter" disabled>${svg('layers')}继续拆层</button></div><div class="icon-project-actions"><button class="icon-link" data-action="export-project">导出可编辑项目</button><button class="icon-link" data-action="import-project">导入项目</button><span>图层、材质、灯光一并保存</span></div><div class="icon-download-ready" hidden role="status"></div><p class="icon-output-note">透明 PNG 保留反射与投影；项目 JSON 用于回到本工作台继续编辑。</p></section>
        <section class="icon-reference-card" hidden><button class="icon-reference-image" data-action="view-reference" aria-label="放大对照图"><img alt="图标风格对照图"></button><div><small>本地风格对照</small><strong class="icon-reference-name"></strong><p>只用于视觉对照，不会被自动识别，也不会加入导出图片。</p><button class="icon-link" data-action="view-reference">放大查看</button></div><button class="icon-tool" data-action="remove-reference" aria-label="移除对照图">${svg('close')}</button></section>
        <p class="icon-bottom-note">本地生成，无需等待模型服务。草稿与作品保存在当前浏览器，重要文件请下载留存。</p>
      </div>
    </div>
    <input class="icon-reference-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><input class="icon-project-file" type="file" accept="application/json,.json" hidden>
    <dialog class="icon-reference-dialog"><header><strong>图标风格对照</strong><button class="icon-tool" data-action="close-reference" aria-label="关闭对照图">${svg('close')}</button></header><img alt="完整图标风格参考图"><p>对照图不随图标导出。</p></dialog><div class="icon-toast" role="status" hidden></div>`;
  container.append(root);
  const q = selector => root.querySelector(selector), qa = selector => [...root.querySelectorAll(selector)];
  const on = (element,event,handler) => element.addEventListener(event,handler,{signal:abort.signal});
  const canvas = q('.icon-canvas'), stage = q('.icon-stage');
  const exportButtons = qa('[data-action="png"],[data-action="asset"],[data-action="splitter"]');

  function toast(message, error = false) {
    if (destroyed) return;
    if (options.toast) { options.toast(message,error); return; }
    const node=q('.icon-toast');node.textContent=message;node.hidden=false;node.dataset.error=String(error);
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},4500);
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state));q('.icon-draft-state').textContent='草稿已自动保存'; }
    catch { q('.icon-draft-state').textContent='保存失败，请导出项目';if(!storageWarned){storageWarned=true;toast('浏览器存储不可用，请导出可编辑项目留存。',true);} }
    options.onSettingsChange?.(cloneArtState(state));
  }
  function currentLayer() { return state.layers.find(layer=>layer.id===selected); }
  function visibleCount() { return state.layers.filter(layer=>!layer.hidden).length; }
  function ready() { return !busy && !renderError && renderedRevision===revision && visibleCount()>0; }
  function syncButtons() {
    q('[data-action="undo"]').disabled=busy||!history.canUndo;q('[data-action="redo"]').disabled=busy||!history.canRedo;
    q('[data-action="undo"]').title=history.canUndo?`撤回：${history.undoLabel} · Ctrl / ⌘ Z`:'暂无可撤回操作';
    q('[data-action="redo"]').title=history.canRedo?`重做：${history.redoLabel} · Ctrl / ⌘ Shift Z`:'暂无可重做操作';
    q('.icon-history-count').textContent=history.undoCount?`${history.undoCount} 步`:'';
    for(const action of ['delete','duplicate','center'])q(`[data-action="${action}"]`).disabled=busy||!currentLayer()||(action==='duplicate'&&state.layers.length>=12);
    const index=state.layers.findIndex(layer=>layer.id===selected);
    q('[data-action="back"]').disabled=busy||index<=0;q('[data-action="front"]').disabled=busy||index<0||index>=state.layers.length-1;
    for(const button of exportButtons)button.disabled=!ready();
    if(!options.onAsset)q('[data-action="asset"]').hidden=true;if(!options.onSendToSplitter)q('[data-action="splitter"]').hidden=true;
    for(const button of qa('[data-accessory]'))button.disabled=busy||state.layers.length>=12;
    q('[data-action="clear-decor"]').disabled=busy||!state.layers.some(layer=>layer.role==='decoration');
  }
  function syncSelection() {
    const box=q('.icon-selection'),layer=currentLayer(),region=renderMeta?.hitRegions?.find(hit=>hit.id===selected);
    box.hidden=!layer||layer.hidden||!region||!!renderError;
    if(box.hidden)return;
    const b=region.bounds,w=renderMeta.width||512,h=renderMeta.height||512;
    box.style.left=`${b.x/w*100}%`;box.style.top=`${b.y/h*100}%`;box.style.width=`${b.width/w*100}%`;box.style.height=`${b.height/h*100}%`;
    q('.icon-selection span').textContent=nameOf(layer.kind);
  }
  function syncInspector() {
    const layer=currentLayer();q('.icon-inspector').hidden=!layer;
    if(layer){q('.icon-selected-name').textContent=nameOf(layer.kind)+(layer.role==='main'?' · 主体':' · 装饰');
      for(const input of qa('[data-transform]')){const key=input.dataset.transform,value=key==='rotation'?layer[key]:Math.round(layer[key]*100);input.value=value;q(`[data-layer-output="${key}"]`).textContent=`${value}${key==='rotation'?'°':'%'}`;}}
    syncButtons();syncSelection();
  }
  function syncLayers() {
    const fingerprint=JSON.stringify(state.layers.map(layer=>[layer.id,layer.kind,layer.role,layer.hidden]))+'|'+selected;
    if(fingerprint!==layerFingerprint){layerFingerprint=fingerprint;
      q('.icon-layer-list').innerHTML=state.layers.length?[...state.layers].reverse().map((layer,index)=>`<div class="icon-layer-row ${layer.id===selected?'selected':''}" data-row="${layer.id}"><button type="button" class="icon-layer-select" data-select-layer="${layer.id}" aria-pressed="${layer.id===selected}"><span class="icon-layer-number">${state.layers.length-index}</span><span><strong>${escapeHTML(nameOf(layer.kind))}</strong><small>${layer.role==='main'?'图标主体':'装饰图层'}${layer.hidden?' · 已隐藏':''}</small></span></button><button class="icon-tool" type="button" data-toggle-layer="${layer.id}" aria-label="${layer.hidden?'显示':'隐藏'}${escapeHTML(nameOf(layer.kind))}" title="${layer.hidden?'显示':'隐藏'}图层">${svg(layer.hidden?'eyeoff':'eye')}</button><button class="icon-tool danger" type="button" data-delete-layer="${layer.id}" aria-label="删除${escapeHTML(nameOf(layer.kind))}" title="删除图层">${svg('trash')}</button></div>`).join(''):'<p class="icon-empty-layers">选择一个主体，开始新的图标设计。</p>';
    }
    q('.icon-layer-count').textContent=String(state.layers.length);q('.icon-layer-limit').textContent=`${state.layers.length} / 12 个图层`;
    syncInspector();
  }
  function sync() {
    for(const input of qa('[data-setting]')){input.value=state[input.dataset.setting];q(`[data-output="${input.dataset.setting}"]`).textContent=`${Math.round(state[input.dataset.setting])}${input.dataset.unit}`;}
    for(const button of qa('[data-subject]'))button.setAttribute('aria-pressed',String(button.dataset.subject===state.subject));
    for(const button of qa('[data-style]'))button.setAttribute('aria-pressed',String(button.dataset.style===state.style));
    q('.icon-subject-note').textContent=ICON_SUBJECTS.find(item=>item.id===state.subject)?.note||'';
    const size=q('.icon-size'),sizeValue=state.width===state.height?String(state.width):`${state.width}x${state.height}`;
    if(![...size.options].some(option=>option.value===sizeValue)){const option=doc.createElement('option');option.value=sizeValue;option.textContent=`${state.width} × ${state.height} · 已导入`;size.append(option);}size.value=sizeValue;
    q('.icon-transparent').checked=state.transparent;q('.icon-background').hidden=state.transparent;q('.icon-background input').value=state.background;
    q('.icon-dimensions').textContent=`${state.width} × ${state.height}`;
    q('.icon-current-description').textContent=`${nameOf(state.subject)} / ${ICON_STYLES.find(style=>style.id===state.style)?.name||''}`;
    q('.icon-export-summary').textContent=`${visibleCount()} 个可见图层 · ${state.width} × ${state.height} px · ${state.transparent?'透明背景 PNG':'带背景 PNG'}`;
    q('.icon-empty').hidden=visibleCount()>0;q('.icon-stage-note').hidden=visibleCount()===0;
    syncLayers();
  }
  function scheduleRender(delay=100) {
    revision++;clearTimeout(renderTimer);q('.icon-render-status').textContent='正在更新…';syncButtons();
    renderTimer=setTimeout(()=>{
      if(destroyed)return;
      try{
        const w=state.width>=state.height?512:Math.max(128,Math.round(512*state.width/state.height)),h=state.height>=state.width?512:Math.max(128,Math.round(512*state.height/state.width));
        renderMeta=renderIcon(canvas,{...cloneArtState(state),width:w,height:h});
        if(!renderMeta?.geometry)throw new Error('图标模型尚未完成渲染。');
        renderedRevision=revision;renderError=null;q('.icon-render-error').hidden=true;
        q('.icon-render-status').textContent='画布已更新';q('.icon-render-status').dataset.error='false';
        q('.icon-canvas-wrap').style.aspectRatio=`${w} / ${h}`;
      }catch(error){renderError=error;q('.icon-render-error').hidden=false;q('.icon-render-error p').textContent=error.message||'请重新渲染。';q('.icon-render-status').textContent='渲染未完成';q('.icon-render-status').dataset.error='true';}
      syncSelection();syncButtons();
    },delay);
  }
  function change(label,updater,key='') {
    if(busy||destroyed)return;
    const next=cloneArtState(state);updater(next);state=normalizeIconState(next);
    history.record(state,label,key);if(!state.layers.some(layer=>layer.id===selected))selected=state.layers.at(-1)?.id||null;
    save();sync();scheduleRender();
  }
  function restore(direction) {
    if(busy||dragging)return;const result=history[direction]();if(!result)return;
    const previousSubject=state.subject,previousStyle=state.style;
    state=normalizeIconState(result.state);if(!state.layers.some(layer=>layer.id===selected))selected=state.layers.at(-1)?.id||null;
    save();sync();scheduleRender(20);
    const subjectCategory=ICON_SUBJECTS.find(item=>item.id===state.subject)?.category||'casino';
    if(state.subject!==previousSubject&&category!=='all'&&category!==subjectCategory){category=subjectCategory;renderSubjectButtons();}
    else if(state.style!==previousStyle)queueThumbnails();
    toast(`${direction==='undo'?'已撤回':'已重做'}：${result.label}`);
  }
  function setStep(number) {
    activeStep=number;for(const button of qa('.icon-flow [data-step]')){if(Number(button.dataset.step)===number)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
    const section=q(`[data-section="${number}"]`),parent=number===4?q('.icon-content'):q('.icon-controls');
    const top=section.getBoundingClientRect().top-parent.getBoundingClientRect().top+parent.scrollTop;
    if(matchMedia('(min-width:901px)').matches)parent.scrollTo({top:Math.max(0,top-8),behavior:'smooth'});else section.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function selectLayer(id) { selected=id;syncLayers(); }
  function removeLayer(id) {
    const layer=state.layers.find(item=>item.id===id);if(!layer)return;
    change(`删除${nameOf(layer.kind)}`,next=>{next.layers=next.layers.filter(item=>item.id!==id);});
  }
  function chooseSubject(id) {
    change(`更换主体：${nameOf(id)}`,next=>{
      next.subject=id;const main=next.layers.find(layer=>layer.role==='main');
      if(main){main.kind=id;main.hidden=false;selected=main.id;}
      else{if(next.layers.length>=12){toast('图层已满，请先删除一个图层。');return;}next.layers.unshift({id:'main',kind:id,role:'main',x:0,y:0,scale:1,rotation:-8,hidden:false});selected='main';}
    });
  }
  function layerId() { return `icon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
  function addAccessory(kind) {
    if(state.layers.length>=12){toast('最多可以保留 12 个图层。');return;}
    const spots=[[.29,-.24],[-.29,.23],[.28,.26],[-.28,-.25],[.03,-.33],[.02,.33]],spot=spots[state.layers.filter(layer=>layer.role==='decoration').length%spots.length],id=layerId();
    change(`添加${nameOf(kind)}`,next=>{next.layers.push({id,kind,role:'decoration',x:spot[0],y:spot[1],scale:kind==='ring'?.65:kind==='laurel'?.65:.25,rotation:kind==='sparkle'?0:-12,hidden:false});selected=id;});
  }
  function renderSubjectButtons() {
    q('.icon-subjects').innerHTML=ICON_SUBJECTS.filter(item=>category==='all'||item.category===category).map(item=>`<button class="icon-subject" type="button" data-subject="${item.id}" aria-pressed="${state.subject===item.id}" title="${escapeHTML(item.note)}"><span><canvas width="128" height="128" data-subject-thumb="${item.id}" aria-hidden="true"></canvas></span><strong>${item.name}</strong></button>`).join('');
    for(const button of qa('[data-category]'))button.setAttribute('aria-pressed',String(button.dataset.category===category));queueThumbnails();
  }
  function queueThumbnails() {
    clearTimeout(thumbTimer);const epoch=++thumbEpoch,style=state.style;
    const items=[...qa('[data-subject-thumb]'),...qa('[data-accessory-thumb]')];let index=0;
    const next=()=>{if(destroyed||epoch!==thumbEpoch)return;if(busy||dragging||renderedRevision!==revision){thumbTimer=setTimeout(next,150);return;}
      const node=items[index++];if(!node)return;
      const kind=node.dataset.subjectThumb||node.dataset.accessoryThumb,key=`${kind}/${style}`;
      if(node.dataset.rendered!==key){try{renderIconThumbnail(node,kind,style,node.dataset.subjectThumb?128:96);node.dataset.rendered=key;node.parentElement.classList.remove('icon-thumb-error');}catch{node.parentElement.classList.add('icon-thumb-error');}}
      thumbTimer=setTimeout(next,30);
    };thumbTimer=setTimeout(next,180);
  }
  function download(blob,name) {
    if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);
    const panel=q('.icon-download-ready');panel.replaceChildren();const span=doc.createElement('span');span.textContent='文件已准备好：';const a=doc.createElement('a');a.href=downloadURL;a.download=name;a.textContent=name;panel.append(span,a);panel.hidden=false;a.click();
  }
  async function exportArtwork(action) {
    if(!ready())return;busy=true;syncButtons();q('.icon-render-status').textContent='正在准备导出…';root.setAttribute('aria-busy','true');
    const snapshot=cloneArtState(state);try{
      await pause();const output=doc.createElement('canvas'),meta=renderIcon(output,snapshot);if(!meta?.geometry)throw new Error('图标尚未完成渲染。');
      const blob=await png(output),asset={blob,name:`UIStudio-${snapshot.subject}-${snapshot.style}-${snapshot.width}x${snapshot.height}.png`,type:'icon',width:snapshot.width,height:snapshot.height,meta:{...meta,project:snapshot}};
      if(action==='png'){download(blob,asset.name);toast(snapshot.transparent?'透明图标已准备好。':'图标已准备好。');}
      else if(action==='asset'){await options.onAsset?.(asset);toast('图标已加入我的作品。');}
      else if(action==='splitter'){await options.onSendToSplitter?.(asset);}
    }catch(error){toast(error.message||'导出失败，请重试。',true);}
    finally{busy=false;root.removeAttribute('aria-busy');q('.icon-render-status').textContent=renderError?'渲染未完成':'画布已更新';sync();}
  }
  async function setReference(reference) {
    const blob=reference?.blob;if(!(blob instanceof Blob))throw new Error('请选择一张图片作为对照。');
    if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>20*1024*1024)throw new Error('对照图请使用 20 MB 以内的 PNG、JPG 或 WebP。');
    const image=await createImageBitmap(blob);const tooLarge=image.width*image.height>70000000;image.close();if(tooLarge)throw new Error('对照图分辨率过大，请缩小后上传。');
    if(destroyed)return;if(referenceURL)URL.revokeObjectURL(referenceURL);referenceURL=URL.createObjectURL(blob);referenceName=String(reference.name||'图标风格参考图').slice(0,180);
    q('.icon-reference-card').hidden=false;q('.icon-reference-card img').src=referenceURL;q('.icon-reference-dialog img').src=referenceURL;q('.icon-reference-name').textContent=referenceName;toast('对照图已添加，可在预览区下方放大查看。');
  }
  const actions={
    undo:()=>restore('undo'),redo:()=>restore('redo'),delete:()=>selected&&removeLayer(selected),
    duplicate:()=>{const layer=currentLayer();if(!layer||state.layers.length>=12)return;const id=layerId();change(`复制${nameOf(layer.kind)}`,next=>{next.layers.push({...cloneArtState(layer),id,role:'decoration',x:clamp(layer.x+.06,-.5,.5),y:clamp(layer.y+.06,-.5,.5)});selected=id;});},
    back:()=>change('图层后移',next=>{const i=next.layers.findIndex(layer=>layer.id===selected);if(i>0)[next.layers[i-1],next.layers[i]]=[next.layers[i],next.layers[i-1]];}),
    front:()=>change('图层前移',next=>{const i=next.layers.findIndex(layer=>layer.id===selected);if(i>=0&&i<next.layers.length-1)[next.layers[i],next.layers[i+1]]=[next.layers[i+1],next.layers[i]];}),
    center:()=>change('图层居中',next=>{const layer=next.layers.find(item=>item.id===selected);if(layer){layer.x=0;layer.y=0;}}),
    reset:()=>{change('重置图标',next=>{const size={width:next.width,height:next.height};Object.assign(next,cloneArtState(ICON_DEFAULTS),size);selected='main';});category=ICON_SUBJECTS.find(item=>item.id===state.subject)?.category||'casino';renderSubjectButtons();},
    'clear-decor':()=>change('清空装饰',next=>{next.layers=next.layers.filter(layer=>layer.role==='main');}),
    retry:()=>scheduleRender(0),png:()=>exportArtwork('png'),asset:()=>exportArtwork('asset'),splitter:()=>exportArtwork('splitter'),
    reference:()=>q('.icon-reference-file').click(),
    'view-reference':()=>referenceURL&&q('.icon-reference-dialog').showModal(),
    'close-reference':()=>q('.icon-reference-dialog').close(),
    'remove-reference':()=>{if(referenceURL)URL.revokeObjectURL(referenceURL);referenceURL=null;referenceName='';q('.icon-reference-card').hidden=true;q('.icon-reference-card img').removeAttribute('src');q('.icon-reference-dialog img').removeAttribute('src');},
    'export-project':()=>{const project={app:'UI工作室',kind:'icon-project',version:1,state:cloneArtState(state)};download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`UIStudio-${state.subject}-project.json`);},
    'import-project':()=>q('.icon-project-file').click(),
  };
  on(root,'click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.action){if(busy&&!['view-reference','close-reference'].includes(button.dataset.action))return;actions[button.dataset.action]?.();}
    else if(button.dataset.step)setStep(Number(button.dataset.step));
    else if(button.dataset.category){category=button.dataset.category;renderSubjectButtons();}
    else if(button.dataset.subject)chooseSubject(button.dataset.subject);
    else if(button.dataset.style){change(`切换材质：${ICON_STYLES.find(item=>item.id===button.dataset.style)?.name}`,next=>{next.style=button.dataset.style;});queueThumbnails();}
    else if(button.dataset.accessory)addAccessory(button.dataset.accessory);
    else if(button.dataset.selectLayer)selectLayer(button.dataset.selectLayer);
    else if(button.dataset.deleteLayer)removeLayer(button.dataset.deleteLayer);
    else if(button.dataset.toggleLayer)change('切换图层显隐',next=>{const layer=next.layers.find(item=>item.id===button.dataset.toggleLayer);if(layer)layer.hidden=!layer.hidden;});
    else if(button.dataset.tone){stage.dataset.tone=button.dataset.tone;for(const item of qa('[data-tone]'))if(item.tagName==='BUTTON')item.setAttribute('aria-pressed',String(item===button));}
  });
  for(const input of qa('[data-setting]')){
    on(input,'input',()=>change(`调整${input.getAttribute('aria-label')}`,next=>{next[input.dataset.setting]=Number(input.value);},input.dataset.setting));
    on(input,'change',()=>history.endGroup());
  }
  for(const input of qa('[data-transform]')){
    on(input,'input',()=>{const id=selected,key=input.dataset.transform;change(`调整${input.getAttribute('aria-label')}`,next=>{const layer=next.layers.find(item=>item.id===id);if(layer)layer[key]=key==='rotation'?Number(input.value):Number(input.value)/100;},`${id}-${key}`);});
    on(input,'change',()=>history.endGroup());
  }
  on(q('.icon-size'),'change',event=>change('调整导出尺寸',next=>{const dimensions=event.target.value.split('x').map(Number);next.width=dimensions[0];next.height=dimensions[1]||dimensions[0];}));
  on(q('.icon-transparent'),'change',event=>change('调整透明背景',next=>{next.transparent=event.target.checked;}));
  on(q('.icon-background input'),'input',event=>change('调整背景色',next=>{next.background=event.target.value;},'background'));
  on(q('.icon-background input'),'change',()=>history.endGroup());
  on(q('.icon-reference-file'),'change',async event=>{const file=event.target.files?.[0];if(file)try{await setReference({blob:file,name:file.name});}catch(error){toast(error.message,true);}finally{event.target.value='';}});
  on(q('.icon-project-file'),'change',async event=>{const file=event.target.files?.[0];if(!file)return;try{
    if(file.size>2*1024*1024)throw new Error('项目文件请小于 2 MB。');const project=JSON.parse(await file.text());
    if(project.kind!=='icon-project'||project.version!==1||!Array.isArray(project.state?.layers))throw new Error('请选择从 Icon 工作台导出的项目 JSON。');
    const imported=normalizeIconState(project.state);change('导入图标项目',next=>{Object.keys(next).forEach(key=>delete next[key]);Object.assign(next,imported);selected=imported.layers.find(layer=>layer.role==='main')?.id||imported.layers.at(-1)?.id||null;});
    category=ICON_SUBJECTS.find(item=>item.id===state.subject)?.category||'casino';renderSubjectButtons();toast('项目已恢复，所有图层可继续编辑。');
  }catch(error){toast(error instanceof SyntaxError?'项目 JSON 格式不正确。':error.message,true);}finally{event.target.value='';}});
  on(canvas,'pointerdown',event=>{
    if(busy||renderError||renderedRevision!==revision||event.button!==0)return;
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*canvas.width,y=(event.clientY-rect.top)/rect.height*canvas.height;
    const hit=[...(renderMeta?.hitRegions||[])].reverse().find(item=>{const b=item.bounds;return x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height;});
    selectLayer(hit?.id||null);if(!hit)return;const layer=currentLayer();if(!layer||layer.hidden)return;
    canvas.focus({preventScroll:true});event.preventDefault();canvas.setPointerCapture(event.pointerId);
    dragging={id:layer.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:layer.x,y:layer.y,before:cloneArtState(state),width:rect.width,height:rect.height,moved:false};
    canvas.classList.add('dragging');
  });
  on(canvas,'pointermove',event=>{
    if(!dragging||event.pointerId!==dragging.pointerId)return;const layer=currentLayer();if(!layer)return;
    const dx=(event.clientX-dragging.startX)/dragging.width,dy=(event.clientY-dragging.startY)/dragging.height;
    if(Math.abs(dx)+Math.abs(dy)<.004&&!dragging.moved)return;dragging.moved=true;
    layer.x=clamp(dragging.x+dx,-.5,.5);layer.y=clamp(dragging.y+dy,-.5,.5);syncInspector();scheduleRender(65);
  });
  const endDrag=cancel=>{
    if(!dragging)return;const previous=dragging;dragging=null;canvas.classList.remove('dragging');
    if(cancel){state=previous.before;sync();scheduleRender(10);return;}
    if(previous.moved){state=normalizeIconState(state);history.record(state,`移动${nameOf(currentLayer()?.kind)}`);history.endGroup();save();sync();scheduleRender(0);}
  };
  on(canvas,'pointerup',()=>endDrag(false));on(canvas,'pointercancel',()=>endDrag(true));on(canvas,'lostpointercapture',()=>endDrag(false));
  on(doc,'keydown',event=>{
    if(destroyed||container.hidden||root.closest('[hidden]')||busy)return;
    const target=event.target;if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"],dialog'))return;
    const command=event.ctrlKey||event.metaKey;
    if(command&&event.key.toLowerCase()==='z'){event.preventDefault();restore(event.shiftKey?'redo':'undo');return;}
    if(command&&event.key.toLowerCase()==='y'){event.preventDefault();restore('redo');return;}
    if(event.key==='Escape'){selected=null;syncLayers();return;}
    if((event.key==='Delete'||event.key==='Backspace')&&selected){event.preventDefault();removeLayer(selected);return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selected){event.preventDefault();const delta=event.shiftKey?.025:.005;
      change('微调图层位置',next=>{const layer=next.layers.find(item=>item.id===selected);if(!layer)return;if(event.key==='ArrowLeft')layer.x=clamp(layer.x-delta,-.5,.5);if(event.key==='ArrowRight')layer.x=clamp(layer.x+delta,-.5,.5);if(event.key==='ArrowUp')layer.y=clamp(layer.y-delta,-.5,.5);if(event.key==='ArrowDown')layer.y=clamp(layer.y+delta,-.5,.5);},'keyboard-position');}
  });
  on(doc,'keyup',event=>{if(event.key.startsWith('Arrow'))history.endGroup();});
  category=ICON_SUBJECTS.find(item=>item.id===state.subject)?.category||'casino';
  renderSubjectButtons();sync();scheduleRender(20);
  return {
    getSettings:()=>cloneArtState(state),
    setReference,
    applySettings:(input,label='应用样例')=>{
      const next=normalizeIconState(input);change(label,current=>{Object.keys(current).forEach(key=>delete current[key]);Object.assign(current,next);selected=next.layers.find(layer=>layer.role==='main')?.id||next.layers.at(-1)?.id||null;});
      category=ICON_SUBJECTS.find(item=>item.id===state.subject)?.category||'casino';renderSubjectButtons();
    },
    refresh:()=>{sync();if(renderedRevision!==revision)scheduleRender(20);},
    destroy:()=>{destroyed=true;abort.abort();clearTimeout(renderTimer);clearTimeout(thumbTimer);clearTimeout(toastTimer);if(referenceURL)URL.revokeObjectURL(referenceURL);if(downloadURL)URL.revokeObjectURL(downloadURL);q('.icon-reference-dialog').close();root.remove();},
  };
}
