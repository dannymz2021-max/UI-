export const OPENAI_IMAGE_MODEL='gpt-image-2.5-sunburst-2026-09-08';
export const OPENAI_TEXT_MODEL='gpt-6-astra';
export const ARK_IMAGE_MODEL='doubao-seedream-5-0-pro-260628';
export const ARK_TEXT_MODEL='doubao-seed-2-1-pro-260915';

export function providerConfig(env){
 const id=env.AI_PROVIDER||'openai';
 if(id==='ark')return {id,label:'豆包 · 火山方舟',key:env.ARK_API_KEY,base:'https://ark.cn-beijing.volces.com/api/v3/',imageModel:env.ARK_IMAGE_MODEL||ARK_IMAGE_MODEL,textModel:env.ARK_TEXT_MODEL||ARK_TEXT_MODEL};
 if(id==='openai')return {id,label:'OpenAI',key:env.OPENAI_API_KEY,base:'https://api.openai.com/v1/',imageModel:env.OPENAI_IMAGE_MODEL||OPENAI_IMAGE_MODEL,textModel:env.OPENAI_TEXT_MODEL||OPENAI_TEXT_MODEL};
 throw Object.assign(new Error('模型服务商配置无效，请检查后台配置。'),{code:'PROVIDER_CONFIG_INVALID',status:503});
}
export const healthOwner=(owner,provider)=>provider==='ark'?'ark:'+owner:owner;
export function providerPayload(config,path,body){
 if(config.id!=='ark')return body;
 if(path==='responses'){
  const {instructions,...rest}=body;
  return {...rest,model:config.textModel,input:[...(instructions?[{role:'system',content:instructions}]:[]),...(body.input||[])],thinking:{type:'disabled'},store:false,max_output_tokens:body.max_output_tokens||5000};
 }
 const {quality,n,user,images,...rest}=body;
 return {...rest,...(images?.length?{image:images.map(x=>x.image_url)}:{}),response_format:'b64_json',watermark:false};
}
export function validProviderSize(w,h,id='openai'){
 if(id==='ark')return Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w*h>=921600&&w*h<=4624220&&w/h>=1/16&&w/h<=16;
 return Number.isInteger(w)&&Number.isInteger(h)&&w%16===0&&h%16===0&&w>0&&h>0&&w<=3840&&h<=3840&&w/h>=1/3&&w/h<=3&&w*h>=655360&&w*h<=4194304;
}
export function classifyProviderError(status,body){
 const code=String(body?.error?.code||''),type=String(body?.error?.type||''),token=(code+' '+type).toLowerCase();
 if(status===401||/invalid.*api.*key|authenticationerror|invalidapikey/.test(token))return {code:'INVALID_API_KEY',message:'模型密钥不可用，请检查服务端配置。',status:503};
 if(type==='insufficient_quota'||/credit_balance_exhausted|insufficient_quota|billing_hard_limit_reached|billing_limit_reached|accountoverdue|insufficientbalance|insufficientquota|insufficientcredit/.test(token))return {code:'QUOTA_EXCEEDED',message:'当前模型账户的API额度或余额不足。需求已保留，请检查服务商账户。',status:402};
 if(/modelnotopen|modelnotactivated|modelnotenabled/.test(token))return {code:'MODEL_NOT_ENABLED',message:'当前模型尚未在火山方舟开通，或这把密钥未获授权。请在控制台检查模型权限。',status:503};
 if(status===403||status===404)return {code:'MODEL_ACCESS_DENIED',message:'模型项目或密钥没有所选模型的访问权限，请检查服务商控制台。',status:503};
 if(status===429)return {code:'RATE_LIMITED',message:'模型服务暂时限流，请稍后再试。',status:429};
 if(/moderation|content.?policy|content.?filter|riskcontrol/.test(token))return {code:'REQUEST_BLOCKED',message:'模型服务未接受这次需求，请调整内容后重试。',status:422};
 if(status===400)return {code:'PROVIDER_INPUT_ERROR',message:'模型未接受这次输入，请检查需求、图片或模型支持的规格。',status:422};
 return {code:'PROVIDER_ERROR',message:'模型服务暂未完成这次请求。',status:502};
}
