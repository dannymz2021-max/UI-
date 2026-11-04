import { loadMainFigmaPage, renderMainFigmaHTML } from './figma-main-page.js';
import { loadFigmaPage, renderFigmaHTML } from './figma-page.js';
import { validateUIPlan } from './ui-compose-plan.js';

const node=(doc,id)=>doc.querySelector(`[data-node-id="${id}"]`);
function expect(el){if(!el)throw new Error('原稿中的区块已缺失，已停止生成。');return el;}
const mainSpecial={sidebar:'2257:589306','hot-promotions':'2257:589441'};
function composeMain(doc,manifest,regions){
  const column=expect(node(doc,'2257:589310')),shell=expect(node(doc,'2257:589305'));
  const lookup=new Map(manifest.regions.map(r=>[r.key,r]));
  const ordered=regions.map(key=>[key,expect(node(doc,mainSpecial[key]||lookup.get(key)?.nodeId))]);
  for(const key of ['navbar','sidebar','hot-promotions'])if(!regions.includes(key))expect(node(doc,mainSpecial[key]||lookup.get(key).nodeId)).remove();
  if(!regions.includes('navbar'))node(doc,'5529:785678')?.remove();
  column.replaceChildren(...ordered.filter(([,el])=>el.parentElement===column).map(([,el])=>el));
  const hasSide=regions.includes('sidebar'),hasAside=regions.includes('hot-promotions');
  shell.style.justifyContent=hasSide&&hasAside?'flex-start':'center';
  const wrapper=expect(node(doc,'2257:589309'));
  wrapper.style.flex='0 0 960px';
  // The original column scroll indicator is a decorative crop; short pages do not need it.
  if(regions.length<7)wrapper.querySelector(':scope > [id="node-954_239698"]')?.remove();
  column.style.flex='0 0 948px';
  return '.figma-main-artboard{height:auto;min-height:320px}';
}

function composeActivity(doc,manifest,regions){
  const artboard=expect(doc.querySelector('.figma-artboard'));
  const lookup=new Map(manifest.regions.map(r=>[r.key,r]));
  const selected=new Set(regions),nodes=new Map([...doc.querySelectorAll('.figma-region')].map(el=>[el.dataset.region,el]));
  const side=selected.has('sidebar'),nav=selected.has('navbar'),left=side?276:144;
  const order=regions.filter(x=>x!=='navbar'&&x!=='sidebar');
  let y=nav?108:12,sideBottom=0;
  function place(key,x,top){
    const el=expect(nodes.get(key));
    el.style.left=`${x}px`;el.style.top=`${top}px`;artboard.append(el);
    return lookup.get(key).height;
  }
  if(nav)place('navbar',0,0);
  if(side){const top=y;sideBottom=top+place('sidebar',12,top);place('sidebar-scrollbar',256,top);}
  for(let i=0;i<order.length;i++){
    const key=order[i],next=order[i+1];
    if((key==='cash'&&next==='spin')||(key==='spin'&&next==='cash')){
      const a=place(key,key==='cash'?left:left+812,y);
      const b=place(next,next==='cash'?left:left+812,y);
      y+=Math.max(a,b)+16;i++;
    }else y+=place(key,left,y)+16;
  }
  for(const [key,el] of nodes)if(!selected.has(key)&&!(key==='sidebar-scrollbar'&&side))el.remove();
  return `.figma-artboard{height:${Math.max(320,y,sideBottom+12)}px}`;
}

export async function renderComposedUI(plan,{embedAssets=false}={}){
  const validated=validateUIPlan({...plan,title:plan.copy?.title||'',subtitle:plan.copy?.subtitle||'',buttonLabel:plan.copy?.buttonLabel||''});
  const isMain=validated.family==='main';
  const {manifest}=await (isMain?loadMainFigmaPage():loadFigmaPage());
  const entries=validated.regions.map(key=>manifest.regions.find(x=>x.key===key));
  if(entries.some(x=>!x))throw new Error('生成方案缺少原稿来源，已停止生成。');
  const provenance={
    format:'megwin-source-composition',engine:plan.engine,mode:validated.mode,
    themeModeIds:manifest.themeModeIds,sourceUrl:manifest.sourceUrl,fileKey:manifest.fileKey,
    browseUrl:isMain?manifest.sourceUrl:'https://www.figma.com/design/2EBmHXzEU62LfXXaE1CEza/Megwin?node-id=10002-56583',
    frameNodeId:manifest.nodeId,capturedAt:manifest.capturedAt,variableCount:manifest.variableCount,desktopOnly:true,
    regions:entries.map(({key,nodeId})=>({key,nodeId})),copy:validated.copy,gaps:validated.gaps,
  };
  const html=await (isMain?renderMainFigmaHTML:renderFigmaHTML)({
    ...validated.copy,mode:validated.mode,embedAssets,compositionMeta:provenance,
    compose(body,css){
      const doc=new DOMParser().parseFromString(body,'text/html');
      const layout=(isMain?composeMain:composeActivity)(doc,manifest,validated.regions);
      return {body:doc.body.innerHTML,css:css+'\nhtml,body{height:auto;min-height:0}\n'+layout};
    },
  });
  return {html,provenance};
}
