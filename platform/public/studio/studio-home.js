const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** A task-led entry point. All counts and draft details come from this browser. */
export function mountStudioHome(container, { onOpen, getAssetCount, getDraft } = {}) {
  let disposed = false;
  container.classList.add('studio-home');
  container.innerHTML = `<div class="home-heading"><div><p class="eyebrow">YOUR DESIGN WORKSPACE</p><h1>今天，想完成什么设计？</h1><p>从一份素材开始，让创作、调整和交付连在一起。</p></div><span class="home-version">UI工作室 7.0</span></div>
  <section class="home-feature"><div class="home-feature-copy"><span class="home-feature-kicker">AI IMAGE & ICON CREATION</span><h2>让想法，<br>成为下一张作品。</h2><p>描述需求，添加参考，交给AI理解与创作。<br>图片和Icon，一个创作台就够了。</p><div class="home-feature-actions"><button class="btn primary" data-home-view="creator">开始AI创作 <span aria-hidden="true">↗</span></button><span>支持透明 PNG 导出</span></div></div><div class="home-feature-art"><canvas class="home-3d-preview" width="700" height="390" aria-label="历史Casino图标风格示例"></canvas><span class="home-preview-caption">历史风格示例 · 非本次AI生成结果</span></div></section>
  <section class="home-tasks" aria-labelledby="home-tasks-title"><div class="home-section-title"><h2 id="home-tasks-title">选择一个起点</h2><p>每种任务都有自己的工作区</p></div><div class="home-task-grid">
    <button class="home-task" data-home-view="creator"><span class="home-task-icon" aria-hidden="true">◇</span><small>01 / 创作素材</small><h3>AI图片与Icon</h3><p>用自然语言生成图片或Icon，继续修改、保留版本，并下载PNG。</p><span class="home-task-link">进入创作 <b>↗</b></span></button>
    <button class="home-task" data-home-view="ui" data-home-mode="main"><span class="home-task-icon home-task-icon-blue" aria-hidden="true">▤</span><small>02 / 主站设计</small><h3>Megwin 主站首页</h3><p>查看真实主站原稿、修改主促销卡文案，下载完整页面包。</p><span class="home-task-link">打开主站首页 <b>↗</b></span></button>
    <button class="home-task" data-home-view="ui" data-home-mode="activity"><span class="home-task-icon home-task-icon-orange" aria-hidden="true">✦</span><small>03 / 活动设计</small><h3>Megwin 活动页面</h3><p>以新客奖励活动原稿为起点，编辑文案并检查配色模式。</p><span class="home-task-link">打开活动页面 <b>↗</b></span></button>
    <button class="home-task" data-home-view="splitter"><span class="home-task-icon home-task-icon-green" aria-hidden="true">▱</span><small>04 / 处理素材</small><h3>图片图层拆解</h3><p>上传已有图片，提取可见内容，检查选区并导出分层文件。</p><span class="home-task-link">上传并拆层 <b>↗</b></span></button>
  </div></section>
  <div class="home-bottom"><section class="home-process"><div class="home-section-title"><h2>一条完整的创作路径</h2></div><ol><li><span>1</span><div><strong>描述需求</strong><p>图片、Icon与活动视觉</p></div></li><li><span>2</span><div><strong>添加参考</strong><p>指定参考图用途</p></div></li><li><span>3</span><div><strong>生成与修改</strong><p>自然语言继续创作</p></div></li><li><span>4</span><div><strong>保存并交付</strong><p>作品库或下载文件</p></div></li></ol></section><section class="home-resume"><div class="home-section-title"><h2>继续你的工作</h2><span class="home-local-badge">当前浏览器</span></div><div class="home-draft-content"></div><button class="home-library-link" data-home-view="assets">打开我的作品 <span class="home-asset-count">—</span><b aria-hidden="true">↗</b></button></section></div>
  <div class="home-footer"><span>主站与活动分别关联 Figma 原稿，可在「组件与变量」查看读取范围。</span><button data-home-view="system">查看设计规范 ↗</button></div>`;
  const q = selector => container.querySelector(selector);
  container.addEventListener('click', onClick);
  function onClick(event) { const button = event.target.closest('[data-home-view]'); if (button && container.contains(button)) onOpen?.(button.dataset.homeView, button.dataset.homeMode); }
  async function refresh() {
    const draft = getDraft?.();
    const known = { 'coin-stack':'金币堆',chips:'赌场筹码',cards:'王牌扑克',dice:'幸运骰子','slot-machine':'老虎机',roulette:'幸运轮盘',crown:'VIP 皇冠',diamond:'切面钻石',gift:'奖励礼盒',chest:'奖励宝箱',trophy:'冠军奖杯',medal:'荣誉勋章',shield:'VIP 盾徽',wallet:'奖励钱包',football:'足球',basketball:'篮球' };
    q('.home-draft-content').innerHTML = draft && Array.isArray(draft.layers) ? `<div><span class="home-draft-label">Icon 草稿</span><strong>${escape(known[draft.subject] || '我的图标组合')}</strong><small>${Number(draft.width) || 1024} × ${Number(draft.height) || 1024} · ${draft.layers.length} 个图层 · 自动保存</small></div><button class="btn" data-home-view="creator">继续编辑 ↗</button>` : '<div><strong>从一句需求开始</strong><small>需求、参考图和生成版本会自动保存。</small></div><button class="btn" data-home-view="creator">开始创作 ↗</button>';
    try { const count = await getAssetCount?.(); if (!disposed) q('.home-asset-count').textContent = Number.isFinite(count) ? `${count} 个` : '—'; } catch { if (!disposed) q('.home-asset-count').textContent = '暂不可用'; }
  }
  async function renderExample(){const canvas=q('canvas'),image=new Image();image.onload=()=>{if(disposed)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/image.width,canvas.height/image.height)*.86,w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);};image.src='/studio/icon-samples/gold-slot.png';}
  refresh(); renderExample();
  return { refresh, destroy() { disposed = true; container.removeEventListener('click', onClick); container.replaceChildren(); } };
}
