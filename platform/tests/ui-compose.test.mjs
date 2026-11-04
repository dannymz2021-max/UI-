import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blocks, planLocally, validateUIPlan} from '../public/studio/ui-compose-plan.js';

test('两种需求生成不同的原稿区块、顺序、模式和文案，未知项须报告',()=>{
  const main=planLocally('体育首页\n主题：浅色\n区块：联赛、赛程、滚球、余额统计\n去掉：滚球');
  assert.deepEqual(main.regions,['leagues','upcoming']);assert.equal(main.mode,'light');assert.equal(main.family,'main');
  assert.ok(main.gaps.some(x=>x.includes('余额统计')));
  const activity=planLocally('页面类型：活动页\n区块：活动首屏、参与步骤、活动规则\n标题：Bienvenido\n按钮：Ver más',{hasReference:true});
  assert.deepEqual(activity.regions,['hero','steps','rules']);assert.equal(activity.family,'activity');
  assert.equal(activity.copy.title,'Bienvenido');assert.ok(activity.gaps.some(x=>x.includes('对照')));
});
test('自然语言中的只保留限制不添加默认区块',()=>{
  const plan=planLocally('体育首页只保留赛程、联赛，不要侧栏。');
  assert.deepEqual(plan.regions,['upcoming','leagues']);
});
test('所有允许生成的区块存在于对应的原稿清单，禁止跨原稿或未知区块',()=>{
  const paths={main:'figma-main-assets/main-manifest.json',activity:'figma-assets/activity-manifest.json'};
  for(const [family,path] of Object.entries(paths)){
    const source=JSON.parse(fs.readFileSync(new URL('../public/studio/'+path,import.meta.url),'utf8'));
    assert.equal(Object.keys(blocks[family]).every(id=>source.regions.some(r=>r.key===id&&r.nodeId)),true);
  }
  const raw={family:'main',mode:'dark',regions:['hero'],gaps:[],title:'',subtitle:'',buttonLabel:''};
  assert.throws(()=>validateUIPlan(raw),/未知/);
  assert.throws(()=>validateUIPlan({...raw,regions:['leagues','leagues']}),/重复/);
  assert.throws(()=>validateUIPlan({...raw,regions:['leagues']},{mode:'light'}),/模式/);
});
