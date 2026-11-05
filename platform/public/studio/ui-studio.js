import {mountDemandUI} from './ui-demand.js';
import { getDesignSystem, exportTokenManifest } from './design-system.js';
import { defaultPageConfig, createPageModel, renderSVG, renderHTML, modelToPng, loadProjectFonts } from './ui-renderer.js';
import { FIGMA_PAGE_META, FIGMA_PAGE_DEFAULTS, loadFigmaPage, renderFigmaHTML } from './figma-page.js';
import { zipArchive } from '../splitter/export.js';
import { MAIN_FIGMA_PAGE_META, MAIN_FIGMA_PAGE_DEFAULTS, loadMainFigmaPage, renderMainFigmaHTML } from './figma-main-page.js';
import { createArtHistory } from './art-history.js';
import { mountUIComposer } from './ui-compose.js';

const DRAFT_KEY = 'layerlab.ui-studio.v1';
const ICONS = {
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 17 5-5 4 4 4-6 5 7"/><circle cx="8" cy="8" r="1"/>',
};
const svgIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.image}</svg>`;
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const safeName = value => String(value || 'megwin-ui').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 90);
const imagePattern = /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i;

function readDraft() {
  try {
    const data = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (data && ['sports', 'promotions', 'vip', 'welcome'].includes(data.template)) {
      const defaults = defaultPageConfig(data.template, data.language === 'en' ? 'en' : 'es');
      return { ...defaults, ...data, title: String(data.title || defaults.title).slice(0, 120), subtitle: String(data.subtitle || '').slice(0, 220), buttonLabel: String(data.buttonLabel || defaults.buttonLabel).slice(0, 40), brand: String(data.brand || 'MEGWIN').slice(0, 24), cards: Array.isArray(data.cards) ? data.cards.slice(0, 6).map(c => ({ title: String(c.title || '').slice(0, 80), subtitle: String(c.subtitle || '').slice(0, 140), tag: String(c.tag || '').slice(0, 24) })) : defaults.cards, heroImage: '', stepImage: '', projectArtworkApplied: false };
    }
  } catch {}
  return defaultPageConfig();
}
async function readImage(file) {
  if (!file || file.size > 12 * 1024 * 1024) throw new Error('请选择不超过 12 MB 的图片。');
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(file.type)) throw new Error('支持 PNG、JPG、WebP 和 AVIF 图片。');
  let image, objectUrl;
  try {
    if (typeof createImageBitmap === 'function') image = await createImageBitmap(file, { imageOrientation: 'from-image' });
    else { objectUrl = URL.createObjectURL(file); image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('图片无法读取。')); img.src = objectUrl; }); }
    const w = image.width || image.naturalWidth, h = image.height || image.naturalHeight;
    if (!w || !h) throw new Error('图片尺寸无效。');
    const scale = Math.min(1, 1800 / Math.max(w, h), Math.sqrt(2400000 / (w * h)));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), name: file.name, width: canvas.width, height: canvas.height, originalWidth: w, originalHeight: h };
  } finally { image?.close?.(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
}

/**
 * mountUIStudio(container, {toast,onAsset,onSendToSplitter,requestAI,getServiceStatus})
 * Asset callbacks receive {blob,name,width,height,type:'ui-page',mimeType:'image/png'}.
 * requestAI receives a UI-layout brief; returns {config?,imageDataUrl?,message?}.
 * Return value: {refresh,destroy,getConfig,generate}; all imports are local.
 */
function mountFreeUIStudio(container, options = {}) {
  let config = readDraft(), device = config.device === 'mobile' ? 'mobile' : 'desktop';
  let reference = null, view = 'preview', busy = false, debounce = null, destroyed = false;
  let lastGenerated = null, generatedAt = null, readyDownloadUrl = null;
  container.classList.add('ui-root');
  container.innerHTML = `<div class="ui-heading"><div><span class="ui-eyebrow">FREE LAYOUT STUDIO</span><h2>自由组合，探索下一张界面</h2><p>这些是可自定义的通用模板，不是 Figma 原稿。颜色、文案和素材由你自由调整。</p></div><div class="ui-heading-status"><span class="ui-token-status"></span><span class="ui-generation-kind">自由模板 · 非 Figma 原稿</span></div></div>
  <div class="ui-workspace"><aside class="ui-editor"><section class="ui-editor-section"><div class="ui-section-title"><span>01</span><h3>页面起点</h3></div><div class="ui-template-list">
  <button type="button" class="ui-template" data-template="sports"><span class="ui-template-mini ui-mini-sports"><i></i><b></b><em></em></span><span><strong>体育首页</strong><small>导航 / Banner / 赛事卡片</small></span></button>
  <button type="button" class="ui-template" data-template="promotions"><span class="ui-template-mini ui-mini-promo"><i></i><b></b><em></em></span><span><strong>活动中心</strong><small>主视觉 / 分类 / 活动列表</small></span></button>
  <button type="button" class="ui-template" data-template="vip"><span class="ui-template-mini ui-mini-vip"><i></i><b></b><em></em></span><span><strong>VIP 权益页</strong><small>品牌主视觉 / 权益 / 说明</small></span></button>
  <button type="button" class="ui-template" data-template="welcome"><span class="ui-template-mini ui-mini-welcome"><i></i><b></b><em></em></span><span><strong>新客活动</strong><small>自由布局 / 三步骤 / 奖励</small></span></button></div>
  <div class="ui-two-fields"><label>页面语言<select class="ui-language"><option value="es">Español · 西语</option><option value="en">English · 英语</option></select></label><label>品牌名称<input class="ui-brand" maxlength="24"></label></div></section>
  <section class="ui-editor-section"><div class="ui-section-title"><span>02</span><h3>内容与组件</h3></div><label class="ui-field">主标题<textarea class="ui-title" maxlength="120" rows="2"></textarea></label><label class="ui-field">副标题<textarea class="ui-subtitle" maxlength="220" rows="2"></textarea></label><label class="ui-field">按钮文字<input class="ui-button-label" maxlength="40"></label><div class="ui-section-switches"><label><input type="checkbox" data-section="hero">主视觉</label><label><input type="checkbox" data-section="cards">内容卡片</label><label><input type="checkbox" data-section="supporting">推荐模块</label><label><input type="checkbox" data-section="footer">页脚</label></div>
  <details class="ui-cards-editor"><summary>编辑内容卡片 <span class="ui-card-count"></span></summary><div class="ui-card-fields"></div><button type="button" class="ui-add-card">＋ 添加卡片</button></details></section>
  <section class="ui-editor-section"><div class="ui-section-title"><span>03</span><h3>参考与主视觉</h3></div><div class="ui-asset-upload"><button type="button" class="ui-reference-upload">${svgIcon('image')}<span>上传页面参考<small>仅作视觉对照</small></span></button><button type="button" class="ui-hero-upload">${svgIcon('image')}<span>上传 Banner 图片<small>直接应用到主视觉</small></span></button></div><button type="button" class="ui-project-artwork">使用项目主视觉</button><p class="ui-project-source">Megwin 活动主视觉与 Free Spins 步骤素材 · <a href="https://www.figma.com/design/2EBmHXzEU62LfXXaE1CEza/Megwin?node-id=10002-56609" target="_blank" rel="noopener noreferrer">Figma 来源 ↗</a></p><input class="ui-reference-file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden><input class="ui-hero-file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden><div class="ui-uploaded-assets"></div><p class="ui-note">支持 PNG / JPG / WebP / AVIF，单张 ≤12 MB。参考图用于对照；模板生成不会自动还原原图的组件结构。</p></section>
  <section class="ui-editor-section ui-ai-section"><label class="ui-field">AI 辅助要求 <span>可选</span><textarea class="ui-ai-prompt" rows="2" maxlength="1500" placeholder="例如：保持我的颜色变量，缩短西语标题，让活动卡片更紧凑"></textarea></label><button type="button" class="ui-ai-button">${svgIcon('sparkles')}<span>AI 优化内容</span></button><small class="ui-ai-status"></small></section>
  <div class="ui-editor-bottom"><button type="button" class="ui-generate">${svgIcon('sparkles')}<span>生成页面</span>${svgIcon('arrow')}</button><p>生成使用当前模板与已绑定的设计变量</p></div></aside>
  <section class="ui-preview-panel"><div class="ui-preview-toolbar"><div class="ui-view-tabs"><button type="button" data-view="preview">界面预览</button><button type="button" data-view="compare">参考对照</button></div><div class="ui-device-switch"><button type="button" data-device="desktop" aria-label="桌面 1440 像素">${svgIcon('monitor')}<span>桌面</span></button><button type="button" data-device="mobile" aria-label="移动端 390 像素">${svgIcon('phone')}<span>移动端</span></button></div></div>
  <div class="ui-preview-meta"><span class="ui-preview-dimensions"></span><span class="ui-live-dot">变量实时绑定</span></div><div class="ui-preview-area"><div class="ui-page-preview"><iframe class="ui-page-frame" title="生成的 UI 页面预览" sandbox="" referrerpolicy="no-referrer"></iframe></div><div class="ui-reference-preview" hidden><div class="ui-reference-empty">${svgIcon('image')}<strong>把原来的设计放在旁边</strong><p>上传一张页面截图，便于比较布局、色彩与密度。</p><button type="button" class="ui-pick-reference">上传参考图</button></div><img class="ui-reference-image" alt="上传的页面参考" hidden><span class="ui-reference-label" hidden>参考图片</span></div></div>
  <div class="ui-preview-footer"><span class="ui-preview-state">准备就绪</span><button type="button" class="ui-reset-content">恢复本模板内容</button></div>
  <div class="ui-export-bar"><div><strong>把设计带到下一步</strong><span>HTML 自适应页面 · SVG 可编辑文字和几何 · PNG 视觉稿</span></div><div class="ui-export-actions"><button type="button" data-export="html">HTML</button><button type="button" data-export="svg">SVG</button><button type="button" data-export="png">PNG</button><button type="button" data-export="json">变量清单</button></div></div><div class="ui-download-ready" hidden><span>文件已准备好，点击保存</span><a class="ui-ready-link" download></a></div><div class="ui-transfer-actions"><button type="button" class="ui-save-asset">保存到素材库</button><button type="button" class="ui-send-splitter">发送到图层拆分 ${svgIcon('arrow')}</button></div></section></div>`;
  const q = selector => container.querySelector(selector), qa = selector => [...container.querySelectorAll(selector)];
  const toast = message => options.toast?.(message);
  const prepareDownload = (blob, name) => {
    if (readyDownloadUrl) URL.revokeObjectURL(readyDownloadUrl);
    readyDownloadUrl = URL.createObjectURL(blob);
    const link = q('.ui-ready-link'); link.href = readyDownloadUrl; link.download = name; link.textContent = `保存 ${name}`;
    q('.ui-download-ready').hidden = false;
    link.click();
  };
  const persist = () => { try { const { heroImage, stepImage, ...draft } = config; localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, device })); } catch {} };

  function sourceStatus() {
    const ds = getDesignSystem();
    q('.ui-token-status').textContent = ds.source?.kind === 'figma-file-audit' ? `${ds.source.modeName} 变量快照 · ${ds.source.variableCount} 项` : ds.status === 'reference' ? '初始活动参考值 · 未应用完整快照' : ds.status === 'sample' ? '示例变量 · 尚未同步 Figma' : ds.status === 'figma' || ds.source?.figmaSynced ? (ds.source.syncStatus === 'stale' ? 'Figma 变量 · 上次同步失败' : 'Figma 变量快照 · 已同步') : '导入变量 · 手动绑定';
    q('.ui-token-status').title = ds.source?.note || (ds.sync?.status === 'failed' ? ds.sync.message : '');
    q('.ui-token-status').dataset.kind = ds.status;
    const status = options.getServiceStatus?.() || {};
    q('.ui-ai-status').textContent = status.uiReady ? 'AI 服务已就绪 · 按当前设计变量优化' : 'AI 服务尚未配置，模板生成可直接使用';
    q('.ui-ai-button').classList.toggle('ui-ai-unavailable', !status.uiReady);
    return ds;
  }
  function renderCards() {
    q('.ui-card-fields').replaceChildren(); q('.ui-card-count').textContent = `${config.cards.length} / 6`;
    config.cards.forEach((card, index) => {
      const wrap = el('div', 'ui-card-field'), head = el('div', 'ui-card-field-head'), heading = el('strong', '', `卡片 ${String(index + 1).padStart(2, '0')}`), remove = el('button', '', '删除');
      remove.type = 'button'; remove.setAttribute('aria-label', `删除卡片 ${index + 1}`); remove.onclick = () => { config.cards.splice(index, 1); renderCards(); scheduleGenerate(); }; head.append(heading, remove); wrap.append(head);
      for (const [key, placeholder, max] of [['title', '卡片标题 / 对阵双方', 80], ['subtitle', '描述 / 联赛与时间', 140], ['tag', '标签', 24]]) {
        const input = el('input', ''); input.value = card[key] || ''; input.placeholder = placeholder; input.maxLength = max; input.setAttribute('aria-label', `卡片 ${index + 1} ${placeholder}`); input.oninput = () => { config.cards[index][key] = input.value; scheduleGenerate(); }; wrap.append(input);
      }
      q('.ui-card-fields').append(wrap);
    }); q('.ui-add-card').disabled = config.cards.length >= 6;
  }
  function refreshFields() {
    qa('[data-template]').forEach(button => { button.classList.toggle('active', button.dataset.template === config.template); button.setAttribute('aria-pressed', String(button.dataset.template === config.template)); });
    q('.ui-language').value = config.language; q('.ui-brand').value = config.brand; q('.ui-title').value = config.title; q('.ui-subtitle').value = config.subtitle; q('.ui-button-label').value = config.buttonLabel;
    qa('[data-section]').forEach(input => input.checked = config.sections[input.dataset.section] !== false);
    renderCards(); sourceStatus(); refreshAssets();
  }
  function refreshAssets() {
    q('.ui-uploaded-assets').replaceChildren();
    for (const [kind, item] of [['reference', reference], ['hero', config.heroImage ? { name: config.projectArtworkApplied ? 'Megwin 活动主视觉 · Figma' : '主视觉图片', dataUrl: config.heroImage } : null], ['step', config.stepImage ? { name: 'Free Spins 步骤素材 · Figma', dataUrl: config.stepImage } : null]]) {
      if (!item) continue;
      const row = el('div', 'ui-uploaded-row'), img = el('img', ''), title = el('span', '', item.name), remove = el('button', '', '移除'); img.src = item.dataUrl; img.alt = kind === 'reference' ? '参考缩略图' : '主视觉缩略图'; remove.type = 'button';
      remove.onclick = () => { if (kind === 'reference') { reference = null; view = 'preview'; } else if (kind === 'step') config.stepImage = ''; else { config.heroImage = ''; config.projectArtworkApplied = false; } refreshAssets(); generate(false); }; row.append(img, title, remove); q('.ui-uploaded-assets').append(row);
    }
    q('.ui-reference-empty').hidden = !!reference; q('.ui-reference-image').hidden = !reference; q('.ui-reference-label').hidden = !reference;
    if (reference) q('.ui-reference-image').src = reference.dataUrl; else q('.ui-reference-image').removeAttribute('src');
  }
  function fitPreview() {
    if (!lastGenerated || destroyed) return;
    const wrapper = q('.ui-page-preview'), frame = q('.ui-page-frame'), rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0) return;
    const available = Math.max(220, rect.width - 2), scale = Math.min(1, available / lastGenerated.width);
    frame.style.width = `${lastGenerated.width}px`; frame.style.height = `${lastGenerated.height}px`; frame.style.transform = `scale(${scale})`;
    wrapper.style.height = `${lastGenerated.height * scale}px`;
  }
  function refreshViews() {
    qa('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-pressed', String(button.dataset.view === view)); });
    qa('[data-device]').forEach(button => { button.classList.toggle('active', button.dataset.device === device); button.setAttribute('aria-pressed', String(button.dataset.device === device)); });
    q('.ui-preview-area').classList.toggle('ui-compare', view === 'compare');
    q('.ui-preview-area').classList.toggle('ui-mobile-preview', device === 'mobile');
    q('.ui-reference-preview').hidden = view !== 'compare';
    requestAnimationFrame(fitPreview);
  }
  function generate(notify = true) {
    if (destroyed) return;
    clearTimeout(debounce); const ds = sourceStatus();
    lastGenerated = createPageModel(config, ds.values, device);
    q('.ui-page-frame').srcdoc = renderHTML(config, ds.values, { source: ds.source, bindings: ds.bindings });
    q('.ui-preview-dimensions').textContent = `${lastGenerated.width} × ${lastGenerated.height} px · ${device === 'mobile' ? '移动端' : '桌面端'}`;
    generatedAt = new Date(); q('.ui-preview-state').textContent = `已应用 ${Object.keys(ds.bindings || {}).filter(k => ds.bindings[k]).length} 个变量绑定 · ${config.cards.length} 张内容卡片`;
    persist(); refreshViews(); if (notify) toast('页面已生成，所有导出格式均使用当前内容与设计变量。');
  }
  function scheduleGenerate() { clearTimeout(debounce); q('.ui-preview-state').textContent = '正在更新预览…'; debounce = setTimeout(() => generate(false), 300); }
  function setBusy(value, label) {
    busy = value;
    qa('button').forEach(button => button.disabled = value);
    qa('input,textarea,select').forEach(input => input.disabled = value);
    if (!value) q('.ui-add-card').disabled = config.cards.length >= 6;
    q('.ui-ai-button span').textContent = value && label ? label : 'AI 优化内容';
    q('.ui-preview-panel').classList.toggle('ui-is-busy', value);
  }
  async function pngAsset() {
    await loadProjectFonts();
    const model = createPageModel(config, getDesignSystem().values, device), blob = await modelToPng(model);
    return { blob, name: `${safeName(config.brand)}-${config.template}-${device}.png`, width: model.width, height: model.height, type: 'ui-page', mimeType: 'image/png', source: { kind: 'ui-template', template: config.template, designSystem: getDesignSystem().source } };
  }
  async function exportFile(format) {
    if (busy) return;
    setBusy(true);
    try {
      await loadProjectFonts();
      const ds = getDesignSystem(), model = createPageModel(config, ds.values, device), base = `${safeName(config.brand)}-${config.template}-${device}`;
      if (format === 'html') prepareDownload(new Blob([renderHTML(config, ds.values, { source: ds.source, bindings: ds.bindings })], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      else if (format === 'svg') prepareDownload(new Blob([renderSVG(model)], { type: 'image/svg+xml;charset=utf-8' }), `${base}.svg`);
      else if (format === 'png') { const asset = await pngAsset(); prepareDownload(asset.blob, asset.name); }
      else {
        const manifest = { ...JSON.parse(exportTokenManifest(ds)), page: { ...config, heroImage: config.heroImage ? '[embedded in HTML and SVG exports]' : '', stepImage: config.stepImage ? '[embedded in HTML and SVG exports]' : '' }, device, generatedAt: generatedAt?.toISOString(), note: 'Page layout uses the selected template. Uploaded reference is comparison-only unless sent to a configured AI service.' };
        prepareDownload(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json;charset=utf-8' }), `${base}-design-manifest.json`);
      }
      toast(format === 'svg' ? 'SVG 已准备好，可点击保存链接。文字和几何仍可编辑，主视觉保留为图片。' : `${format.toUpperCase()} 文件已准备好，可点击下方保存链接。`);
    } catch (error) { toast(`导出未完成：${error.message}`); } finally { setBusy(false); }
  }
  async function transfer(callback, label) {
    if (busy) return;
    if (!callback) { toast('此入口暂未连接，请先下载 PNG。'); return; }
    setBusy(true);
    try { const asset = await pngAsset(); await callback(asset); toast(label); } catch (error) { toast(`操作未完成：${error.message}`); } finally { setBusy(false); }
  }
  async function aiGenerate() {
    if (busy) return;
    const status = await options.getServiceStatus?.() || {};
    if (!options.requestAI || !status.uiReady) { sourceStatus(); toast('AI UI 服务尚未配置。现在可以使用模板与设计变量生成页面。'); return; }
    setBusy(true, '正在优化…');
    try {
      const ds = getDesignSystem();
      const result = await options.requestAI({ kind: 'ui-layout', prompt: q('.ui-ai-prompt').value.trim() || '在当前设计变量和组件结构内优化页面内容，保持简洁清晰。', template: config.template, language: config.language, device, currentConfig: { ...config, heroImage: undefined, stepImage: undefined }, designSystem: { values: ds.values, bindings: ds.bindings, source: ds.source }, referenceDataUrl: reference?.dataUrl, heroDataUrl: config.heroImage || undefined });
      let applied = false;
      if (result?.config && typeof result.config === 'object') {
        const next = result.config;
        for (const [key, max] of [['title', 120], ['subtitle', 220], ['buttonLabel', 40]]) if (typeof next[key] === 'string') { config[key] = next[key].slice(0, max); applied = true; }
        if (Array.isArray(next.cards) && next.cards.length) { config.cards = next.cards.slice(0, 6).map(card => ({ title: String(card.title || '').slice(0, 80), subtitle: String(card.subtitle || '').slice(0, 140), tag: String(card.tag || '').slice(0, 24) })); applied = true; }
        if (next.sections && typeof next.sections === 'object') for (const key of ['hero', 'cards', 'supporting', 'footer']) if (typeof next.sections[key] === 'boolean') config.sections[key] = next.sections[key];
      }
      if (imagePattern.test(result?.imageDataUrl || '')) { config.heroImage = result.imageDataUrl; config.projectArtworkApplied = false; applied = true; }
      if (!applied) throw new Error(result?.message || '服务没有返回可应用的界面内容。');
      refreshFields(); generate(false); q('.ui-generation-kind').textContent = '自由模板 · AI 辅助文案';
      toast(result?.message || 'AI 内容已应用；页面继续使用当前绑定的设计变量。');
    } catch (error) { toast(`AI 优化未完成：${error.message}`); } finally { setBusy(false); }
  }

  qa('[data-template]').forEach(button => button.onclick = () => { const { heroImage, stepImage, projectArtworkApplied } = config; config = { ...defaultPageConfig(button.dataset.template, config.language), heroImage, stepImage, projectArtworkApplied }; refreshFields(); q('.ui-generation-kind').textContent = '自由模板 · 非 Figma 原稿'; generate(false); });
  q('.ui-language').onchange = e => { const { heroImage, stepImage, projectArtworkApplied, brand } = config; config = { ...defaultPageConfig(config.template, e.target.value), heroImage, stepImage, projectArtworkApplied, brand }; refreshFields(); generate(false); };
  for (const [selector, key] of [['.ui-title', 'title'], ['.ui-subtitle', 'subtitle'], ['.ui-button-label', 'buttonLabel'], ['.ui-brand', 'brand']]) q(selector).oninput = e => { config[key] = e.target.value; scheduleGenerate(); };
  qa('[data-section]').forEach(input => input.onchange = () => { config.sections[input.dataset.section] = input.checked; generate(false); });
  q('.ui-add-card').onclick = () => { if (config.cards.length >= 6) return; config.cards.push({ title: config.language === 'en' ? 'A new experience' : 'Una nueva experiencia', subtitle: config.language === 'en' ? 'Make this space your own.' : 'Haz tuyo este espacio.', tag: String(config.cards.length + 1).padStart(2, '0') }); renderCards(); generate(false); };
  q('.ui-reference-upload').onclick = q('.ui-pick-reference').onclick = () => q('.ui-reference-file').click();
  q('.ui-hero-upload').onclick = () => q('.ui-hero-file').click();
  for (const kind of ['reference', 'hero']) q(`.ui-${kind}-file`).onchange = async event => { const file = event.target.files[0]; if (file) { try { const image = await readImage(file); if (kind === 'reference') { reference = image; view = 'compare'; } else { config.heroImage = image.dataUrl; config.projectArtworkApplied = false; } refreshAssets(); generate(false); toast(kind === 'reference' ? '参考图已放入对照区；未自动改写页面。' : '主视觉已更新。'); } catch (error) { toast(error.message); } } event.target.value = ''; };
  q('.ui-project-artwork').onclick = async () => {
    if (busy) return; setBusy(true);
    try {
      const pictures = await Promise.all(['welcome-reward.png', 'step-free-spins.png'].map(async filename => {
        const response = await fetch(`/studio/megwin-assets/${filename}`, { credentials: 'same-origin' }); if (!response.ok) throw new Error('项目素材暂时无法加载。');
        const blob = await response.blob(); if (blob.size > 12 * 1024 * 1024) throw new Error('项目素材超过大小限制。');
        return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('项目素材读取失败。')); reader.readAsDataURL(new Blob([blob], { type: 'image/png' })); });
      }));
      config.heroImage = pictures[0]; config.stepImage = pictures[1]; config.projectArtworkApplied = true; refreshAssets(); generate(false); toast('已应用来自 Megwin 活动文件的项目素材；步骤素材用于新客活动模板。');
    } catch (error) { toast(error.message); } finally { setBusy(false); }
  };
  qa('[data-view]').forEach(button => button.onclick = () => { view = button.dataset.view; refreshViews(); });
  qa('[data-device]').forEach(button => button.onclick = () => { device = button.dataset.device; generate(false); });
  qa('[data-export]').forEach(button => button.onclick = () => exportFile(button.dataset.export));
  q('.ui-generate').onclick = () => generate(); q('.ui-ai-button').onclick = aiGenerate;
  q('.ui-reset-content').onclick = () => { config = defaultPageConfig(config.template, config.language); refreshFields(); generate(false); toast('已恢复当前模板的示例内容。'); };
  q('.ui-save-asset').onclick = () => transfer(options.onAsset, 'UI 视觉稿已保存到素材库。');
  q('.ui-send-splitter').onclick = () => transfer(options.onSendToSplitter, 'UI 视觉稿已发送到图层拆分。');
  const onTokens = () => generate(false); window.addEventListener('layerlab:design-system', onTokens);
  const resize = new ResizeObserver(fitPreview); resize.observe(q('.ui-preview-area'));
  refreshFields(); generate(false);
  loadProjectFonts().then(() => { if (!destroyed) generate(false); }).catch(() => { if (!destroyed) q('.ui-preview-state').textContent = 'Poppins 尚未加载，暂用浏览器后备字体'; });
  return {
    refresh() { sourceStatus(); generate(false); }, generate, getConfig: () => ({ ...config, device }),
    destroy() { destroyed = true; clearTimeout(debounce); if (readyDownloadUrl) URL.revokeObjectURL(readyDownloadUrl); resize.disconnect(); window.removeEventListener('layerlab:design-system', onTokens); container.replaceChildren(); },
  };
}

const FIGMA_SOURCES = {
  main: { meta: MAIN_FIGMA_PAGE_META, defaults: MAIN_FIGMA_PAGE_DEFAULTS, load: loadMainFigmaPage, render: renderMainFigmaHTML, draftKey: 'ui-studio.figma-main-page.v1', title: 'Megwin · 主站体育首页', fileLabel: '主站文件', pageLabel: '登录后体育首页 / Web / Homepage', nodeId: '3607:898490', copyLabel: '主促销卡文案', copyNote: '编辑原稿中 Fortune Tiger 促销卡的三个真实文本节点。人物、老虎机与其他促销卡图片沿用原稿素材。', slug: 'Megwin-Figma-main-homepage', limits: { title: 32, subtitle: 80, buttonLabel: 20 } },
  activity: { meta: FIGMA_PAGE_META, defaults: FIGMA_PAGE_DEFAULTS, load: loadFigmaPage, render: renderFigmaHTML, draftKey: 'ui-studio.figma-page.v1', title: 'Megwin · 新客活动页面', fileLabel: '活动文件', pageLabel: '活动页面 / Homepage · 新客专属奖励', nodeId: '10002:56600', copyLabel: '主视觉文案', copyNote: '编辑原稿的三个文本节点，其余内容保持原稿结构。过长文案仍需检查原稿预留空间。', slug: 'Megwin-Figma-welcome', limits: { title: 80, subtitle: 260, buttonLabel: 40 } },
};
function readFigmaDraft(source) {
  const draft = { ...source.defaults, zoom: 'fit' };
  try {
    const saved = JSON.parse(localStorage.getItem(source.draftKey) || 'null');
    if (!saved || typeof saved !== 'object') return draft;
    for (const [key, length] of Object.entries(source.limits)) if (typeof saved[key] === 'string') draft[key] = saved[key].slice(0, length);
    draft.mode = saved.mode === 'light' ? 'light' : 'dark'; draft.zoom = saved.zoom === '100' ? '100' : 'fit';
  } catch {}
  return draft;
}

function mountFigmaUIStudio(container, options = {}, sourceId = 'main') {
  const source = FIGMA_SOURCES[sourceId] || FIGMA_SOURCES.main;
  const { meta: FIGMA_PAGE_META, defaults: FIGMA_PAGE_DEFAULTS, load: loadFigmaPage, render: renderFigmaHTML, draftKey: FIGMA_DRAFT_KEY } = source;
  let config = readFigmaDraft(source), manifest = null, readyDownloadUrl = null, debounce = null, destroyed = false, renderSequence = 0, busy = false, hasRendered = false, initialScrollPending = true;
  const documentState = () => ({ title: config.title, subtitle: config.subtitle, buttonLabel: config.buttonLabel, mode: config.mode });
  const history = createArtHistory(documentState(), { limit: 80 });
  container.classList.add('ui-root', 'ui-figma-studio');
  container.dataset.figmaSource = sourceId;
  container.innerHTML = `<div class="ui-heading"><div><span class="ui-eyebrow">FIGMA SOURCE PAGE</span><h2>${source.title}</h2><p>选择原稿 → 修改文案 → 检查整页 → 下载交付。主站与活动分别使用各自的 Figma 页面。</p></div><div class="ui-heading-status"><span class="ui-token-status" data-kind="figma">${source.fileLabel} · 原稿节点</span><span class="ui-generation-kind">桌面设计预览 · 非线上业务页面</span></div></div>
  <div class="ui-workspace"><aside class="ui-editor ui-figma-editor" aria-label="Figma 原稿编辑选项">
    <section class="ui-editor-section"><div class="ui-section-title"><span>01</span><h3>原稿来源</h3></div><div class="ui-figma-source"><strong>${source.title}</strong><span>${source.pageLabel}</span><code>${source.nodeId}</code><span>${FIGMA_PAGE_META.width} × ${FIGMA_PAGE_META.height} px · 桌面画面</span><a class="ui-figma-source-link" target="_blank" rel="noopener noreferrer">在 Figma 中查看原稿 ↗</a></div><p class="ui-note">本模式使用原稿布局与项目静态素材。其他页面不会通过通用模板推断成原稿。</p><button type="button" class="ui-figma-read-audit">查看组件与变量读取范围 ↗</button></section>
    <section class="ui-editor-section"><div class="ui-section-title"><span>02</span><h3>${source.copyLabel}</h3></div><label class="ui-field">主标题<textarea class="ui-figma-title" rows="2" maxlength="${source.limits.title}"></textarea></label><label class="ui-field">副标题<textarea class="ui-figma-subtitle" rows="4" maxlength="${source.limits.subtitle}"></textarea></label><label class="ui-field">按钮文字<input class="ui-figma-button-label" maxlength="${source.limits.buttonLabel}"></label><p class="ui-note">${source.copyNote}</p><button type="button" class="ui-figma-restore">恢复原稿文案</button></section>
    <section class="ui-editor-section"><div class="ui-section-title"><span>03</span><h3>变量模式</h3></div><div class="ui-figma-theme-options" role="group" aria-label="原稿变量模式"><button type="button" data-figma-theme="dark"><i></i><span><strong>Dark · 原稿模式</strong><small>已读取页面的实际配色</small></span></button><button type="button" data-figma-theme="light"><i></i><span><strong>Light · 变量预览</strong><small>应用已读取的浅色变量</small></span></button></div><p class="ui-note ui-figma-light-note">Light 用于查看真实浅色变量；静态图片、Logo 与部分图标仍是原稿素材，不表示已经读取对应的完整浅色页面。</p><p class="ui-note">这里使用原稿自身的变量快照；自由模板中的手动变量覆盖不会修改本页。</p></section>
    <section class="ui-editor-section ui-figma-format-note"><div class="ui-section-title"><span>04</span><h3>导出范围</h3></div><p>ZIP 页面包包含 index.html、studio 资源目录、来源清单和使用说明；每项图片与字体仅保存一份，解压后保留目录即可离线打开。完整 HTML 将全部素材内嵌为单文件，文件体积更大。</p><p>原稿模式暂不提供 PNG／SVG 整页导出；这两种格式可在「自由模板」中使用。</p><p>原稿仅有桌面尺寸；此处不自动推断移动端。按钮和赛事内容均为设计预览。</p></section>
  </aside><section class="ui-preview-panel ui-figma-preview-panel" aria-label="Figma 原稿完整页面预览">
    <div class="ui-preview-toolbar"><div class="ui-figma-preview-label">${svgIcon('monitor')}<span>原稿画布</span><strong>${FIGMA_PAGE_META.width} × ${FIGMA_PAGE_META.height}</strong></div><div class="ui-figma-history" role="group" aria-label="原稿编辑历史"><button type="button" class="ui-figma-undo" title="撤销 Ctrl/⌘ Z" disabled>↶ 撤销</button><button type="button" class="ui-figma-redo" title="重做 Ctrl/⌘ Shift Z" disabled>↷ 重做</button></div><label class="ui-figma-zoom-label">缩放<select class="ui-figma-zoom" aria-label="原稿预览缩放"><option value="fit">适应窗口</option><option value="100">100% · 原始尺寸</option></select></label></div>
    <div class="ui-preview-meta"><span class="ui-figma-preview-mode">Dark · 原稿模式</span><span class="ui-figma-asset-count">正在读取原稿资源…</span></div>
    <div class="ui-preview-area ui-figma-preview-area" tabindex="0" aria-label="原稿内容滚动区"><div class="ui-figma-loading" role="status">正在载入原稿页面…</div><div class="ui-page-preview ui-figma-page" hidden><iframe class="ui-page-frame ui-figma-frame" title="${source.title} Figma 原稿设计预览" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe></div></div>
    <div class="ui-preview-footer"><span class="ui-figma-preview-state" role="status">准备原稿资源</span><span>在内容区滚动查看整页</span></div>
    <div class="ui-export-bar"><div><strong>下载完整原稿页面</strong><span>ZIP · 独立资源目录 / HTML · 单文件内嵌</span></div><div class="ui-export-actions"><button type="button" class="ui-figma-export-zip">下载 ZIP</button><button type="button" class="ui-figma-export-html">下载完整 HTML</button><button type="button" class="ui-figma-export-manifest">来源清单</button></div></div>
    <div class="ui-download-ready ui-figma-download-ready" hidden><span class="ui-figma-download-note">文件已准备好，点击保存</span><a class="ui-ready-link ui-figma-ready-link" download></a></div>
  </section></div>`;
  const q = selector => container.querySelector(selector), toast = message => options.toast?.(message);
  const frame = q('.ui-figma-frame'), area = q('.ui-figma-preview-area'), wrapper = q('.ui-figma-page');
  q('.ui-figma-source-link').href = FIGMA_PAGE_META.sourceUrl;
  const persist = () => { try { localStorage.setItem(FIGMA_DRAFT_KEY, JSON.stringify(config)); } catch {} };
  const changedCopy = () => ['title', 'subtitle', 'buttonLabel'].some(k => config[k] !== FIGMA_PAGE_DEFAULTS[k]);

  function refreshFields() {
    q('.ui-figma-title').value = config.title; q('.ui-figma-subtitle').value = config.subtitle; q('.ui-figma-button-label').value = config.buttonLabel; q('.ui-figma-zoom').value = config.zoom;
    for (const button of container.querySelectorAll('[data-figma-theme]')) button.setAttribute('aria-pressed', String(button.dataset.figmaTheme === config.mode));
    q('.ui-figma-preview-mode').textContent = config.mode === 'light' ? 'Light · 真实变量预览，静态素材沿用原稿' : 'Dark · 原稿模式';
    q('.ui-figma-light-note').classList.toggle('ui-figma-light-active', config.mode === 'light');
    q('.ui-figma-undo').disabled = !history.canUndo; q('.ui-figma-redo').disabled = !history.canRedo;
    q('.ui-figma-undo').title = history.canUndo ? `撤销：${history.undoLabel} · Ctrl/⌘ Z` : '还没有可撤销的修改';
    q('.ui-figma-redo').title = history.canRedo ? `重做：${history.redoLabel} · Ctrl/⌘ Shift Z` : '还没有可重做的修改';
  }
  function fitPreview() {
    if (destroyed || !hasRendered || area.clientWidth <= 0) return;
    const padding = getComputedStyle(area), available = Math.max(220, area.clientWidth - parseFloat(padding.paddingLeft || 0) - parseFloat(padding.paddingRight || 0));
    const scale = config.zoom === '100' ? 1 : Math.min(1, available / FIGMA_PAGE_META.width);
    wrapper.style.width = `${FIGMA_PAGE_META.width * scale}px`; wrapper.style.height = `${FIGMA_PAGE_META.height * scale}px`;
    frame.style.width = `${FIGMA_PAGE_META.width}px`; frame.style.height = `${FIGMA_PAGE_META.height}px`; frame.style.transform = `scale(${scale})`;
  }
  async function generate(notify = false) {
    clearTimeout(debounce); const sequence = ++renderSequence;
    q('.ui-figma-preview-state').textContent = '正在更新原稿预览…'; refreshFields(); persist();
    try {
      const [html, page] = await Promise.all([renderFigmaHTML({ ...config, embedAssets: false }), loadFigmaPage()]);
      if (destroyed || sequence !== renderSequence) return;
      manifest = page.manifest; hasRendered = true; wrapper.hidden = false; q('.ui-figma-loading').hidden = true;
      frame.dataset.ready = 'false'; frame.srcdoc = html;
      q('.ui-figma-asset-count').textContent = `${manifest.regions?.length || 0} 个原稿区域 · ${manifest.assets?.length || 0} 项静态素材`;
      q('.ui-figma-preview-state').textContent = changedCopy() ? '基于原稿 · 文案已修改并自动保存' : '已载入原稿布局与静态素材';
      fitPreview(); if (notify) toast('原稿预览已更新。');
    } catch (error) {
      if (destroyed || sequence !== renderSequence) return;
      q('.ui-figma-preview-state').textContent = `原稿预览未更新：${error.message}`;
      if (!hasRendered) { q('.ui-figma-loading').textContent = `原稿资源暂时无法载入：${error.message}`; q('.ui-figma-loading').hidden = false; }
      toast(error.message);
    }
  }
  function onFrameLoad() { if (!destroyed && hasRendered) { frame.dataset.ready = 'true'; fitPreview(); if (initialScrollPending) { area.scrollTop = 0; area.scrollLeft = 0; initialScrollPending = false; } } }
  frame.addEventListener('load', onFrameLoad);
  function scheduleGenerate() { clearTimeout(debounce); persist(); q('.ui-figma-preview-state').textContent = '正在更新主视觉文案…'; debounce = setTimeout(() => generate(false), 260); }
  function prepareDownload(blob, filename) {
    if (readyDownloadUrl) URL.revokeObjectURL(readyDownloadUrl);
    readyDownloadUrl = URL.createObjectURL(blob); const link = q('.ui-figma-ready-link');
    link.href = readyDownloadUrl; link.download = filename; link.textContent = `保存 ${filename}`;
    q('.ui-figma-download-ready').hidden = false; q('.ui-figma-download-note').textContent = '文件已准备好；如果自动下载没有开始，请点击保存链接。'; link.click();
  }
  async function exportFile(kind) {
    if (busy) return; busy = true;
    for (const selector of ['.ui-figma-export-zip', '.ui-figma-export-html', '.ui-figma-export-manifest']) q(selector).disabled = true;
    const snapshot = { ...config };
    q('.ui-figma-preview-state').textContent = kind === 'html' || kind === 'zip' ? '正在打包原稿素材与字体…' : '正在整理来源清单…';
    try {
      const page = await loadFigmaPage();
      const sources = { ...page.manifest, studio: 'UI工作室', exportedAt: new Date().toISOString(), selectedMode: snapshot.mode, contentEdits: { title: snapshot.title, subtitle: snapshot.subtitle, buttonLabel: snapshot.buttonLabel }, designPreviewOnly: true };
      if (kind === 'html' || kind === 'zip') {
        const html = await renderFigmaHTML({ ...snapshot, embedAssets: kind === 'html' });
        if (destroyed) return;
        if (kind === 'zip') {
          const resources = [...new Map([...(page.manifest.assets || []), ...(page.manifest.fonts || [])].map(item => [item.path, item])).values()];
          const resourceEntries = new Array(resources.length); let cursor = 0, completed = 0;
          await Promise.all(Array.from({ length: Math.min(6, resources.length) }, async () => {
            while (cursor < resources.length) {
              const index = cursor++, item = resources[index];
              if (typeof item.path !== 'string' || !item.path.startsWith('/studio/') || item.path.split('/').includes('..')) throw new Error('原稿资源路径无效，无法生成离线页面包。');
              const response = await fetch(item.path, { credentials: 'same-origin' });
              if (!response.ok) throw new Error(`无法打包原稿素材：${item.path.split('/').pop()}`);
              const data = await response.blob();
              if (!data.size) throw new Error('原稿素材为空，已停止导出。');
              resourceEntries[index] = { name: item.path.slice(1), data }; completed++;
              if (!destroyed) q('.ui-figma-preview-state').textContent = `正在收集 ZIP 资源 ${completed} / ${resources.length}…`;
            }
          }));
          if (destroyed) return;
          q('.ui-figma-preview-state').textContent = '正在生成 ZIP 页面包…';
          const readme = `UI工作室 · ${source.title}原稿页面包\n\n使用方法\n1. 完整解压此 ZIP 文件。\n2. 保持 index.html 与 studio 文件夹在同一目录，不要单独移动 index.html。\n3. 用 Chrome、Edge、Safari 或其他浏览器打开 index.html，即可离线查看，无需本地服务器。\n4. 页面尺寸为 ${FIGMA_PAGE_META.width} × ${FIGMA_PAGE_META.height} px；可使用浏览器缩放查看整页。\n\n文件说明\n- index.html：完整页面结构、样式与文案，通过相对路径读取 studio 文件夹内的素材。\n- studio/：原稿 SVG／PNG，每项素材仅保存一次。\n- studio/fonts/：Poppins 字体与字体许可证。\n- sources.json：Figma 原稿节点、素材哈希、所选模式和本次文案修改的来源记录；原始资源路径去掉开头的 / 即为包内路径。\n- README.txt：本使用说明。\n\n原稿来源\n${FIGMA_PAGE_META.sourceUrl}\n\n当前模式：${snapshot.mode === 'light' ? 'Light · 真实变量预览；静态图片和部分图标沿用 Dark 原稿素材。' : 'Dark · 原稿模式。'}\n\n这是桌面设计预览，按钮、赛事和账户内容不连接任何线上业务。文字与 HTML 结构可继续编辑；修改后请检查文案换行及原稿预留空间。\n`;
          const archive = await zipArchive([{ name: 'index.html', data: html.replaceAll('/studio/', './studio/') }, { name: 'sources.json', data: JSON.stringify(sources, null, 2) }, { name: 'README.txt', data: readme }, ...resourceEntries, { name: 'studio/fonts/Poppins-OFL.txt', data: page.license }]);
          if (destroyed) return;
          prepareDownload(archive, `${source.slug}-${snapshot.mode}.zip`);
        } else prepareDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `${source.slug}-${snapshot.mode}.html`);
      } else {
        if (destroyed) return;
        prepareDownload(new Blob([JSON.stringify(sources, null, 2)], { type: 'application/json;charset=utf-8' }), `${source.slug}-${snapshot.mode}-sources.json`);
      }
      q('.ui-figma-preview-state').textContent = '导出文件已准备好'; toast(kind === 'zip' ? 'ZIP 页面包已准备好，解压后打开 index.html 即可查看。' : kind === 'html' ? '完整 HTML 已准备好，原稿素材与字体已内嵌。' : '原稿来源与素材清单已准备好。');
    } catch (error) { if (!destroyed) { q('.ui-figma-preview-state').textContent = '导出未完成，原稿预览已保留'; toast(`导出未完成：${error.message}`); } }
    finally { busy = false; if (!destroyed) for (const selector of ['.ui-figma-export-zip', '.ui-figma-export-html', '.ui-figma-export-manifest']) q(selector).disabled = false; }
  }
  function recordChange(label, mergeKey = '') { history.record(documentState(), label, mergeKey); refreshFields(); }
  function travel(direction) { const entry = history[direction](); if (!entry) return; config = { ...config, ...entry.state }; generate(false); toast(`${direction === 'undo' ? '已撤销' : '已重做'}：${entry.label}`); }
  q('.ui-figma-undo').onclick = () => travel('undo'); q('.ui-figma-redo').onclick = () => travel('redo');
  function onHistoryKey(event) {
    if (container.hidden || container.closest('.studio-view')?.hidden || event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo'); }
    else if (key === 'y' && !event.shiftKey) { event.preventDefault(); travel('redo'); }
  }
  window.addEventListener('keydown', onHistoryKey);
  for (const [selector, key, label] of [['.ui-figma-title', 'title', '主标题'], ['.ui-figma-subtitle', 'subtitle', '副标题'], ['.ui-figma-button-label', 'buttonLabel', '按钮文字']]) {
    q(selector).oninput = event => { config[key] = event.target.value; recordChange(`修改${label}`, key); scheduleGenerate(); };
    q(selector).onblur = () => history.endGroup();
  }
  for (const button of container.querySelectorAll('[data-figma-theme]')) button.onclick = () => { if (config.mode === button.dataset.figmaTheme) return; config.mode = button.dataset.figmaTheme; recordChange('切换变量模式'); generate(false); };
  q('.ui-figma-restore').onclick = () => { for (const key of ['title', 'subtitle', 'buttonLabel']) config[key] = FIGMA_PAGE_DEFAULTS[key]; recordChange('恢复原稿文案'); generate(false); toast('已恢复原稿文案，可点击撤销恢复编辑。'); };
  q('.ui-figma-zoom').onchange = e => { config.zoom = e.target.value === '100' ? '100' : 'fit'; persist(); fitPreview(); };
  q('.ui-figma-read-audit').onclick = () => { location.hash = 'system'; };
  q('.ui-figma-export-zip').onclick = () => exportFile('zip'); q('.ui-figma-export-html').onclick = () => exportFile('html'); q('.ui-figma-export-manifest').onclick = () => exportFile('json');
  const resize = new ResizeObserver(fitPreview); resize.observe(area);
  refreshFields(); const ready = generate(false);
  return { ready, refresh: fitPreview, generate, getConfig: () => ({ ...config, source: FIGMA_PAGE_META }), destroy() { destroyed = true; ++renderSequence; clearTimeout(debounce); resize.disconnect(); window.removeEventListener('keydown', onHistoryKey); frame.removeEventListener('load', onFrameLoad); if (readyDownloadUrl) URL.revokeObjectURL(readyDownloadUrl); container.replaceChildren(); } };
}

/** Source pages and free templates retain independent drafts while switching. */
export function mountUIStudio(container, options = {}) {
  container.classList.add('ui-root', 'ui-studio-mode-root');
  const labels={design:'需求生成',compose:'原稿区块',main:'主站原稿',activity:'活动原稿',free:'自由模板'};
  const modes=Object.keys(labels);
  const tabs=modes.map(id=>`<button type="button" id="ui-tab-${id}" data-ui-mode="${id}" role="tab" aria-controls="ui-panel-${id}" aria-selected="false" tabindex="-1">${labels[id]}</button>`).join('');
  const panels=modes.map(id=>`<section id="ui-panel-${id}" class="ui-studio-mode-host ui-${id}-host" role="tabpanel" aria-labelledby="ui-tab-${id}" hidden></section>`).join('');
  container.innerHTML = `<div class="ui-studio-mode-bar"><div class="ui-studio-mode-tabs" role="tablist" aria-label="UI 页面创作方式">${tabs}</div><span class="ui-studio-mode-help"></span></div>${panels}`;
  const instances = new Map(), q = selector => container.querySelector(selector); let mode = 'design', destroyed = false;
  function activate(next) {
    if (destroyed) return; mode = modes.includes(next) ? next : 'design';
    for (const id of modes) q(`.ui-${id}-host`).hidden = mode !== id;
    for (const button of container.querySelectorAll('[data-ui-mode]')) { const selected = button.dataset.uiMode === mode; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; }
    q('.ui-studio-mode-help').textContent = {design:'需求与参考图 → 真实组件和变量 → UI 页面',compose:'按需求选用 MEGWIN 原稿区块',main:'主站原稿 · 体育首页',activity:'活动原稿 · 新客奖励',free:'独立通用布局 · 自由创作'}[mode];
    if (!instances.has(mode)) instances.set(mode, mode === 'design' ? mountDemandUI(q('.ui-design-host'), options) : mode === 'compose' ? mountUIComposer(q('.ui-compose-host'), options) : mode === 'free' ? mountFreeUIStudio(q('.ui-free-host'), options) : mountFigmaUIStudio(q(`.ui-${mode}-host`), options, mode));
    else instances.get(mode).refresh?.();
  }
  for (const button of container.querySelectorAll('[data-ui-mode]')) {
    button.onclick = () => activate(button.dataset.uiMode);
    button.onkeydown = event => { if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const i = modes.indexOf(mode), next = event.key === 'Home' ? modes[0] : event.key === 'End' ? modes.at(-1) : modes[(i + (event.key === 'ArrowRight' ? 1 : modes.length-1)) % modes.length]; activate(next); q(`[data-ui-mode="${next}"]`).focus(); };
  }
  activate('design');
  return { selectWorkspace: activate, async addReference(file){activate('design');await instances.get('design').addReference(file);}, refresh() { instances.get(mode)?.refresh?.(); }, generate(...args) { return instances.get(mode)?.generate?.(...args); }, getConfig: () => ({ workspaceMode: mode, ...instances.get(mode)?.getConfig?.() }), destroy() { destroyed = true; for (const instance of instances.values()) instance.destroy(); instances.clear(); container.replaceChildren(); } };
}
