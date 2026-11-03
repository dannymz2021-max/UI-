const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** A task-led entry point. All counts and draft details come from this browser. */
export function mountStudioHome(container, { onOpen, getAssetCount, getDraft } = {}) {
  let disposed = false;
  container.classList.add('studio-home');
  container.innerHTML = `<div class="home-heading"><div><p class="eyebrow">YOUR DESIGN WORKSPACE</p><h1>今天，想完成什么设计？</h1><p>从一份素材开始，让创作、调整和交付连在一起。</p></div><span class="home-version">UI工作室 6.0</span></div>
  <section class="home-feature"><div class="home-feature-copy"><span class="home-feature-kicker">CASINO ICON & REWARD OBJECTS</span><h2>让图标，<br>成为奖励的主角。</h2><p>黄金、亮漆与切面宝石，自由搭配灯光和装饰。<br>为 Casino、奖励和体育入口制作一套 3D Icon。</p><div class="home-feature-actions"><button class="btn primary" data-home-view="icons">生成我的 Icon <span aria-hidden="true">↗</span></button><span>支持透明 PNG 导出</span></div></div><div class="home-feature-art"><canvas class="home-3d-preview" width="700" height="390" aria-label="工作台真实渲染的 Casino 图标组合"></canvas><span class="home-preview-caption">来自工作台的实时 3D 渲染</span></div></section>
  <section class="home-tasks" aria-labelledby="home-tasks-title"><div class="home-section-title"><h2 id="home-tasks-title">选择一个起点</h2><p>每种任务都有自己的工作区</p></div><div class="home-task-grid">
    <button class="home-task" data-home-view="icons"><span class="home-task-icon" aria-hidden="true">◇</span><small>01 / 创作素材</small><h3>3D Icon 与装饰</h3><p>选择主体与材质，调整高光、视角和装饰，导出透明 PNG。</p><span class="home-task-link">进入创作 <b>↗</b></span></button>
    <button class="home-task" data-home-view="ui" data-home-mode="main"><span class="home-task-icon home-task-icon-blue" aria-hidden="true">▤</span><small>02 / 主站设计</small><h3>Megwin 主站首页</h3><p>查看真实主站原稿、修改主促销卡文案，下载完整页面包。</p><span class="home-task-link">打开主站首页 <b>↗</b></span></button>
    <button class="home-task" data-home-view="ui" data-home-mode="activity"><span class="home-task-icon home-task-icon-orange" aria-hidden="true">✦</span><small>03 / 活动设计</small><h3>Megwin 活动页面</h3><p>以新客奖励活动原稿为起点，编辑文案并检查配色模式。</p><span class="home-task-link">打开活动页面 <b>↗</b></span></button>
    <button class="home-task" data-home-view="splitter"><span class="home-task-icon home-task-icon-green" aria-hidden="true">▱</span><small>04 / 处理素材</small><h3>图片图层拆解</h3><p>上传已有图片，提取可见内容，检查选区并导出分层文件。</p><span class="home-task-link">上传并拆层 <b>↗</b></span></button>
  </div></section>
  <div class="home-bottom"><section class="home-process"><div class="home-section-title"><h2>一条完整的创作路径</h2></div><ol><li><span>1</span><div><strong>选择主体</strong><p>Casino、奖励、体育</p></div></li><li><span>2</span><div><strong>确定外观</strong><p>材质、灯光与装饰</p></div></li><li><span>3</span><div><strong>调整与检查</strong><p>移动、删除、撤销</p></div></li><li><span>4</span><div><strong>保存并交付</strong><p>作品库或下载文件</p></div></li></ol></section><section class="home-resume"><div class="home-section-title"><h2>继续你的工作</h2><span class="home-local-badge">当前浏览器</span></div><div class="home-draft-content"></div><button class="home-library-link" data-home-view="assets">打开我的作品 <span class="home-asset-count">—</span><b aria-hidden="true">↗</b></button></section></div>
  <div class="home-footer"><span>主站与活动分别关联 Figma 原稿，可在「组件与变量」查看读取范围。</span><button data-home-view="system">查看设计规范 ↗</button></div>`;
  const q = selector => container.querySelector(selector);
  container.addEventListener('click', onClick);
  function onClick(event) { const button = event.target.closest('[data-home-view]'); if (button && container.contains(button)) onOpen?.(button.dataset.homeView, button.dataset.homeMode); }
  async function refresh() {
    const draft = getDraft?.();
    const known = { 'coin-stack':'金币堆',chips:'赌场筹码',cards:'王牌扑克',dice:'幸运骰子','slot-machine':'老虎机',roulette:'幸运轮盘',crown:'VIP 皇冠',diamond:'切面钻石',gift:'奖励礼盒',chest:'奖励宝箱',trophy:'冠军奖杯',medal:'荣誉勋章',shield:'VIP 盾徽',wallet:'奖励钱包',football:'足球',basketball:'篮球' };
    q('.home-draft-content').innerHTML = draft && Array.isArray(draft.layers) ? `<div><span class="home-draft-label">Icon 草稿</span><strong>${escape(known[draft.subject] || '我的图标组合')}</strong><small>${Number(draft.width) || 1024} × ${Number(draft.height) || 1024} · ${draft.layers.length} 个图层 · 自动保存</small></div><button class="btn" data-home-view="icons">继续编辑 ↗</button>` : '<div><strong>从第一枚图标开始</strong><small>图标和装饰的编辑状态会自动保存。</small></div><button class="btn" data-home-view="icons">开始创作 ↗</button>';
    try { const count = await getAssetCount?.(); if (!disposed) q('.home-asset-count').textContent = Number.isFinite(count) ? `${count} 个` : '—'; } catch { if (!disposed) q('.home-asset-count').textContent = '暂不可用'; }
  }
  async function renderExample() {
    try {
      const { renderIcon, ICON_DEFAULTS } = await import('./icon-renderer.js');
      if (disposed) return;
      renderIcon(q('canvas'), { ...ICON_DEFAULTS, width:700,height:390,subject:'slot-machine',style:'amethyst-gold',transparent:true,glow:10,shadow:72,layers:[
        {id:'left-crown',kind:'crown',role:'decoration',x:-.29,y:.03,scale:.78,rotation:-13,hidden:false},
        {id:'right-gem',kind:'diamond',role:'decoration',x:.32,y:.12,scale:.64,rotation:12,hidden:false},
        {id:'main',kind:'slot-machine',role:'main',x:.01,y:0,scale:1.05,rotation:-6,hidden:false},
        {id:'shine',kind:'sparkle',role:'decoration',x:.25,y:-.30,scale:.12,rotation:0,hidden:false},
      ] });
    } catch { if (!disposed) { q('.home-feature-art').classList.add('home-preview-unavailable'); q('.home-preview-caption').textContent = '进入工作台查看和编辑 3D 作品'; } }
  }
  refresh(); renderExample();
  return { refresh, destroy() { disposed = true; container.removeEventListener('click', onClick); container.replaceChildren(); } };
}
