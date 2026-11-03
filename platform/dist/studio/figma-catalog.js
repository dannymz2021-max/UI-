/** Read-only Figma inventory and explicitly applied, mode-aware snapshots. */
const AUDIT_URL = new URL('./figma/megwin-audit.json', import.meta.url);
const arr = value => Array.isArray(value) ? value : [];
const node = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = String(text); return e; };
const stringify = value => typeof value === 'string' ? value : JSON.stringify(value);
const issueText = issue => typeof issue === 'string' ? issue : issue?.message || stringify(issue);

export function fileReadStatus(file) {
  return ['audited', 'read', 'complete'].includes(file?.status) ? '变量与组件目录已读取' : '部分已读取';
}

/** Normalize the two evidence formats without interpreting an inventory as an implementation. */
export function componentReadDetails(item) {
  const hasDefinition = (item.propertyDefinitions && typeof item.propertyDefinitions === 'object') || (item.properties && typeof item.properties === 'object');
  if (item.readStatus !== 'details' && !hasDefinition && !item.details) return null;
  const details = item.details && typeof item.details === 'object' ? { ...item.details } : {};
  if (item.propertyDefinitions && typeof item.propertyDefinitions === 'object') details.propertyDefinitions = item.propertyDefinitions;
  else if (item.properties && typeof item.properties === 'object') details.propertyDefinitions = item.properties;
  if (Array.isArray(item.variants)) details.variants = item.variants;
  for (const key of ['propertyOwnerId', 'width', 'height', 'description']) if (item[key] !== undefined) details[key] = item[key];
  return Object.keys(details).length ? details : null;
}

export function auditFiles(audit) {
  return Array.isArray(audit?.files) ? audit.files : Object.entries(audit?.files || {}).map(([id, file]) => ({ id, ...file }));
}

export function figmaNodeUrl(file, id) {
  try {
    const url = new URL(file.url || `https://www.figma.com/design/${file.fileKey}/Megwin`);
    if (url.protocol !== 'https:' || !['figma.com', 'www.figma.com'].includes(url.hostname)) return '';
    if (id) url.searchParams.set('node-id', String(id).replaceAll(':', '-'));
    return url.href;
  } catch { return ''; }
}

export function modeNames(file) {
  const names = [...new Set(arr(file.collections).flatMap(c => arr(c.modes).map(m => m.name || m.modeId)).filter(Boolean))];
  return names.length ? names : [...new Set(arr(file.variables).flatMap(v => Object.keys(v.valuesByMode || {})))];
}

export function scalarFigmaValue(value) {
  if (value && typeof value === 'object' && ['r', 'g', 'b'].every(k => typeof value[k] === 'number')) {
    const rgb = ['r', 'g', 'b'].map(k => Math.round(Math.max(0, Math.min(1, value[k])) * 255));
    const a = typeof value.a === 'number' ? Math.max(0, Math.min(1, value.a)) : 1;
    return a < 1 ? `rgba(${rgb.join(', ')}, ${Number(a.toFixed(4))})` : '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  }
  return typeof value === 'object' ? JSON.stringify(value) : value;
}

/** Select a matching named mode per collection, then resolve aliases by ID.
 * A collection without that mode uses its explicit default mode, never an
 * unrelated mode with the same numeric position in a different collection. */
export function resolveFigmaSnapshot(file, requestedMode = 'Dark') {
  const collections = new Map(arr(file.collections).map(c => [c.id, c]));
  const variables = arr(file.variables), byId = new Map(variables.map(v => [v.id, v]));
  const choose = v => {
    const collection = collections.get(v.variableCollectionId), entries = Object.keys(v.valuesByMode || {});
    const match = arr(collection?.modes).find(m => m.name === requestedMode || m.modeId === requestedMode);
    const fallback = collection?.defaultModeId || arr(collection?.modes)[0]?.modeId || entries[0];
    const modeId = match?.modeId || (entries.includes(requestedMode) ? requestedMode : fallback);
    const modeName = arr(collection?.modes).find(m => m.modeId === modeId)?.name || modeId || '未读取';
    return { modeId, modeName, collectionName: collection?.name || v.variableCollectionId || '未分组', fallback: !match && modeName !== requestedMode };
  };
  const resolve = (variable, path = []) => {
    if (path.length >= 32 || path.includes(variable.id)) throw new Error('循环变量别名');
    const { modeId } = choose(variable);
    if (!Object.prototype.hasOwnProperty.call(variable.valuesByMode || {}, modeId)) throw new Error('所选模式值尚未读取');
    const value = variable.valuesByMode[modeId];
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
      const target = byId.get(value.id);
      if (!target) throw new Error(`别名目标尚未读取：${value.id}`);
      return resolve(target, [...path, variable.id]);
    }
    return scalarFigmaValue(value);
  };
  return variables.map(v => {
    const selected = choose(v);
    try { return { ...v, ...selected, value: v.valuesByMode?.[selected.modeId], resolvedValue: resolve(v) }; }
    catch (error) { return { ...v, ...selected, value: v.valuesByMode?.[selected.modeId], resolvedValue: null, error: error.message }; }
  });
}

