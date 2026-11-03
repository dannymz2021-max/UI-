/** Design-token import, explicit semantic binding, and local persistence. */
import { mountFigmaCatalog, resolveFigmaSnapshot } from './figma-catalog.js';
const STORAGE_KEY = 'layerlab.design-system.v1';
const MAX_STORAGE = 2 * 1024 * 1024;
export const MEGWIN_REFERENCE = {
  name: 'Megwin 参考规范 · 活动文件', compiledAt: '2026-11-02',
  frameId: '10002:56600',
  url: 'https://www.figma.com/design/2EBmHXzEU62LfXXaE1CEza/Megwin?node-id=10002-56600',
  note: '根据活动文件中已读取的颜色、字体与组件尺寸整理的代码参考，不是实时变量缓存。间距 12px 来自画面布局；描边采用 surface/3 的参考值。主站与活动文件的变量和组件目录均已读取；原稿页面分别在 UI 页面生成中展示。',
};
export const FIGMA_SOURCES = [
  { name: 'Megwin 主站设计', url: 'https://www.figma.com/design/ZFDvXEgggNZ49dZU7hmSLP/Megwin?node-id=0-1' },
  { name: 'Megwin 活动设计', url: 'https://www.figma.com/design/2EBmHXzEU62LfXXaE1CEza/Megwin?node-id=1113-422724' },
];
const SEMANTICS = [
  ['primary', '品牌主色', 'color'], ['background', '页面背景', 'color'],
  ['surface', '卡片表面', 'color'], ['text', '主要文字', 'color'],
  ['muted', '次要文字', 'color'], ['border', '分隔 / 描边', 'color'],
  ['radius', '组件圆角', 'dimension'], ['spacing', '基础间距', 'dimension'],
  ['fontFamily', '字体家族', 'fontFamily'],
];
const DEFAULTS = { primary: '#2dd4bf', background: '#0c0c0c', surface: '#1a1a1b', text: '#ededed', muted: '#9e9e9e', border: '#323437', radius: '12px', spacing: '12px', fontFamily: 'Poppins, Arial, sans-serif' };
const SAMPLE = {
  color: { brand: { $type: 'color', $value: DEFAULTS.primary }, background: { $type: 'color', $value: DEFAULTS.background }, surface: { $type: 'color', $value: DEFAULTS.surface }, text: { $type: 'color', $value: DEFAULTS.text }, muted: { $type: 'color', $value: DEFAULTS.muted }, border: { $type: 'color', $value: DEFAULTS.border } },
  component: { radius: { $type: 'dimension', $value: DEFAULTS.radius }, spacing: { $type: 'dimension', $value: DEFAULTS.spacing }, fontFamily: { $type: 'fontFamily', $value: DEFAULTS.fontFamily } },
};
const MEGWIN_EXACT_BINDINGS = {
  primary: 'color/brand/primary', background: 'color/background/default',
  surface: 'color/surface/1', text: 'color/text/primary', muted: 'color/text/tertiary',
  border: 'color/surface/3', radius: 'radius/md', fontFamily: 'Body/sm',
};
const safeName = name => String(name).replace(/[\u0000-\u001f]/g, '').slice(0, 240);
const typeOf = value => typeof value === 'number' ? 'number' : typeof value === 'string' && /^(#|rgba?\(|hsla?\(|oklch\()/i.test(value) ? 'color' : typeof value === 'string' && /^-?[\d.]+(?:px|rem|em|%)$/.test(value.trim()) ? 'dimension' : 'string';

function scalar(value, type) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) return type === 'fontFamily' ? value.map(v => String(v).replace(/[<>;{}]/g, '')).join(', ') : JSON.stringify(value);
    if ('r' in value && 'g' in value && 'b' in value) {
      const channels = ['r', 'g', 'b'].map(k => Math.max(0, Math.min(255, Math.round(Number(value[k]) * (Math.max(value.r, value.g, value.b) <= 1 ? 255 : 1)))));
      const alpha = typeof value.a === 'number' ? Math.max(0, Math.min(1, value.a)) : 1;
      return alpha < 1 ? `rgba(${channels.join(', ')}, ${alpha.toFixed(3)})` : '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('');
    }
    if (Array.isArray(value.components) && /^(srgb|rgb)$/i.test(value.colorSpace || '')) return scalar({ r: value.components[0], g: value.components[1], b: value.components[2], a: value.alpha }, 'color');
    if ('value' in value && 'unit' in value && typeof value.value === 'number') return `${value.value}${value.unit}`;
    return JSON.stringify(value);
  }
  return typeof value === 'number' || typeof value === 'boolean' ? value : String(value ?? '');
}

