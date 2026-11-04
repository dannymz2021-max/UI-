import { blocks, families, planLocally } from './ui-compose-plan.js';
import { renderComposedUI } from './ui-compose-render.js';

const sample='页面类型：活动页\n主题：深色\n区块：顶部导航、侧边栏、活动首屏、参与步骤、活动规则\n标题：Bienvenido a Megwin\n副标题：Conoce los pasos para participar.\n按钮：Ver más';
const fileDataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('参考图读取失败。'));reader.readAsDataURL(file);});
function save(content,type,name){
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mountUIComposer(root,{requestCompose,getServiceStatus}={}){
  root.innerHTML=`<div class="ui-compose-grid">
    <section class="ui-compose-card">
      <p class="ui-compose-kicker">MEGWIN 设计系统</p><h2>按需求生成页面</h2>
      <p class="ui-compose-muted">用你的原稿区块搭页面。粘贴需求、导入 PRD，或上传样例图作为参考。</p>
      <form class="ui-compose-form">
        <label>页面需求<textarea data-brief maxlength="12000" rows="8" placeholder="例如：体育首页，展示顶部导航、联赛、滚球和赛程；浅色。\n需要精确控制时，可按「区块：」「标题：」「按钮：」逐行填写。"></textarea></label>
        <div class="ui-compose-actions"><button type="button" data-sample class="btn subtle">填入活动页样例</button><label class="btn subtle ui-compose-file">导入 PRD<input type="file" data-prd accept=".md,.txt,.markdown,text/plain,text/markdown" aria-label="导入 Markdown 或 TXT PRD"></label></div>
        <div class="ui-compose-selects"><label>页面类型<select data-family><option value="auto">自动识别</option><option value="main">体育首页</option><option value="activity">活动页面</option></select></label><label>变量模式<select data-mode><option value="auto">按需求</option><option value="dark">深色</option><option value="light">浅色</option></select></label></div>
        <label class="ui-compose-reference">参考图 <span>可选 · PNG / JPEG / WebP，最多 5 MB</span><input type="file" data-reference accept="image/png,image/jpeg,image/webp"></label>
        <div class="ui-compose-reference-preview" data-reference-preview hidden><img alt="本次参考图"><button type="button" class="btn subtle" data-remove>移除参考图</button></div>
        <div class="ui-compose-actions"><button type="submit" class="btn primary" data-generate>生成页面</button><button type="button" class="btn subtle" data-ai>用 AI 解读</button></div>
        <p class="ui-compose-muted" data-engine></p><p class="ui-compose-status" role="status" aria-live="polite"></p>
      </form>
    </section>
    <section class="ui-compose-card ui-compose-output">
      <div class="ui-compose-output-head"><div><p class="ui-compose-kicker">1600 PX · 桌面</p><h2>页面预览</h2></div><div class="ui-compose-actions"><button class="btn subtle" data-manifest disabled>来源清单</button><button class="btn primary" data-download disabled>下载 HTML</button></div></div>
      <div class="ui-compose-stage"><p data-empty>生成后，在这里查看页面。你的 Figma 原稿保留在上方标签里。</p><div class="ui-compose-scaled" hidden><iframe title="生成的 Megwin 页面" sandbox="allow-same-origin"></iframe></div></div>
      <div class="ui-compose-result" hidden><p data-result></p><a data-source target="_blank" rel="noopener noreferrer">查看 Figma 原稿 ↗</a><ul data-blocks class="ui-compose-blocks" aria-label="已用区块"></ul><details data-review open><summary>交付前核对</summary><ul data-gaps></ul></details></div>
    </section></div>`;
  const q=s=>root.querySelector(s),form=q('form'),status=q('[role=status]'),frame=q('iframe'),stage=q('.ui-compose-stage'),scaled=q('.ui-compose-scaled');
  let reference=null,referenceUrl=null,latest=null,busy=false,destroyed=false,revision=0;
  const feedback=message=>{status.textContent=message;};
  const state=()=>{
    const ready=!!getServiceStatus?.().uiComposeReady;
    q('[data-ai]').disabled=!ready||busy;
    q('[data-engine]').textContent=ready?'本地生成按原稿区块匹配。AI 可解读自然语言和参考图，会将本次输入发给 OpenAI。':'当前可按文字和 PRD 本地生成。AI 服务未就绪，参考图可用于人工对照。';
    q('[data-generate]').disabled=busy;
  };
  function fit(){
    if(scaled.hidden||destroyed)return;
    const w=stage.clientWidth;if(!w)return;
    const ratio=Math.min(1,w/1600);
    let height=0;try{height=frame.contentDocument?.querySelector('main')?.getBoundingClientRect().height||0;}catch{}
    frame.style.height=`${Math.max(320,height)}px`;frame.style.transform=`scale(${ratio})`;scaled.style.height=`${Math.max(320,height)*ratio}px`;
  }
  const resize=new ResizeObserver(fit);resize.observe(stage);
  frame.addEventListener('load',()=>{fit();frame.contentDocument?.fonts?.ready.then(fit).catch(()=>{});});
  function markChanged(){revision++;if(latest)feedback('输入有改动；请重新生成后再导出。');q('[data-download]').disabled=true;q('[data-manifest]').disabled=true;}
  function list(selector,values){q(selector).replaceChildren(...values.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));}
  function reveal(plan,result){
    latest={plan,...result};frame.srcdoc=result.html;stage.scrollTop=0;q('[data-empty]').hidden=true;scaled.hidden=false;
    q('.ui-compose-result').hidden=false;
    q('[data-result]').textContent=`${families[plan.family]} · ${plan.mode==='light'?'浅色':'深色'}变量 · ${plan.engine==='ai'?'AI 解读':'本地匹配'} · ${result.provenance.regions.length} 个原稿区块`;
    q('[data-source]').href=result.provenance.browseUrl;
    q('[data-source]').textContent=plan.family==='activity'?'查看 Figma 活动区 ↗':'查看 Figma 原稿 ↗';
    list('[data-blocks]',result.provenance.regions.map(({key,nodeId})=>`${blocks[plan.family][key]} · ${nodeId}`));
    list('[data-gaps]',[...plan.gaps,'原稿示例文字、比赛和奖励数值不代表真实数据。请核对后再使用。','输出为桌面 HTML 原型；导航、活动和比赛不连接业务数据。',...(plan.family==='activity'?['活动区块使用已归档原稿；Figma 旧画板节点已变更，来源链接可查看现版活动区。']:[]),...(plan.mode==='light'?['浅色变量已切换；原稿插画和内嵌图形可能保持原色。']:[])]);
    q('[data-download]').disabled=false;q('[data-manifest]').disabled=false;
  }
  async function generate(engine){
    if(busy||destroyed)return;
    const prompt=q('[data-brief]').value.trim(),family=q('[data-family]').value,mode=q('[data-mode]').value;
    if(!prompt&&!(engine==='ai'&&reference)){feedback('先输入需求或导入 PRD。');return;}
    const seq=++revision;busy=true;state();q('[data-download]').disabled=true;q('[data-manifest]').disabled=true;
    feedback(engine==='ai'?'正在解读需求和参考图…':'正在组装原稿区块…');
    try{
      const input={prompt,family,mode,...(reference&&engine==='ai'?{referenceDataUrl:await fileDataUrl(reference)}:{})};
      const plan=engine==='ai'?await requestCompose(input):planLocally(prompt,{family,mode,hasReference:!!reference});
      const result=await renderComposedUI(plan);
      if(destroyed||revision!==seq)return;
      reveal(plan,result);feedback(plan.gaps.length?'已生成草稿；请查看待核对事项。':'页面已生成，可以预览或下载。');
    }catch(error){if(!destroyed&&revision===seq)feedback(error.message);}
    finally{busy=false;if(!destroyed)state();}
  }
  form.onsubmit=e=>{e.preventDefault();generate('local');};
  q('[data-ai]').onclick=()=>generate('ai');
  q('[data-brief]').oninput=markChanged;q('[data-family]').onchange=markChanged;q('[data-mode]').onchange=markChanged;
  q('[data-sample]').onclick=()=>{q('[data-brief]').value=sample;q('[data-family]').value='auto';q('[data-mode]').value='auto';markChanged();q('[data-brief]').focus();};
  q('[data-prd]').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{
      if(!/\.(txt|md|markdown)$/i.test(f.name)||f.size>48000)throw new Error('请选择 12,000 字以内的 TXT 或 Markdown PRD。');
      const value=await f.text();if(value.length>12000||value.includes('\u0000'))throw new Error('文档太长或不是有效的文本。');
      if(destroyed)return;q('[data-brief]').value=value;markChanged();feedback(`已导入 ${f.name}。`);
    }catch(error){feedback(error.message);}
  };
  function setReference(f){
    if(referenceUrl)URL.revokeObjectURL(referenceUrl);
    reference=f;referenceUrl=f?URL.createObjectURL(f):null;
    const preview=q('[data-reference-preview]'),img=preview.querySelector('img');
    preview.hidden=!f;if(f)img.src=referenceUrl;else img.removeAttribute('src');
    markChanged();
  }
  q('[data-reference]').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    if(!/^image\/(png|jpeg|webp)$/.test(f.type)||!f.size||f.size>5*1024*1024){e.target.value='';setReference(null);feedback('请选择不超过 5 MB 的 PNG、JPEG 或 WebP。');return;}
    setReference(f);
  };
  q('[data-remove]').onclick=()=>{q('[data-reference]').value='';setReference(null);};
  q('[data-manifest]').onclick=()=>{if(latest)save(JSON.stringify(latest.provenance,null,2),'application/json','megwin-ui-sources.json');};
  q('[data-download]').onclick=async()=>{
    if(!latest)return;
    const seq=revision,button=q('[data-download]');button.disabled=true;feedback('正在打包原稿图片与字体…');
    try{const {html}=await renderComposedUI(latest.plan,{embedAssets:true});if(!destroyed&&revision===seq){save(html,'text/html;charset=utf-8',`megwin-${latest.plan.family}.html`);feedback('已导出可离线打开的 HTML。');}}
    catch(error){if(!destroyed&&revision===seq)feedback(error.message);}
    finally{if(!destroyed&&revision===seq)button.disabled=false;}
  };
  state();
  return {refresh(){state();fit();},generate:()=>generate('local'),getConfig:()=>latest?.plan||{},destroy(){destroyed=true;resize.disconnect();if(referenceUrl)URL.revokeObjectURL(referenceUrl);root.replaceChildren();}};
}
