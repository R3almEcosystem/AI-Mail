const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const load=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');const message=uid=>({uid,sender:'Example',senderEmail:'a@example.com',subject:'Message '+uid,preview:'preview',receivedAt:'2026-09-25T12:00:00Z',unread:false,flagged:false,priority:'normal',category:'General'});
function fixture(openai=true){
 const state=['inbox',[message(1),message(2)],message(1),{openai,authentication:true,mode:'live'},false,'all','','',false,false,false,[],[],'',false,false];
 const refs=[];let cursor=0,refCursor=0;
 const react={useState:init=>{const i=cursor++;if(!(i in state))state[i]=typeof init==='function'?init():init;return[state[i],update=>{state[i]=typeof update==='function'?update(state[i]):update;}];},useRef:init=>{const i=refCursor++;return refs[i]??(refs[i]={current:init});},useCallback:fn=>fn,useMemo:fn=>fn(),useEffect(){}};
 const modules={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'lucide-react':new Proxy({},{get:(_,key)=>key}),'@/lib/alerts':{initialAlerts:[]},'@/lib/web-path':{webPath:value=>value}};
 for(const [file,names] of Object.entries({'compose-modal':['ComposeModal'],'alerts-panel':['AlertsPanel'],'inbox-workspace':['InboxWorkspace'],'overview-view':['OverviewView'],sidebar:['Sidebar'],'settings-views':['AccountsView','AiRulesView','SettingsView']}))modules['@/components/'+file]=Object.fromEntries(names.map(name=>[name,name]));
 const {MailDashboard}=load(path.join(root,'src/components/mail-dashboard.tsx'),modules);
 function find(node){if(!node||typeof node!=='object')return null;if(node.type==='InboxWorkspace')return node.props;for(const child of [node.props?.children].flat(Infinity)){const value=find(child);if(value)return value;}return null;}
 return{state,render:()=>{cursor=0;refCursor=0;return find(MailDashboard({initialUser:{id:'test',name:'Tester',role:'member',demo:false}}));}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('unconfigured AI does not hide security inspection by labeling live mail as demo',()=>assert.equal(fixture(false).render().demo,false));
test('out-of-order message loads cannot overwrite the current selection',async()=>{
 const f=fixture(),props=f.render(),pending={};const original=global.fetch;
 global.fetch=url=>new Promise(resolve=>{pending[url]=resolve;});
 try{props.onSelect(message(1));props.onSelect(message(2));pending['/api/mail/2'](Response.json({message:{...message(2),body:'second'}}));await flush();pending['/api/mail/1'](Response.json({message:{...message(1),body:'first'}}));await flush();assert.equal(f.state[2].uid,2);}finally{global.fetch=original;}
});
test('AI requests carry a UID, never browser-supplied email content',async()=>{
 const f=fixture();let payload;const original=global.fetch;global.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({uid:1,text:'summary',demo:false});};
 try{f.render().onAiAction('summarize');await flush();assert.deepEqual(payload,{action:'summarize',uid:1});}finally{global.fetch=original;}
});
test('an old AI response cannot appear against a newly selected email',async()=>{
 const f=fixture(),props=f.render();let resolve;const original=global.fetch;global.fetch=()=>new Promise(r=>resolve=r);
 try{props.onAiAction('summarize');props.onSelect({...message(2),body:'second'});resolve(Response.json({uid:1,text:'wrong-message-summary',demo:false}));await flush();assert.equal(f.state[7],'');assert.equal(f.state[8],false);}finally{global.fetch=original;}
});