/** Parse W3C, Tokens Studio, flat maps, CSS custom properties, or Figma exports. */
export function parseTokens(input, format = 'json') {
  let raw = input, entries = [];
  if (format === 'css') {
    raw = String(input);
    const clean = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /--([\w-]+)\s*:\s*([^;{}]+)(?:;|(?=\}))/g;
    let match;
    while ((match = re.exec(clean))) entries.push({ name: `--${match[1]}`, type: typeOf(match[2].trim()), value: match[2].trim() });
  } else {
    raw = typeof input === 'string' ? JSON.parse(input) : input;
    if (!raw || typeof raw !== 'object') throw new Error('JSON 需要是变量对象或变量数组。');
    const walk = (node, path = [], inheritedType = '', depth = 0) => {
      if (depth > 24 || entries.length > 2000) throw new Error('变量层级或数量过多，最多支持 2,000 个变量。');
      if (node === null || node === undefined) return;
      if (typeof node !== 'object') {
        if (path.length) entries.push({ name: path.join('.'), type: inheritedType || typeOf(node), value: node });
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) {
          if (item && typeof item === 'object' && item.name) {
            if (item.valuesByMode) {
              const modes = Object.entries(item.valuesByMode);
              for (const [modeId, value] of modes) entries.push({ name: safeName(item.name) + (modes.length > 1 ? ` [${modeId}]` : ''), id: item.id, modeId, type: String(item.resolvedType || item.type || typeOf(value)).toLowerCase(), value });
            } else if ('value' in item || '$value' in item) entries.push({ name: safeName(item.name), id: item.id, type: item.$type || item.type || typeOf(item.$value ?? item.value), value: item.$value ?? item.value });
            else if (item.variables || item.collections || item.variableCollections) walk(item.variables || item.collections || item.variableCollections, path, inheritedType, depth + 1);
          } else walk(item, path, inheritedType, depth + 1);
        }
        return;
      }
      if ('$value' in node || ('value' in node && (node.type || node.name || Object.keys(node).length <= 3))) {
        entries.push({ name: node.name ? safeName(node.name) : path.join('.'), type: node.$type || node.type || inheritedType || typeOf(node.$value ?? node.value), value: node.$value ?? node.value });
        return;
      }
      if ('r' in node && 'g' in node && 'b' in node && path.length) { entries.push({ name: path.join('.'), type: 'color', value: node }); return; }
      if (node.valuesByMode && node.name) { walk([node], [], '', depth + 1); return; }
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$') || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        if (['variables', 'variableCollections', 'collections'].includes(key) && Array.isArray(value)) walk(value, path, '', depth + 1);
        else if (['meta', 'metadata', 'modes'].includes(key)) continue;
        else walk(value, [...path, safeName(key)], node.$type || inheritedType, depth + 1);
      }
    };
    // Figma export envelopes carry file/audit metadata alongside their variables.
    // Keep the envelope in rawTokens, but do not turn those metadata fields into tokens.
    walk(Array.isArray(raw.variables) ? raw.variables : raw);
  }
  entries = entries.filter(e => e.name && typeof e.name === 'string');
  if (!entries.length) throw new Error('没有找到变量。支持 W3C / Tokens Studio JSON、Figma 变量导出和 CSS 自定义属性。');
  if (entries.length > 2000) throw new Error('变量过多，请拆分后导入；每次最多 2,000 个。');
  const names = new Map();
  entries = entries.map(e => {
    const base = safeName(e.name), count = (names.get(base) || 0) + 1; names.set(base, count);
    return { ...e, name: count > 1 ? `${base} (${count})` : base, type: String(e.type || '').toLowerCase() };
  });
  const byName = new Map(entries.map(e => [e.name, e]));
  const find = (key, origin) => {
    const exact = byName.get(key) || entries.find(e => e.name.replaceAll('/', '.') === key || (e.id === key && (!origin.modeId || e.modeId === origin.modeId))) || entries.find(e => e.id === key);
    if (exact) return exact;
    // Tokens Studio aliases often omit the top-level set name. Resolve only
    // an unambiguous suffix, never silently choose between light/dark sets.
    const candidates = entries.filter(e => e.name.endsWith('.' + key));
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  const resolve = (token, stack = []) => {
    if (stack.length >= 32 || stack.includes(token.name)) throw new Error('循环别名');
    const chain = [...stack, token.name];
    let value = token.value;
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
      const target = find(value.id, token); if (!target) throw new Error(`找不到别名 ${value.id}`);
      return resolve(target, chain);
    }
    if (typeof value === 'string') {
      value = value.replace(/\{([^{}]+)\}/g, (_, key) => {
        const target = find(key, token); if (!target) throw new Error(`找不到别名 ${key}`); return scalar(resolve(target, chain), target.type);
      });
      value = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\)/g, (_, key, fallback) => {
        const target = find(key, token); if (!target) { if (fallback) return fallback.trim(); throw new Error(`找不到变量 ${key}`); } return scalar(resolve(target, chain), target.type);
      });
    }
    return scalar(value, token.type);
  };
  for (const token of entries) {
    try { token.resolvedValue = resolve(token); } catch (error) { token.error = error.message; token.resolvedValue = null; }
  }
  return { rawTokens: raw, tokens: entries };
}

