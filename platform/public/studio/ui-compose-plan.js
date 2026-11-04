// Only regions from the two audited source frames can become generated markup.
export const blocks = Object.freeze({
  main: Object.freeze({
    navbar:'顶部导航',sidebar:'侧边栏',banners:'横幅',leagues:'联赛', 'sports-shortcuts':'运动分类',
    'live-matches':'滚球', 'best-picks':'精选赛事',upcoming:'赛程','popular-games':'热门游戏',
    'hot-promotions':'热门活动','top-users-and-footer':'用户榜与页脚',
  }),
  activity: Object.freeze({
    navbar:'顶部导航',sidebar:'侧边栏',back:'返回入口',hero:'活动首屏',time:'活动时间',steps:'参与步骤',
    cash:'现金奖励',spin:'免费转盘',rules:'活动规则',footer:'页脚',
  }),
});
export const families = {main:'体育首页',activity:'活动页面'};
const limits={main:{title:32,subtitle:80,buttonLabel:20},activity:{title:80,subtitle:260,buttonLabel:40}};
const defaultBlocks={main:['navbar','sidebar','banners','leagues','sports-shortcuts','live-matches','upcoming'],activity:['navbar','sidebar','back','hero','time','steps','cash','rules']};
const core={main:['banners','leagues','sports-shortcuts','live-matches','best-picks','upcoming','popular-games','top-users-and-footer'],activity:['hero','time','steps','cash','spin','rules','footer']};
const synonyms={
  navbar:/顶部导航|导航栏|navbar/i,sidebar:/侧边栏|侧栏|sidebar/i,banners:/横幅|banner/i,leagues:/联赛|league/i,
  'sports-shortcuts':/运动分类|赛事分类|体育分类/,'live-matches':/滚球|直播赛事|进行中|live match/i,
  'best-picks':/精选赛事|推荐赛事|best picks/i,upcoming:/赛程|即将开赛|未来赛事|upcoming/i,
  'popular-games':/热门游戏|游戏推荐/,'hot-promotions':/热门活动|右侧活动/,'top-users-and-footer':/用户榜与页脚|排行榜|用户榜|页脚|footer/i,
  back:/返回入口|返回按钮|back button/i,hero:/活动首屏|首屏|活动横幅|hero/i,time:/活动时间|时间栏|倒计时/,
  steps:/参与步骤|活动步骤|步骤|steps/i,cash:/现金奖励|现金|cash/i,spin:/免费转盘|转盘|抽奖|free spin/i,
  rules:/活动规则|规则|条款|rules/i,footer:/页脚|footer/i,
};
export const uiPlanSchema={type:'object',additionalProperties:false,properties:{
  family:{type:'string',enum:Object.keys(blocks)},mode:{type:'string',enum:['dark','light']},
  regions:{type:'array',items:{type:'string',enum:[...new Set(Object.values(blocks).flatMap(Object.keys))]}},
  title:{type:'string'},subtitle:{type:'string'},buttonLabel:{type:'string'},
  gaps:{type:'array',items:{type:'string'}},
},required:['family','mode','regions','title','subtitle','buttonLabel','gaps']};

export function validateUIPlan(raw,{family='auto',mode='auto',engine='local'}={}){
  if(!raw||!Object.hasOwn(blocks,raw.family)||(family!=='auto'&&family!==raw.family))throw new Error('页面类型与所选原稿不符。');
  if(!['light','dark'].includes(raw.mode)||(mode!=='auto'&&mode!==raw.mode))throw new Error('变量模式与所选项不符。');
  if(!Array.isArray(raw.regions)||!raw.regions.length||raw.regions.some(id=>!Object.hasOwn(blocks[raw.family],id))||new Set(raw.regions).size!==raw.regions.length)throw new Error('方案引用了未知或重复的区块。');
  if(!raw.regions.some(id=>core[raw.family].includes(id)))throw new Error('请至少保留一个主体区块。');
  if(!Array.isArray(raw.gaps)||raw.gaps.some(x=>typeof x!=='string'))throw new Error('方案缺少需求检查。');
  const copy={},gaps=raw.gaps.slice(0,25).map(s=>s.slice(0,500));
  const textRegion=raw.family==='main'?'banners':'hero';
  for(const [key,max] of Object.entries(limits[raw.family])){
    if(typeof raw[key]!=='string')throw new Error('文案格式不完整。');
    const v=raw[key].trim();
    if(v&&!raw.regions.includes(textRegion))gaps.push('首屏区块未选用，未应用首屏文案：'+v.slice(0,100));
    else if(v.length>max)gaps.push(`${{title:'标题',subtitle:'副标题',buttonLabel:'按钮'}[key]}超过原区块的 ${max} 字限制，保留原稿文案。`);
    else if(v)copy[key]=v;
  }
  return {family:raw.family,mode:raw.mode,regions:raw.regions.slice(),copy,gaps:[...new Set(gaps)],engine};
}

