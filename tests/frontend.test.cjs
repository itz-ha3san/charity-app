const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const run=(name,context)=>vm.runInNewContext(fs.readFileSync(`public/app/${name}.js`,'utf8'),context);
test('feature manifest, all scripts, lexical names and load order validate',()=>{
 const result=spawnSync(process.execPath,['scripts/check-frontend.mjs'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const html=fs.readFileSync('public/index.html','utf8');
 for(const asset of ['/app/admin.js','/approval-review.js'])assert.equal(html.includes(`src="${asset}"`),false);
 assert.equal(/<style>/.test(html),false);
});
test('lazy assets share one in-flight load and permit retry after failure',async()=>{
 const appended=[];const window={};const document={createElement:()=>({remove(){}}),head:{append:script=>appended.push(script)}};
 run('assets',{window,document});
 const first=window.AppAssets.load('admin');assert.equal(first,window.AppAssets.load('admin'));assert.equal(appended.length,1);
 appended[0].onerror();await assert.rejects(first);
 const again=window.AppAssets.load('admin');assert.equal(appended.length,2);appended[1].onload();await again;
 await assert.rejects(window.AppAssets.load('__proto__'));
});
test('lazy entry delegates to loaded implementation without duplicate loading',async()=>{
 let count=0;const window={AppUI:{toast(){}}};const document={createElement:()=>({remove(){}}),head:{append:s=>{count++;queueMicrotask(()=>{window.openUsers=async value=>'loaded:'+value;s.onload();});}}};
 run('assets',{window,document});window.AppAssets.register('admin',['openUsers']);
 assert.equal(await window.openUsers('test'),'loaded:test');assert.equal(count,1);
});
test('body enhancers share one observer, replace duplicate subscriptions and disconnect',()=>{
 let created=0,notify,disconnects=0,one=0,two=0;class MutationObserver{constructor(fn){created++;notify=fn}observe(){}disconnect(){disconnects++}}
 const window={};run('lifecycle',{window,MutationObserver,document:{body:{}},console});
 const a=window.AppLifecycle.subscribe('one',()=>one++),b=window.AppLifecycle.subscribe('two',()=>two++);
 window.AppLifecycle.subscribe('one',()=>one+=2);notify([]);assert.equal(one,2);assert.equal(two,1);assert.equal(created,1);
 a();b();assert.equal(disconnects,1);
});
test('shared form runner blocks duplicate submits and restores prior disabled state',async()=>{
 const buttons=[false,true].map(disabled=>({disabled,dataset:{},classList:{add(){},remove(){}}}));
 const form={querySelectorAll:()=>buttons,setAttribute(){}};const window={};run('ui',{window,document:{},setTimeout,clearTimeout});
 let release,calls=0;const pending=window.AppUI.runPending(form,()=>{calls++;return new Promise(resolve=>release=resolve)});
 await window.AppUI.runPending(form,()=>calls++);assert.equal(calls,1);assert.equal(buttons[0].disabled,true);
 release();await pending;assert.equal(buttons[0].disabled,false);assert.equal(buttons[1].disabled,true);
 await assert.rejects(window.AppUI.runPending(form,async()=>{throw Error('synthetic')}));assert.equal(buttons[0].disabled,false);
});
test('payment keys retain cryptographic randomness on private HTTP origins without randomUUID',()=>{
 const window={},webcrypto=require('node:crypto').webcrypto;
 run('ui',{window,document:{},setTimeout,clearTimeout,crypto:{getRandomValues:array=>webcrypto.getRandomValues(array)},Uint8Array});
 const one=window.AppUI.requestKey(),two=window.AppUI.requestKey();assert.match(one,/^[a-f0-9]{32}$/);assert.notEqual(one,two);
});
