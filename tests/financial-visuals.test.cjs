const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context={window:{},innerWidth:390,esc:escape};
vm.runInNewContext(readFileSync('public/app/financial-intelligence.js','utf8'),context);
const {percentChange,sparkline,statCard,monthlyChart}=context.window.AppFinancialVisuals;
const rows=[{year:1405,month:1,amount:null,payments:null},{year:1405,month:2,amount:'100000000000000000001',payments:1},{year:1405,month:3,amount:'0',payments:0},{year:1405,month:4,amount:'200000000000000000002',payments:2}];
test('period delta uses exact BigInt arithmetic and a known positive baseline',()=>{
 assert.equal(percentChange('200000000000000000002','100000000000000000001').basisPoints,10000n);
 assert.equal(percentChange('50','100').direction,'down');assert.equal(percentChange('50','100').basisPoints,5000n);
 assert.equal(percentChange('100','100').direction,'flat');
 for(const v of [null,undefined,'0','-1'])assert.equal(percentChange('100',v),null);
 assert.equal(percentChange(null,'100'),null);
});
test('Stat separates units, escapes content and only renders a real delta',()=>{
 const plain=statCard({label:'<script>',value:'100',unit:'تومان',note:'<img>'});
 assert.match(plain,/&lt;script&gt;/);assert.match(plain,/fi-stat-unit/);assert.doesNotMatch(plain,/fi-stat-delta/);assert.doesNotMatch(plain,/<img>/);
 const known=statCard({label:'آخرین ماه کامل',value:'150',unit:'تومان',delta:percentChange('150','100'),comparison:'نسبت به ۱۴۰۵\/۰۲'});
 assert.match(known,/افزایش ۵۰٪/);assert.match(known,/fi-delta-up/);
 assert.match(statCard({label:'ریز',value:'10000001',delta:percentChange('10000001','10000000')}),/کمتر از ۰٫۰۱٪/);
 assert.match(statCard({label:'ناشناخته',value:null}),/داده کافی نیست/);
});
test('sparklines keep missing periods as gaps and constant/one-point series finite',()=>{
 assert.equal(sparkline([null,null]),'');assert.equal(sparkline(['1']),'');
 const gap=sparkline(['2',null,'2','2']);assert.match(gap,/<circle/);assert.match(gap,/<polyline/);assert.doesNotMatch(gap,/NaN|Infinity/);
});
test('RTL bars include known zeros, preserve exact large tooltips and fit the measured width',()=>{
 const html=monthlyChart(rows,'amount',280,'bar');
 assert.match(html,/width="280"/);assert.equal((html.match(/data-fi-point=/g)||[]).length,3);
 assert.match(html,/data-fi-point="2"/);assert.match(html,/height="0"/);assert.doesNotMatch(html,/data-fi-point="0"/);
 assert.ok(html.includes(BigInt(rows[1].amount).toLocaleString('fa-IR')+' تومان'));assert.doesNotMatch(html,/NaN|Infinity/);
 const xs=[...html.matchAll(/data-x="([\d.]+)"/g)].map(m=>Number(m[1]));assert.ok(xs.every((x,i)=>!i||x<xs[i-1]));
});
test('line and count views retain points, use distinct gradient IDs and do not bridge unknown months',()=>{
 const gaps=[rows[1],rows[0],rows[3]],line=monthlyChart(gaps,'amount',600,'line');
 assert.equal((line.match(/class="fi-dot"/g)||[]).length,2);assert.doesNotMatch(line,/class="fi-line"/);
 const first=monthlyChart(rows,'payments',300,'line'),next=monthlyChart(rows,'payments',300,'line');
 assert.match(first,/class="fi-line"/);assert.match(first,/data-value="۲ پرداخت"/);assert.doesNotMatch(first,/تومان/);
 assert.notEqual(first.match(/id="(fi-area-\d+)"/)[1],next.match(/id="(fi-area-\d+)"/)[1]);
 assert.match(monthlyChart([{...rows[0]}],'amount',300),/هنوز پرداختی/);
});
