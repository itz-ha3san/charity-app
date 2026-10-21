const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/app/family-profile.js','utf8').split('\nconst dataLabels')[0];
function fixture(response,{failure=false}={}) {
 const list={innerHTML:'',querySelectorAll:()=>[]};const nodes={'#familyList':list,'#familyDetail':{innerHTML:''},'#familyCount':{textContent:''},'#statusFilter':{value:'active'},'#searchInput':{value:'مریم & حسن'},'#supervisorFilter':{value:'supervisor 1'},'#liaisonFilter':{value:'liaison 2'}};
 const calls=[];const context={$:s=>nodes[s],URLSearchParams,fa:x=>String(x),esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),selectedId:null,getFamilyRouteId:()=>null,loadDetail:id=>calls.push(id),api:async url=>{calls.push(url);if(failure)throw Error('network');return response;},showAuth:()=>{}};
 vm.runInNewContext(source,context);return {nodes,calls,run:()=>context.loadFamilies()};
}
test('family picker preserves status, search and both assignment filters',async()=>{
 const f=fixture({total:1,families:[{id:'1',headName:'<script>name</script>',familySurname:'نمونه',caseNumber:'001',priority:'بالا',memberCount:2}]});await f.run();const query=new URL(f.calls[0],'https://example.test').searchParams;
 assert.equal(query.get('search'),'مریم & حسن');assert.equal(query.get('status'),'active');assert.equal(query.get('supervisorId'),'supervisor 1');assert.equal(query.get('liaisonId'),'liaison 2');assert.equal(f.calls[1],'1');assert.match(f.nodes['#familyList'].innerHTML,/&lt;script&gt;/);assert.doesNotMatch(f.nodes['#familyList'].innerHTML,/<script>/);
});
test('family picker preserves meaningful empty and error states',async()=>{
 const empty=fixture({total:0,families:[]});await empty.run();assert.match(empty.nodes['#familyList'].innerHTML,/پرونده‌ای پیدا نشد/);assert.equal(empty.nodes['#familyCount'].textContent,'0 پرونده');
 const failed=fixture(null,{failure:true});await failed.run();assert.match(failed.nodes['#familyList'].innerHTML,/دریافت فهرست ناموفق بود/);
});
test('picker controls are unique and component assets are installed and cached',()=>{
 const html=fs.readFileSync('public/index.html','utf8');for(const id of ['searchInput','createBtn','familyCount','familyList'])assert.equal(html.split(`id="${id}"`).length-1,1,id);
 const sidebar=html.slice(html.indexOf('<aside class="family-panel family-list-panel"'),html.indexOf('</aside>',html.indexOf('<aside class="family-panel family-list-panel"')));
 for(const id of ['createBtn','familyCount'])assert.ok(sidebar.includes(`id="${id}"`));assert.ok(!sidebar.includes('id="searchInput"'));assert.ok(html.indexOf('class="family-picker-controls"')<html.indexOf('class="family-workspace"'));assert.ok(html.includes('href="/family-list.css"'));assert.ok(fs.readFileSync('public/sw.js','utf8').includes("'/family-list.css'"));
});