const copyFields={'标题':'title','副标题':'subtitle','按钮':'buttonLabel','按钮文字':'buttonLabel','按钮文案':'buttonLabel','title':'title','subtitle':'subtitle','cta':'buttonLabel'};
const layoutFields=/^(区块|结构|页面结构|保留|去掉|隐藏|不要|删除|排除|主题|模式|页面类型|类型|sections|theme)\s*[:：]/i;
const split=s=>s.split(/[、，,；;＞>→|]/).map(x=>x.trim()).filter(Boolean);
const idsFor=(family,phrase)=>Object.keys(blocks[family]).filter(id=>phrase.toLowerCase()===id||phrase===blocks[family][id]||synonyms[id]?.test(phrase));

export function planLocally(prompt,{family='auto',mode='auto',hasReference=false}={}){
  const lines=String(prompt).split(/\r?\n/).map(x=>x.replace(/^\s*(?:#{1,6}\s+|[-*]\s+)/,'').trim()).filter(Boolean);
  if(!lines.length)throw new Error('先输入需求或导入 PRD。');
  const content=lines.filter(x=>!Object.hasOwn(copyFields,x.split(/[:：]/,1)[0].trim().toLowerCase())).join('\n');
  const matchesActivity=/活动页|促销|欢迎奖励|新客|首充|转盘|活动首屏|活动规则|campaign|promotion/i.test(content);
  const matchesMain=/体育|赛事|赛程|滚球|联赛|sports/i.test(content);
  const explicitFamily=content.match(/(?:^|\n)(?:页面类型|类型)\s*[:：]\s*(体育首页|活动页面|活动页|main|activity)\s*(?:\n|$)/i)?.[1];
  const inferred=explicitFamily?(/体育|main/i.test(explicitFamily)?'main':'activity'):matchesActivity&&!matchesMain?'activity':'main';
  if(!Object.hasOwn(blocks,family)&&family!=='auto')throw new Error('未知页面类型。');
  const chosen=family==='auto'?inferred:family,gaps=[];
  const modeHint=content.match(/(?:^|\n)(?:主题|模式|theme)\s*[:：]\s*(浅色|亮色|白天|深色|暗色|夜间|dark|light)/i)?.[1];
  const wantsLight=/浅色|亮色|白天|\blight\b/i.test(modeHint||content);
  const wantsDark=/深色|暗色|夜间|\bdark\b/i.test(modeHint||content);
  if(family==='auto'&&!explicitFamily&&matchesActivity===matchesMain)gaps.push(matchesActivity?'需求同时涉及两类原稿；本地先按体育首页生成，请确认页面类型。':'未识别到明确的页面类型；本地先按体育首页生成，请确认。');
  if(family!=='auto'&&explicitFamily&&inferred!==chosen)gaps.push('PRD 的页面类型与当前选择不同，已使用当前选择。');
  if(mode==='auto'&&wantsLight&&wantsDark)gaps.push('同时出现浅色和深色要求，请确认模式。');
  if(mode!=='auto'&&(mode==='dark'?wantsLight:wantsDark))gaps.push('PRD 的主题与当前选择不同，已使用当前选择。');
  if(hasReference)gaps.push('参考图只供对照；本地解析不读取图中内容。');
  const raw={family:chosen,mode:mode==='auto'?(wantsLight&&!wantsDark?'light':'dark'):mode,title:'',subtitle:'',buttonLabel:'',gaps};
  const selected=[],removed=new Set();let explicit=false,limited=false;
  const add=(list,id)=>{if(!list.includes(id))list.push(id);};
  for(const line of lines){
    const field=line.match(/^([^:：]{1,16})\s*[:：]\s*(.*)$/);
    const label=field?.[1].trim().toLowerCase();
    if(label&&Object.hasOwn(copyFields,label)){raw[copyFields[label]]=field[2];continue;}
    if(field&&layoutFields.test(line)){
      if(/^(主题|模式|页面类型|类型|theme)$/.test(label)){
        if(!/^(浅色|亮色|白天|深色|暗色|夜间|dark|light|体育首页|活动页面|活动页|main|activity)$/i.test(field[2].trim()))gaps.push('需确认：'+line);
        continue;
      }
      const exclude=/去掉|隐藏|不要|删除|排除/.test(label);
      if(!exclude)explicit=true;
      for(const part of split(field[2])){const ids=idsFor(chosen,part);if(!ids.length)gaps.push('没有已验证的对应区块：'+part);else ids.forEach(id=>exclude?removed.add(id):add(selected,id));}
      continue;
    }
    for(const sentence of line.split(/[。；;！？]/).filter(Boolean)){
      const negative=sentence.match(/(?:不需要|不要|不展示|隐藏|去掉|不显示|删除|排除)(.+)$/);
      const positive=negative?sentence.slice(0,negative.index):sentence;
      const only=positive.match(/(?:只要|只保留|只展示|仅保留|仅展示)(.+)$/);
      if(only)limited=true;
      const ids=split(only?.[1]??positive).flatMap(part=>idsFor(chosen,part));
      ids.forEach(id=>add(selected,id));
      if(negative)idsFor(chosen,negative[1]).forEach(id=>removed.add(id));
      gaps.push('原话待核对：'+sentence.trim());
    }
  }
  const regionList=explicit||limited?selected:[...new Set([...defaultBlocks[chosen],...selected])];
  raw.regions=regionList.filter(id=>!removed.has(id));
  return validateUIPlan(raw,{family,mode});
}
