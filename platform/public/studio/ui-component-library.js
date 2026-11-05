// Executable mappings, verified against high-fidelity Figma component contexts.
// Catalog-only entries in megwin-audit.json are deliberately not executable.
const fileKey='ZFDvXEgggNZ49dZU7hmSLP';
const entry=(name,nodeId,extra={})=>({name,fileKey,nodeId,...extra});
export const UI_COMPONENTS=Object.freeze({
 button:entry('Common buttons','66:7883',{label:'按钮',variants:{filled:'66:7883',secondary:'238:4650',outlined:'66:8038',ghost:'66:8050'}}),
 input:entry('Input-web','66:4266',{label:'输入框'}),
 select:entry('Select-web','74:8637',{label:'下拉选择',variants:{dark:'74:8637',light:'725:33814'}}),
 checkbox:entry('Check box','66:6138',{label:'复选框',variants:{dark:'66:6138',checked:'66:6145',light:'272:12290',lightChecked:'272:12294',disabled:'66:6142'}}),
 radio:entry('Radio box','75:2565',{label:'单选框',variants:{dark:'75:2565',checked:'75:2567',light:'272:11486',lightChecked:'272:11488',disabled:'75:2569'}}),
 switch:entry('switch','1187:475551',{label:'开关',variants:{on:'1187:475551',off:'1187:475553'}}),
 tabs:entry('Underline Button','892:112629',{label:'标签页',setNodeId:'892:112608',variants:{default:'892:112629',selected:'892:112633'}}),
 navigation:entry('Matches button','617:44554',{label:'导航菜单',variants:{dark:'617:44554',selected:'617:44564',light:'634:16966',lightSelected:'634:16991'},adaptations:['数据驱动菜单项；可选图标槽位；手机横向菜单']}),
 navbar:entry('Web Navbar','614:20706',{label:'顶部导航栏',variants:{dark:'614:20706',light:'884:238197'},adaptations:['按需求提供菜单与账户文案；可选顶部工具栏；手机换行']}),
 table:entry('表格','981:410032',{label:'数据表格',adaptations:['列与行来自需求数据；容器内横向滚动；本地筛选、排序和分页']}),
 pagination:entry('Pagination','1358:621211',{label:'分页',variants:{default:'1358:621211',selected:'1358:621215'}}),
 accordion:entry('FAQ','977:403861',{label:'FAQ 折叠区',variants:{closed:'977:403861',open:'977:403865'}}),
 panel:entry('展開面板','1320:486701',{label:'表单与内容面板',adaptations:['内容槽位支持用户组件组合；可收起']}),
 alert:entry('Toaster','73:2959',{label:'提示信息',variants:{info:'73:2959',success:'73:2960',warning:'73:2961',error:'73:2962',infoLight:'272:12725',successLight:'272:12728',warningLight:'272:12871',errorLight:'272:12874'}}),
 progress:entry('ground-progress','103:2639',{label:'进度条',variants:{dark:'103:2639',light:'103:2657'}}),
 badge:entry('match status','916:240423',{label:'状态标签',variants:{pending:'916:240423',success:'916:240422',error:'916:240405',live:'884:220402'}}),
 dialog:entry('Popup-dialogue','103:2074',{label:'弹窗',variants:{success:'103:2073',warning:'103:2074',error:'103:2075',successLight:'272:12923',warningLight:'272:12935',errorLight:'272:12929'},adaptations:['标题、正文、操作和内容槽位；原型内打开与关闭']}),
 empty:entry('缺省说明','1060:727488',{label:'空状态',adaptations:['保留原稿赛事插画；文案可改']}),
 caption:entry('Caption text','66:4475',{label:'字段提示',variants:{info:'66:4475',error:'66:4493',success:'66:4499',infoLight:'272:7837',errorLight:'272:7742',successLight:'272:7660'}}),
});
export const COMPONENT_LIBRARY_VERSION='megwin-components-v2';
export const A=id=>'/studio/components-assets/'+id;
export const COMPONENT_ASSETS=Object.freeze({
 checkDark:A('4ea0f612-8243-4aea-9223-835cf9402f1d.svg'),checkLight:A('4064604d-23db-4a36-9aa0-dc1e1f9bad65.svg'),
 switchOn:A('926b942d-9733-40be-818e-642a9a181cde.svg'),switchOff:A('7ce953f9-e25d-4b3b-8556-5e2082f30286.svg'),
 selectDark:A('c9b764b7-6ec6-4c89-aa00-1f00cad34aa3.svg'),selectLight:A('b7a922ba-bf8f-4ccf-8ed3-80cce89e30fc.svg'),
 faqDown:A('28852073-9c42-47a2-be2f-94499607a091.svg'),faqUp:A('da013c72-a2cb-445b-9f29-3f9c026e7430.svg'),
 panelUp:A('9dc937ae-df33-48e3-96e8-cb7c45e798d1.svg'),
 info:A('972d5826-4560-44b2-8930-6558a8fe3e31.svg'),success:A('20375de4-6e5b-4aca-b0d0-554da96954c6.svg'),warning:A('381109e8-bebd-4202-936f-f6afa9dd225a.svg'),error:A('06d60483-a669-4ffe-a57c-3bc405bf43a1.svg'),
 infoLight:A('b95e2ee4-122b-450a-acf9-9304ac1ba404.svg'),successLight:A('8377c54c-4267-4276-a8ad-784d0bbe0921.svg'),warningLight:A('58de23ec-8893-490b-a22a-117edaaa2792.svg'),errorLight:A('5ce1bdc7-8a02-49f5-825b-138cd286faef.svg'),
 captionInfo:A('e1f2a57e-ab29-4138-a104-e85200a0e6a7.svg'),captionSuccess:A('617b7746-ac52-4618-af61-d74ddd5a3d1c.svg'),captionError:A('412627d7-d374-48e8-9ffb-2f3b56f0f2d7.svg'),
 captionInfoLight:A('16c123eb-3006-4baa-abcc-0a078b9c6593.svg'),captionSuccessLight:A('f6087a0c-616d-49be-9a44-9be419bc913f.svg'),captionErrorLight:A('0e3485cd-1804-48fd-a88a-72a7bc7d252e.svg'),
 close:A('8d8b89d9-1811-498b-9fc8-872a3193498c.svg'),modalIcon:A('a40062aa-e7c5-4858-a3d8-7183d1b32c2b.svg'),empty:A('0421d40a-d701-466c-b402-db55f30ac8e9.png'),
 dialogSuccess:A('345a1ad0-9650-41e8-bec7-a6e47ed23a09.svg'),dialogWarning:A('25e5d691-7b47-4265-80a6-d3ba21472a11.svg'),dialogError:A('2984f441-0a2c-467a-9255-ec634e5d8c41.svg'),dialogSuccessClose:A('d74693e8-a733-4d8a-878d-60991b678481.svg'),dialogWarningClose:A('099a4721-0d89-465b-8f9e-3d9bc8e0c1e4.svg'),dialogErrorClose:A('cebd9ebd-c895-41d5-950d-334db9edd384.svg'),
 dialogSuccessLight:A('a2883622-ab57-450b-96de-102a63261933.svg'),dialogWarningLight:A('2c41e8fb-b67e-4a68-8da1-852d3eda3822.svg'),dialogErrorLight:A('ed5af76c-d1b7-4911-82ce-3b1791837016.svg'),dialogSuccessCloseLight:A('f740c9d2-a6b9-4659-bcee-1f02ee4c056a.svg'),dialogWarningCloseLight:A('d0843753-6748-4ef7-bba5-0adfe027a074.svg'),dialogErrorCloseLight:A('f1132075-b7ef-41a4-8f87-61d2a202b23c.svg'),
 logoDark:A('9da211ca-6848-4288-82d9-401e205db1e7.svg'),logoLight:A('1be26941-2a98-4a61-b617-b36d80c5a996.svg'),
 menuDark:A('9f9a6914-ff4f-4062-9150-fc8c6e216c90.svg'),menuLight:A('11478ff2-129f-4aa8-8502-30188a58c426.svg'),
 avatarDark:A('b95c70a1-545b-45a9-879b-3ae4f4c2e47f.svg'),avatarLight:A('83b386b5-dbd1-44f9-b6d4-ef98f7b41fd1.svg'),
 inPlay:A('3fcd3ef4-ed4d-4f4b-9b38-dc4aed652bf2.svg'),inPlaySelected:A('c22b822b-5144-497e-a3d9-73f318cd3c31.svg'),inPlayLight:A('fe70e297-6212-4989-8a7a-4976eb5469b6.svg'),inPlayLightSelected:A('54615ada-e87e-40d4-9043-c643a56f6b7c.svg'),
 home:A('5ee2a8e9-8b56-4a7a-835b-1d6ba954d305.svg'),user:A('5b8836c8-9b59-440e-9f64-6ad373ca2ad3.svg'),settings:A('bc826793-7980-4445-a019-9238e1ee654f.svg'),notification:A('5e8016da-861f-48cb-b264-afad5d86d939.svg'),search:A('87c81176-b729-478f-b5af-47b876d041d5.svg'),support:A('c5544fa3-6c42-4a10-bc67-d83d687c93ef.svg'),history:A('71ff2237-7b46-4999-b132-1b733ee05486.svg'),promotion:A('57f35bd9-7414-4994-837b-37fe2679134e.svg'),
});
export const UI_ICON_NAMES=Object.freeze(['none','home','user','settings','notification','search','support','history','promotion','in-play']);
export function uiChildren(n){return [...(n.children||[]),...(n.header||[]),...(n.sidebar||[]),...(n.items||[]).flatMap(i=>i.children||[]),...(n.rows||[]).flat().filter(c=>c&&typeof c==='object')];}