function sampleSystem() {
  const parsed = parseTokens(SAMPLE);
  return { version: 1, status: 'reference', source: { ...MEGWIN_REFERENCE, kind: 'compiled-design-reference', figmaSynced: false }, ...parsed,
    bindings: { primary: 'color.brand', background: 'color.background', surface: 'color.surface', text: 'color.text', muted: 'color.muted', border: 'color.border', radius: 'component.radius', spacing: 'component.spacing', fontFamily: 'component.fontFamily' }, overrides: {}, values: { ...DEFAULTS }, updatedAt: new Date().toISOString() };
}

function validValue(key, value) {
  let s = String(value ?? '').trim();
  if (key === 'fontFamily') {
    const descriptor = s.match(/^Font\(family:\s*["']([^"']+)["']/i);
    if (descriptor) s = `${descriptor[1]}, Arial, sans-serif`;
  }
  if (!s || s.length > 240 || /[<>;{}]|url\s*\(|expression\s*\(|@import/i.test(s)) return null;
  if (['radius', 'spacing'].includes(key)) {
    const match = s.match(/^(-?[\d.]+)\s*(px|rem|em)?$/i);
    if (!match || !Number.isFinite(+match[1]) || +match[1] < 0) return null;
    const maximum = key === 'radius' ? 80 : 64;
    return Math.min(maximum, +match[1] * (/rem|em/i.test(match[2] || '') ? 16 : 1)) + 'px';
  }
  if (key === 'fontFamily') return /^[\w\s,"'\-\u00a0-\uffff]+$/.test(s) ? s : null;
  if (globalThis.CSS?.supports) return CSS.supports('color', s) ? s : null;
  return /^(#[\da-f]{3,8}|(?:rgba?|hsla?|oklch|lab|lch|color)\([^;<>]+\)|[a-z]+)$/i.test(s) ? s : null;
}

export function resolveSemanticValues(system) {
  const values = { ...DEFAULTS };
  for (const [key] of SEMANTICS) {
    const token = system.tokens?.find(t => t.name === system.bindings?.[key]);
    const candidate = system.overrides?.[key] ?? token?.resolvedValue ?? system.values?.[key] ?? DEFAULTS[key];
    values[key] = validValue(key, candidate) || DEFAULTS[key];
  }
  return values;
}

let current = null;
export function getDesignSystem() {
  if (!current) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.length <= MAX_STORAGE) {
        const parsed = JSON.parse(saved);
        if (parsed.version === 1 && Array.isArray(parsed.tokens) && parsed.tokens.length <= 2000) current = parsed;
      }
    } catch {}
    if (!current) current = sampleSystem();
    current.values = resolveSemanticValues(current);
  }
  return current;
}

function commit(system, options = {}) {
  current = { ...system, updatedAt: new Date().toISOString() };
  current.values = resolveSemanticValues(current);
  try {
    let saved = JSON.stringify(current);
    if (saved.length > MAX_STORAGE) saved = JSON.stringify({ ...current, rawTokens: null, rawNotPersisted: true });
    if (saved.length <= MAX_STORAGE) localStorage.setItem(STORAGE_KEY, saved);
    else options.toast?.('变量已导入。本次数据较大，刷新前请导出备份。');
  } catch { options.toast?.('变量已应用；浏览器未允许本地保存，请导出备份。'); }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('layerlab:design-system', { detail: current }));
  options.onTokensChanged?.(current);
}

export function exportTokenCSS(system = getDesignSystem()) {
  const values = resolveSemanticValues(system);
  const sourceName = String(system.source?.name || 'Imported tokens').replace(/\*\//g, '* /').replace(/[\r\n]/g, ' ');
  return `/* UI工作室 semantic bindings · ${sourceName} */\n:root {\n` + Object.entries(values).map(([k, v]) => `  --${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v};`).join('\n') + '\n}\n';
}
export function exportTokenManifest(system = getDesignSystem()) { return JSON.stringify({ ...system, values: resolveSemanticValues(system), exportedAt: new Date().toISOString(), figmaRealtimeSync: false }, null, 2); }
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }

/** Apply a verified source snapshot supplied by the host, never by URL alone. */
export function applyDesignSystemSeed(seed, options = {}) {
  if (!seed || typeof seed !== 'object') throw new Error('同步服务没有返回有效变量。');
  const parsed = parseTokens(seed.rawTokens ?? seed.tokens ?? seed, seed.format || 'json');
  const previous = getDesignSystem(), bindings = {}, overrides = { ...previous.values };
  const requestedBindings = { ...(seed.verifiedFigma === true ? MEGWIN_EXACT_BINDINGS : {}), ...(seed.bindings || {}) };
  for (const [key] of SEMANTICS) {
    if (seed.values?.[key] !== undefined && validValue(key, seed.values[key])) overrides[key] = validValue(key, seed.values[key]);
    const name = requestedBindings[key];
    const token = parsed.tokens.find(t => t.name === name && !t.error);
    if (token && validValue(key, token.resolvedValue)) { bindings[key] = name; delete overrides[key]; }
  }
  const verified = seed.verifiedFigma === true;
  const source = { name: seed.source?.name || (verified ? 'Figma 变量快照' : '导入的变量'), kind: verified ? 'figma' : 'json', url: seed.source?.url || '', syncedAt: verified ? seed.source?.syncedAt || new Date().toISOString() : null, figmaSynced: verified, syncStatus: verified ? 'fresh' : undefined };
  if (source.url.includes('2EBmHXzEU62LfXXaE1CEza')) source.frameUrl = MEGWIN_REFERENCE.url;
  commit({ version: 1, status: verified ? 'figma' : 'imported', source, ...parsed, bindings, overrides, values: previous.values, sync: { status: 'success', attemptedAt: new Date().toISOString() } }, options);
  return getDesignSystem();
}

export function markDesignSystemSyncFailure(error, options = {}) {
  const previous = getDesignSystem();
  const message = String(error?.message || error || '实时同步未完成').slice(0, 400);
  commit({ ...previous, source: previous.status === 'figma' ? { ...previous.source, syncStatus: 'stale' } : previous.source, sync: { status: 'failed', message, attemptedAt: new Date().toISOString() } }, options);
  return getDesignSystem();
}

export function applyMegwinReference(options = {}) { commit(sampleSystem(), options); return getDesignSystem(); }

/** Called only by an explicit catalog Apply button, never by browsing a file or mode. */
export function applyFigmaAuditSnapshot({ audit, file, modeName }, options = {}) {
  if (!file || !Array.isArray(file.variables) || !file.variables.length) throw new Error('该文件还没有可应用的已读取变量。');
  const selected = resolveFigmaSnapshot(file, modeName);
  const rawTokens = { variables: selected.map(v => ({ id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId, valuesByMode: { [v.modeId]: v.value } })) };
  const parsed = parseTokens(rawTokens), previous = getDesignSystem();
  for (const token of parsed.tokens) {
    const original = selected.find(v => v.id === token.id);
    if (original?.error) { token.error = original.error; token.resolvedValue = null; }
  }
  if (parsed.tokens.every(t => t.error)) throw new Error('所选模式的变量值尚未完整读取，已保留当前绑定。');
  const bindings = {}, overrides = { ...previous.values };
  for (const [key, name] of Object.entries(MEGWIN_EXACT_BINDINGS)) {
    const token = parsed.tokens.find(t => t.name === name && !t.error);
    if (token && validValue(key, token.resolvedValue)) { bindings[key] = name; delete overrides[key]; }
  }
  const source = {
    name: `${file.name} · ${modeName} 已读取快照`, kind: 'figma-file-audit', url: file.url,
    fileKey: file.fileKey, modeName, capturedAt: audit.capturedAt, syncedAt: audit.capturedAt,
    figmaSynced: true, syncStatus: 'snapshot', variableCount: file.variables.length,
    note: '来自本次 Figma 文件读取的变量快照。浏览其他模式不会修改页面；此快照不是实时同步。未映射的字体、间距等值保留。',
  };
  commit({ version: 1, status: 'figma', source, ...parsed, bindings, overrides, values: previous.values,
    sync: { status: 'snapshot', appliedAt: new Date().toISOString() },
    audit: { fileId: file.id, capturedAt: audit.capturedAt, selectedMode: modeName, variablesRead: file.variables.length } }, options);
  return getDesignSystem();
}

export function mountDesignSystem(container, options = {}) {
  getDesignSystem();
  let readyDownloadUrl = null;
  container.classList.add('ds-root');
  container.innerHTML = `<div class="ds-heading"><div><span class="ds-eyebrow">DESIGN FOUNDATION</span><h2>让每一次生成，遵循真实规范</h2><p>查看两个文件的读取范围、完整变量与组件目录，再明确应用到页面。未读取的部分会单独标明。</p></div><span class="ds-status" hidden></span></div>
  <div class="ds-workspace-tabs" role="tablist" aria-label="设计系统工作区"><button type="button" class="ds-workspace-tab" data-ds-pane="catalog" role="tab" aria-selected="true">Figma 读取结果</button><button type="button" class="ds-workspace-tab" data-ds-pane="bindings" role="tab" aria-selected="false">页面变量绑定与导入</button></div>
  <section class="ds-catalog-pane" aria-label="Figma 文件读取结果"></section>
  <section class="ds-binding-pane" aria-label="页面变量绑定与导入" hidden><div class="ds-source-links"></div><div class="ds-grid"><section class="ds-card"><div class="ds-card-heading"><h3>导入设计变量</h3><span>01</span></div><p class="ds-help">支持 W3C、Tokens Studio、Figma 变量 JSON 导出及 CSS 自定义属性。同步成功后会显示来源与时间。</p><button class="ds-button ds-sync-figma" type="button">同步 Figma</button>
  <button class="ds-upload" type="button"><span>＋</span><strong>选择 JSON / CSS 文件</strong><small>不超过 2 MB · 仅保存在当前浏览器</small></button><input class="ds-file" type="file" accept=".json,.css,application/json,text/css" hidden>
  <details class="ds-paste"><summary>或直接粘贴变量</summary><textarea spellcheck="false" placeholder='{"color":{"brand":{"$type":"color","$value":"#b8ed63"}}}'></textarea><button class="ds-button ds-import-text" type="button">导入粘贴内容</button></details>
  <div class="ds-source-info"></div><div class="ds-actions"><button class="ds-button ds-export-json" type="button">导出当前绑定变量</button><button class="ds-button ds-export-css" type="button">导出语义 CSS</button></div><div class="ds-download-ready" hidden><span>文件已准备好，点击保存</span><a class="ds-ready-link" download></a></div><button class="ds-reset" type="button">恢复初始参考值</button></section>
  <section class="ds-card ds-bindings-card"><div class="ds-card-heading"><h3>语义绑定</h3><span>02</span></div><p class="ds-help">每个角色由你指定变量。新导入的变量不会自动覆盖设计；也可直接输入值。</p><div class="ds-bindings"></div></section></div>
  <div class="ds-grid ds-bottom"><section class="ds-card"><div class="ds-card-heading"><h3>变量应用预览</h3><span>示意卡片 · 非 Figma 原稿</span></div><div class="ds-component-preview"></div></section><section class="ds-card"><div class="ds-card-heading"><h3>当前绑定变量清单</h3><span class="ds-token-count"></span></div><input class="ds-token-search" placeholder="搜索变量名称或值" aria-label="搜索变量"><div class="ds-token-list"></div></section></div></section>`;
  const q = s => container.querySelector(s);
  for (const button of container.querySelectorAll('.ds-workspace-tab')) button.onclick = () => {
    const bindings = button.dataset.dsPane === 'bindings'; q('.ds-catalog-pane').hidden = bindings; q('.ds-binding-pane').hidden = !bindings; q('.ds-status').hidden = !bindings;
    for (const tab of container.querySelectorAll('.ds-workspace-tab')) tab.setAttribute('aria-selected', String(tab === button));
  };
  for (const source of FIGMA_SOURCES) { const link = el('a', 'ds-source-link', `${source.name} ↗`); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; q('.ds-source-links').append(link); }
  const notify = message => options.toast?.(message);
  const prepareDownload = (text, name, mime = 'application/json;charset=utf-8') => {
    if (readyDownloadUrl) URL.revokeObjectURL(readyDownloadUrl);
    readyDownloadUrl = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = q('.ds-ready-link'); link.href = readyDownloadUrl; link.download = name; link.textContent = `保存 ${name}`;
    q('.ds-download-ready').hidden = false; link.click();
  };
  const refreshList = () => {
    const system = getDesignSystem(), query = q('.ds-token-search').value.toLowerCase();
    const tokens = system.tokens.filter(t => !query || t.name.toLowerCase().includes(query) || String(t.resolvedValue).toLowerCase().includes(query));
    q('.ds-token-list').replaceChildren();
    for (const token of tokens) {
      const row = el('div', 'ds-token-row'), swatch = el('span', 'ds-token-dot');
      const color = validValue('primary', token.resolvedValue); if (color) swatch.style.background = color;
      const name = el('span', 'ds-token-name', token.name); name.title = token.name;
      const value = el('code', token.error ? 'ds-token-error' : '', token.error || String(token.resolvedValue)); value.title = value.textContent;
      row.append(swatch, name, value); q('.ds-token-list').append(row);
    }
    if (!tokens.length) q('.ds-token-list').append(el('p', 'ds-help', '没有匹配的变量。'));
  };
  const refresh = () => {
    const system = getDesignSystem(), values = system.values;
    q('.ds-status').textContent = system.source.kind === 'figma-file-audit' ? `已应用 ${system.source.modeName} 快照 · ${system.source.variableCount} 个变量` : system.status === 'reference' ? '初始参考值 · 尚未应用完整快照' : system.status === 'sample' ? '示例变量 · 尚未同步 Figma' : system.status === 'figma' ? (system.source.syncStatus === 'stale' ? 'Figma 变量 · 上次同步失败' : 'Figma 变量快照 · 已同步') : '已导入变量 · 未实时同步 Figma';
    q('.ds-status').dataset.kind = system.status;
    q('.ds-source-info').replaceChildren(el('strong', '', system.source.name), el('span', '', `${system.tokens.length} 个变量 · ${system.tokens.filter(t => t.error).length} 个别名问题${system.rawNotPersisted ? ' · 原始文件需重新导入' : ''}`));
    if (system.source.syncedAt) q('.ds-source-info').append(el('small', '', `${system.source.kind === 'figma-file-audit' ? '读取快照时间' : '同步时间'}：${new Date(system.source.syncedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo', hour12: false })} JST`));
    if (system.source.kind === 'figma-file-audit') q('.ds-source-info').append(el('small', '', system.source.note));
    if (system.source.compiledAt) {
      q('.ds-source-info').append(el('small', '', `参考整理日期：${system.source.compiledAt} · 非实时同步`));
      q('.ds-source-info').append(el('small', '', system.source.note));
      const referenceLink = el('a', 'ds-reference-frame', '查看来源画面 ↗'); referenceLink.href = system.source.url; referenceLink.target = '_blank'; referenceLink.rel = 'noopener noreferrer'; q('.ds-source-info').append(referenceLink);
    }
    if (system.sync?.status === 'failed') q('.ds-source-info').append(el('small', 'ds-sync-error', `上次同步失败，已保留原有变量。${system.sync.message}`));
    q('.ds-token-count').textContent = `${system.tokens.length} TOKENS`;
    q('.ds-bindings').replaceChildren();
    for (const [key, label, type] of SEMANTICS) {
      const row = el('div', 'ds-binding-row'), caption = el('label', '', label), select = el('select', 'ds-binding-select'), input = el('input', 'ds-binding-value');
      select.setAttribute('aria-label', `${label}变量绑定`); input.setAttribute('aria-label', `${label}自定义值`); input.value = values[key];
      const none = el('option', '', '手动值 / 尚未绑定'); none.value = ''; select.append(none);
      for (const token of system.tokens) {
        if (token.error || !validValue(key, token.resolvedValue)) continue;
        if (type === 'color' && ['number', 'dimension', 'float', 'boolean', 'fontfamily'].includes(token.type)) continue;
        const option = el('option', '', token.name); option.value = token.name; select.append(option);
      }
      select.value = system.bindings[key] || '';
      const dot = el('span', 'ds-binding-dot'); if (type === 'color') dot.style.background = values[key]; else dot.textContent = type === 'fontFamily' ? 'Aa' : '↔';
      select.onchange = () => { const next = { ...getDesignSystem(), bindings: { ...getDesignSystem().bindings, [key]: select.value }, overrides: { ...getDesignSystem().overrides } }; if (select.value) delete next.overrides[key]; else next.overrides[key] = values[key]; commit(next, options); refresh(); };
      input.onchange = () => { const value = validValue(key, input.value); if (!value) { input.value = values[key]; notify(`${label}格式无效，请输入有效颜色、尺寸或字体。`); return; } commit({ ...getDesignSystem(), bindings: { ...getDesignSystem().bindings, [key]: '' }, overrides: { ...getDesignSystem().overrides, [key]: value } }, options); refresh(); };
      row.append(caption, dot, select, input); q('.ds-bindings').append(row);
    }
    const preview = q('.ds-component-preview');
    preview.replaceChildren(); preview.style.background = values.background; preview.style.color = values.text; preview.style.fontFamily = values.fontFamily; preview.style.padding = values.spacing;
    const card = el('div', 'ds-preview-card'); card.style.background = values.surface; card.style.borderColor = values.border; card.style.borderRadius = values.radius;
    const tag = el('span', 'ds-preview-tag', 'PREVIEW'); tag.style.color = values.primary;
    const title = el('strong', '', 'Cada detalle, conectado.'); const copy = el('p', '', '品牌、组件与页面，共用同一套变量。'); copy.style.color = values.muted;
    const button = el('button', 'ds-preview-button', 'Ver promociones →'); button.type = 'button'; button.style.background = values.primary; button.style.color = readableText(values.primary); button.style.borderRadius = values.radius; button.onclick = () => notify('这是当前变量的应用示意，不是 Figma 组件原稿。');
    card.append(tag, title, copy, button); preview.append(card); refreshList();
  };
  const importText = (text, name = '粘贴的变量') => {
    try {
      if (new Blob([text]).size > MAX_STORAGE) throw new Error('文件超过 2 MB，请拆分变量文件后导入。');
      const format = /\.css$/i.test(name) || (!/^\s*[\[{]/.test(text) && /--[\w-]+\s*:/.test(text)) ? 'css' : 'json';
      const parsed = parseTokens(text, format), previous = getDesignSystem();
      commit({ version: 1, status: 'imported', source: { name, kind: format, figmaSynced: false, importedAt: new Date().toISOString() }, ...parsed, bindings: {}, overrides: { ...previous.values }, values: { ...previous.values } }, options);
      refresh(); notify(`已导入 ${parsed.tokens.length} 个变量，请在右侧选择语义绑定。`);
    } catch (error) { notify(`导入未完成：${error.message}`); }
  };
  q('.ds-upload').onclick = () => q('.ds-file').click();
  q('.ds-file').onchange = async e => { const file = e.target.files[0]; if (file) { if (file.size > MAX_STORAGE) notify('文件超过 2 MB。'); else importText(await file.text(), file.name); } e.target.value = ''; };
  q('.ds-import-text').onclick = () => importText(q('.ds-paste textarea').value);
  q('.ds-export-json').onclick = () => prepareDownload(exportTokenManifest(), 'megwin-design-tokens.json');
  q('.ds-export-css').onclick = () => prepareDownload(exportTokenCSS(), 'megwin-semantic-tokens.css', 'text/css;charset=utf-8');
  q('.ds-reset').onclick = () => { applyMegwinReference(options); refresh(); notify('已应用 2026-11-02 整理的 Megwin 活动参考规范；这不是实时同步。'); };
  q('.ds-token-search').oninput = refreshList;
  q('.ds-sync-figma').disabled = !options.onSyncFigma;
  if (!options.onSyncFigma) q('.ds-sync-figma').title = 'Figma 同步服务尚未配置，可先导入变量文件。';
  q('.ds-sync-figma').onclick = async () => {
    const button = q('.ds-sync-figma'); button.disabled = true; button.textContent = '正在同步 Figma…';
    try { const seed = await options.onSyncFigma(); applyDesignSystemSeed(seed, options); refresh(); notify('Figma 变量快照已同步，来源与绑定已更新。'); }
    catch (error) { markDesignSystemSyncFailure(error, options); refresh(); notify(`同步未完成：${error.message}`); }
    finally { button.disabled = false; button.textContent = '同步 Figma'; }
  };
  if (options.initialSeed && ['sample', 'reference'].includes(getDesignSystem().status) && !Object.keys(getDesignSystem().overrides || {}).length) {
    try { applyDesignSystemSeed(options.initialSeed, options); } catch (error) { notify(`初始变量未应用：${error.message}`); }
  }
  const onSystemChange = () => refresh();
  window.addEventListener('layerlab:design-system', onSystemChange);
  refresh();
  const catalog = mountFigmaCatalog(q('.ds-catalog-pane'), { toast: notify, onApply: snapshot => applyFigmaAuditSnapshot(snapshot, options) });
  return { refresh, destroy() { catalog.destroy(); if (readyDownloadUrl) URL.revokeObjectURL(readyDownloadUrl); window.removeEventListener('layerlab:design-system', onSystemChange); container.replaceChildren(); } };
}

export function readableText(color) {
  const match = String(color).match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return '#132016';
  let hex = match[1]; if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  return r * .299 + g * .587 + b * .114 > 145 ? '#132016' : '#ffffff';
}
