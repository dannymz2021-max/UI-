import {extractUIJSON,assertUISelection,reviewUICopy} from '../public/studio/ui-page-schema.js';
import {reviewUIComponents} from '../public/studio/ui-page-schema-v2.js';
// A correction is a text-only request in the same explicitly authorized free
// desktop conversation. It never creates an image or switches providers.
export function ownsUIPlanMessages(texts,prompt,corrections=[],fileCount=0){
 const norm=value=>String(value||'').replace(/\s/g,''),expected=[prompt,...corrections.filter(c=>c.submitAttempted).map(c=>c.prompt)].map(norm);
 if(expected.some(t=>!t)||!Array.isArray(texts)||texts.length>expected.length+fileCount)return false;
 const indices=[];
 for(const text of texts){const value=norm(text);if(!value)continue;const matches=expected.map((t,i)=>value.includes(t)?i:-1).filter(i=>i>=0);if(matches.length!==1)return false;indices.push(matches[0]);}
 // The native conversation virtualizes older DOM rows. After a correction,
 // accept only a contiguous visible suffix ending at the latest journaled send.
 // Corrections can only be journaled after the original conversation was owned.
 return indices.length>0&&indices.every((n,i)=>n===expected.length-indices.length+i);
}
export function uiPlanCorrection(error,attempt){return `上一份方案未通过校验，这是第${attempt}次修正。校验错误：${String(error).slice(0,600)}。请在本对话中重新输出完整的 megwin-ui-v2 JSON 对象，严格保留最初PRD、参考图和所选模式/宽度；仅修正格式或补足遗漏，不能省略页面。使用清晰缩进确保大括号和方括号配对；输出后须能直接JSON.parse。每个coverage targets、导航target、按钮target都要指向实际存在的唯一key，未用target字段省略，dialog tone仅success/warning/error。筛选的全部选项value为空串，其他value与目标列显示文案一致。只返回一个json代码块，块内为合法JSON；不要用普通正文输出，避免货币字符被排版。不得在JSON字符串内部写未转义的换行。不调用绘图、搜索、视频、付费或其他工具。`;}
export function reviewDesktopUIPlan(job,reply){const plan=extractUIJSON(reply);assertUISelection(plan,job.context||{});if(plan.questions?.length)return plan;const missing=[...(plan.format==='megwin-ui-v2'?reviewUIComponents(plan,job.prompt).missing:[]),...reviewUICopy(plan,job.prompt).missing];if(missing.length)throw Error('实际页面遗漏了明确要求的组件或文案：'+missing.join('、'));return plan;}