export function exportFigmaVariables(audit, file) {
  return {
    schemaVersion: 1, format: 'figma-file-variable-snapshot', capturedAt: audit.capturedAt,
    file: { id: file.id, name: file.name, fileKey: file.fileKey, url: file.url, status: file.status, readAt: file.readAt, scope: file.scope },
    collections: arr(file.collections), variables: arr(file.variables), issues: arr(file.issues),
    figmaRealtimeSync: false,
  };
}

function ensureStyle() {
  if (document.getElementById('figma-catalog-style')) return;
  const link = node('link'); link.id = 'figma-catalog-style'; link.rel = 'stylesheet'; link.href = new URL('./figma-catalog.css', import.meta.url).href; document.head.append(link);
}

function sourceLink(file, id, label = '在 Figma 中查看 ↗') {
  const link = node('a', 'fc-source-link', label); link.href = figmaNodeUrl(file, id); link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}

function dateLabel(date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return date;
  const parsed = new Date(date); return Number.isNaN(parsed.getTime()) ? '未记录' : `${parsed.toLocaleString('zh-CN', { timeZone: 'UTC', hour12: false })} UTC`;
}

export function mountFigmaCatalog(container, options = {}) {
  ensureStyle();
  let audit = null, selectedFileId = 'activity', selectedMode = 'Dark', kind = 'variables', search = '', collection = '', componentType = 'all', destroyed = false, downloadURL = null;
  container.classList.add('fc-root');
  container.innerHTML = `<div class="fc-loading" role="status">正在载入已读取的 Figma 目录…</div>`;
  const notify = message => options.toast?.(message);
  const currentFile = () => auditFiles(audit).find(f => f.id === selectedFileId) || auditFiles(audit)[0];
  const prepareDownload = (value, filename) => {
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
    const wrapper = container.querySelector('.fc-download-ready'), link = wrapper.querySelector('a');
    link.href = downloadURL; link.download = filename; link.textContent = `保存 ${filename}`; wrapper.hidden = false; link.click();
  };

  function build() {
    if (destroyed) return;
    container.innerHTML = `<div class="fc-file-tabs" role="tablist" aria-label="Figma 来源文件"></div><div class="fc-layout"><aside class="fc-summary" aria-label="Figma 文件读取范围"></aside><section class="fc-content" aria-label="Figma 已读取目录"><div class="fc-content-tabs" role="tablist" aria-label="目录类型"></div><div class="fc-filter-bar"><label class="fc-search-label">搜索目录<input class="fc-search" type="search" placeholder="搜索名称、变量值、组件状态…" aria-label="搜索 Figma 目录"></label><label class="fc-mode-label">显示模式<select class="fc-mode" aria-label="浏览变量模式"></select></label><label class="fc-collection-label">变量集合<select class="fc-collection" aria-label="筛选变量集合"></select></label><label class="fc-component-label" hidden>组件类型<select class="fc-component-type" aria-label="筛选组件类型"><option value="all">全部组件与变体</option><option value="sets">组件集</option><option value="variants">变体</option><option value="standalone">独立组件</option></select></label></div><div class="fc-results-heading"><span class="fc-result-count"></span><span class="fc-browse-note">浏览与筛选不会改变当前页面变量</span></div><div class="fc-results" tabindex="0" aria-label="目录结果"></div><div class="fc-download-ready" hidden><span>文件已准备好，点击保存</span><a download></a></div></section></div>`;
    const q = selector => container.querySelector(selector);
    for (const file of auditFiles(audit)) {
      const button = node('button', 'fc-file-tab', file.name || file.id); button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(file.id === selectedFileId));
      button.onclick = () => { selectedFileId = file.id; collection = ''; search = ''; if (!modeNames(file).includes(selectedMode)) selectedMode = modeNames(file)[0] || 'Dark'; build(); };
      q('.fc-file-tabs').append(button);
    }
    for (const [key, label] of [['variables', '完整变量'], ['components', '组件与变体'], ['textStyles', '文字样式'], ['pages', '页面目录']]) {
      const button = node('button', 'fc-content-tab', label); button.type = 'button'; button.setAttribute('role', 'tab'); button.dataset.kind = key; button.setAttribute('aria-selected', String(kind === key));
      button.onclick = () => { kind = key; search = ''; q('.fc-search').value = ''; refreshResults(); };
      q('.fc-content-tabs').append(button);
    }
    const file = currentFile();
    for (const name of modeNames(file)) { const option = node('option', '', name); option.value = name; q('.fc-mode').append(option); }
    q('.fc-mode').value = selectedMode; q('.fc-mode').disabled = !modeNames(file).length;
    q('.fc-mode').onchange = e => { selectedMode = e.target.value; refreshSummary(); refreshResults(); };
    q('.fc-search').value = search; q('.fc-search').oninput = e => { search = e.target.value; refreshResults(); };
    q('.fc-collection').append(node('option', '', '全部集合'));
    q('.fc-collection').firstElementChild.value = '';
    for (const c of arr(file.collections)) { const option = node('option', '', c.name); option.value = c.id; q('.fc-collection').append(option); }
    q('.fc-collection').value = collection; q('.fc-collection').onchange = e => { collection = e.target.value; refreshResults(); };
    q('.fc-component-type').value = componentType; q('.fc-component-type').onchange = e => { componentType = e.target.value; refreshResults(); };
    refreshSummary(); refreshResults();
  }

  function refreshSummary() {
    const file = currentFile(), box = container.querySelector('.fc-summary'); box.replaceChildren();
    const eyebrow = node('span', 'fc-eyebrow', 'FIGMA READ AUDIT'), title = node('h3', '', file.name);
    const state = node('span', 'fc-status', fileReadStatus(file)); state.dataset.status = file.status;
    box.append(eyebrow, title, state, node('p', 'fc-timestamp', `快照时间：${dateLabel(file.readAt || audit.capturedAt)}`));
    const stats = node('div', 'fc-stats');
    for (const [value, label] of [[arr(file.pages).length, '页面目录'], [arr(file.variables).length, '已读取变量'], [arr(file.components).filter(c => c.type === 'COMPONENT_SET').length, '组件集'], [arr(file.components).filter(c => c.type !== 'COMPONENT_SET').length, '组件 / 变体'], [arr(file.components).filter(c => componentReadDetails(c) || c.readStatus === 'details').length, '属性已读组件'], [arr(file.textStyles).length, '已读取文字样式']]) {
      const item = node('div'); item.append(node('strong', '', value), node('span', '', label)); stats.append(item);
    }
    box.append(stats);
    if (file.scope) {
      const scope = node('section', 'fc-scope'); scope.append(node('h4', '', '本次读取范围'));
      if (arr(file.scope.componentPageIds).length) {
        const pageLabels = file.scope.componentPageIds.map(id => { const page = arr(file.pages).find(p => p.id === id); return page ? `${page.name}（${id}）` : id; });
        scope.append(node('p', '', `组件目录覆盖：${pageLabels.join('、')}`));
      }
      if (file.diagnostics?.completeness?.allLocalVariablesRead === true || file.scope.variables === 'All local variables in the file') scope.append(node('p', '', '变量范围：文件全部本地变量。'));
      if (arr(file.scope.componentDetailIds).length) scope.append(node('p', '', `已读取 ${file.scope.componentDetailIds.length} 个组件集／独立组件的属性定义。`));
      scope.append(node('p', '', '目录读取完成不代表其他页面或所有组件已经实现。')); box.append(scope);
    }
    const coverage = node('section', 'fc-coverage'); coverage.append(node('h4', '', '变量集合覆盖范围'));
    for (const c of arr(file.collections)) {
      const read = arr(file.variables).filter(v => v.variableCollectionId === c.id).length;
      const row = node('div', 'fc-coverage-row'); row.append(node('strong', '', c.name), node('span', '', `${read} / ${c.varCount ?? (Array.isArray(c.variableIds) ? c.variableIds.length : '—')} 已读取`), node('small', '', arr(c.modes).map(m => m.name).join(' · '))); coverage.append(row);
    }
    if (!arr(file.collections).length) coverage.append(node('p', '', '集合与模式细节尚未读取。'));
    box.append(coverage);
    if (arr(file.issues).length) { const issues = node('div', 'fc-issues'); issues.append(node('h4', '', '读取范围与待完成项')); for (const issue of file.issues) issues.append(node('p', '', issueText(issue))); box.append(issues); }
    box.append(node('p', 'fc-disclaimer', '组件目录不等于组件已还原。每个条目会区分目录、属性读取与页面实现状态。这里显示已读取快照，不是实时 Figma 同步。'), sourceLink(file));
    if (arr(file.variables).length) {
      const apply = node('section', 'fc-apply'); apply.append(node('h4', '', '应用到 UI 工作台'), node('p', '', '仅点击下方按钮才更新当前绑定；未映射的字体、间距等自定义值保留。'));
      const applyModes = modeNames(file).filter(name => /^(dark|light)$/i.test(name));
      for (const name of (applyModes.length ? applyModes : [selectedMode])) {
        const button = node('button', 'fc-apply-button', `应用${file.id === 'activity' ? '活动' : '当前文件'} ${name} 快照`); button.type = 'button'; button.disabled = typeof options.onApply !== 'function';
        button.onclick = async () => { button.disabled = true; try { await options.onApply?.({ audit, file, modeName: name }); selectedMode = name; container.querySelector('.fc-mode').value = name; refreshResults(); notify(`已应用 ${file.name} ${name} 变量快照。`); } catch (error) { notify(`快照未应用：${error.message}`); } finally { button.disabled = false; } }; apply.append(button);
      }
      apply.append(node('small', '', '跨集合时，未定义同名模式的集合使用其默认模式。'));
      box.append(apply);
    }
    const actions = node('div', 'fc-audit-actions');
    const variables = node('button', 'fc-export-button', '导出此文件变量 · 全部模式'); variables.type = 'button'; variables.disabled = !arr(file.variables).length; variables.onclick = () => prepareDownload(exportFigmaVariables(audit, file), `megwin-${file.id}-variables-all-modes.json`);
    const all = node('button', 'fc-export-button', '导出完整读取清单'); all.type = 'button'; all.onclick = () => prepareDownload(audit, 'megwin-figma-read-audit.json');
    const reload = node('button', 'fc-reload', '重新载入已保存快照'); reload.type = 'button'; reload.onclick = load;
    actions.append(variables, all, reload); box.append(actions);
  }

  function refreshResults() {
    const file = currentFile(), q = selector => container.querySelector(selector), results = q('.fc-results');
    for (const button of container.querySelectorAll('.fc-content-tab')) button.setAttribute('aria-selected', String(button.dataset.kind === kind));
    q('.fc-mode-label').hidden = kind !== 'variables'; q('.fc-collection-label').hidden = kind !== 'variables'; q('.fc-component-label').hidden = kind !== 'components';
    results.replaceChildren();
    const query = search.trim().toLowerCase(); let count = 0, total = 0;
    if (kind === 'variables') {
      const values = resolveFigmaSnapshot(file, selectedMode); total = values.length;
      for (const variable of values) {
        if (collection && variable.variableCollectionId !== collection) continue;
        if (query && !`${variable.name} ${variable.id} ${variable.resolvedValue} ${variable.collectionName}`.toLowerCase().includes(query)) continue;
        count++;
        const row = node('article', 'fc-variable-row'), swatch = node('span', 'fc-variable-swatch');
        if (String(variable.resolvedType).toUpperCase() === 'COLOR' && variable.resolvedValue && globalThis.CSS?.supports('color', String(variable.resolvedValue))) swatch.style.background = String(variable.resolvedValue); else swatch.textContent = String(variable.resolvedType).toUpperCase() === 'FLOAT' ? '↔' : 'Aa';
        const name = node('div', 'fc-variable-name'); name.append(node('strong', '', variable.name), node('small', '', `${variable.collectionName} · ${variable.modeName} · ${variable.id}`));
        const value = node('code', variable.error ? 'fc-value fc-value-error' : 'fc-value', variable.error || String(variable.resolvedValue)); value.title = stringify(variable.valuesByMode);
        const details = node('details', 'fc-variable-details'), summary = node('summary', '', '全部模式值'); details.append(summary);
        for (const [modeId, raw] of Object.entries(variable.valuesByMode || {})) {
          const collectionMeta = arr(file.collections).find(c => c.id === variable.variableCollectionId), modeName = arr(collectionMeta?.modes).find(m => m.modeId === modeId)?.name || modeId;
          details.append(node('div', '', `${modeName} (${modeId})`), node('code', '', stringify(raw)));
        }
        row.append(swatch, name, value, details); results.append(row);
      }
    } else if (kind === 'components') {
      const byId = new Map(arr(file.components).map(c => [c.id, c])); total = byId.size;
      for (const item of arr(file.components)) {
        const parent = byId.get(item.parentId), isSet = item.type === 'COMPONENT_SET', isVariant = !isSet && parent?.type === 'COMPONENT_SET';
        const category = isSet ? 'sets' : isVariant ? 'variants' : 'standalone';
        if (componentType !== 'all' && category !== componentType) continue;
        if (query && !`${item.name} ${item.id} ${parent?.name || ''}`.toLowerCase().includes(query)) continue;
        count++;
        const row = node('article', 'fc-component-row'), type = node('span', 'fc-component-type', isSet ? '组件集' : isVariant ? '变体' : '组件');
        const body = node('div', 'fc-component-name'); body.append(node('strong', '', item.name), node('small', '', `${parent ? parent.name + ' · ' : ''}${item.id}`));
        const readDetails = componentReadDetails(item);
        const level = item.mappingStatus === 'implemented' ? '已用于页面实现' : item.readStatus === 'details' || readDetails ? '属性已读取' : '目录已读取';
        const status = node('span', 'fc-component-status', level); if (level !== '目录已读取') status.dataset.detailed = 'true';
        row.append(type, body, status, sourceLink(file, item.id, '查看 ↗'));
        if (isSet) row.append(node('small', 'fc-component-count', `目录包含 ${Array.isArray(item.variants) ? item.variants.length : arr(file.components).filter(c => c.parentId === item.id).length} 个变体`));
        if (readDetails) { const details = node('details', 'fc-component-details'); details.append(node('summary', '', `查看已读取属性与变体${readDetails.propertyDefinitions ? `（${Object.keys(readDetails.propertyDefinitions).length} 个属性）` : ''}`), node('pre', '', JSON.stringify(readDetails, null, 2))); row.append(details); }
        results.append(row);
      }
    } else if (kind === 'textStyles') {
      total = arr(file.textStyles).length;
      for (const item of arr(file.textStyles)) {
        if (query && !`${item.name} ${item.id} ${item.fontName?.family || ''} ${item.fontName?.style || ''}`.toLowerCase().includes(query)) continue;
        count++;
        const row = node('article', 'fc-page-row fc-text-style-row'), body = node('div');
        const lineHeight = item.lineHeight?.unit === 'AUTO' ? 'Auto' : item.lineHeight?.value !== undefined ? `${item.lineHeight.value}${item.lineHeight.unit === 'PERCENT' ? '%' : 'px'}` : '未读取';
        body.append(node('strong', '', item.name), node('small', '', `${item.fontName?.family || '未读取字体'} · ${item.fontName?.style || ''} · ${item.fontSize ?? '—'}px / ${lineHeight}`), node('small', '', item.id));
        const details = node('details', 'fc-text-style-details'); details.append(node('summary', '', '查看样式属性'), node('pre', '', JSON.stringify(item, null, 2))); body.append(details); row.append(body, node('span', 'fc-component-status', '属性已读取')); results.append(row);
      }
    } else {
      total = arr(file.pages).length;
      for (const item of arr(file.pages)) {
        if (query && !`${item.name} ${item.id}`.toLowerCase().includes(query)) continue;
        count++; const row = node('article', 'fc-page-row'); const body = node('div'); body.append(node('strong', '', item.name), node('small', '', `${item.id} · 页面目录已读取`)); row.append(body, sourceLink(file, item.id)); results.append(row);
      }
    }
    q('.fc-result-count').textContent = `${count} / ${total} ${kind === 'variables' ? '个变量' : kind === 'components' ? '个组件与变体' : kind === 'textStyles' ? '个文字样式' : '个页面'}`;
    if (!count) {
      const empty = node('div', 'fc-empty'); empty.append(node('strong', '', total ? '没有匹配的条目' : '这部分尚未读取'), node('p', '', total ? '试试其他关键词或清除筛选。' : arr(file.issues).map(issueText).join(' ') || '已读取的部分会显示在这里；当前没有可展示的数据。')); results.append(empty);
    }
  }

  async function load() {
    try {
      const response = await fetch(AUDIT_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`快照文件读取失败（${response.status}）`);
      const next = await response.json();
      if (!auditFiles(next).length) throw new Error('快照中没有文件目录');
      audit = next; if (!auditFiles(audit).some(f => f.id === selectedFileId)) selectedFileId = auditFiles(audit)[0].id;
      if (!modeNames(currentFile()).includes(selectedMode)) selectedMode = modeNames(currentFile())[0] || 'Dark';
      build();
    } catch (error) {
      if (destroyed) return;
      container.replaceChildren(node('p', 'fc-load-error', `Figma 已读取目录暂时无法展示：${error.message}`));
      const retry = node('button', 'fc-export-button', '重新载入快照'); retry.type = 'button'; retry.onclick = load; container.append(retry);
    }
  }
  const ready = load();
  return { ready, refresh: load, destroy() { destroyed = true; if (downloadURL) URL.revokeObjectURL(downloadURL); container.replaceChildren(); } };
}
