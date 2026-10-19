import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { jalaliPeriod, shiftPeriod } from '../src/domain/financialAnalytics.js';
let app: FastifyInstance, pool: Pool, admin='', liaison='', finance='', familyId='', fundId='', secondFamily='';
const current=jalaliPeriod(), next=shiftPeriod(current,1), password='SyntheticAnalyticsPass123';
const req=(cookie:string,url:string)=>app.inject({method:'GET',url,headers:{cookie}});
before(async()=>{
 const url=process.env.TEST_DATABASE_URL;if(!url||!new URL(url).pathname.includes('test'))throw Error('Requires a fresh disposable TEST_DATABASE_URL');
 process.env.DATABASE_URL=url;process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.BOOTSTRAP_SECRET='synthetic_analytics_only';
 pool=(await import('../src/db.js')).pool;
 if((await pool.query("SELECT to_regclass('public.users') users")).rows[0].users)throw Error('Refusing existing schema');
 await (await import('../src/migrations.js')).runMigrations(pool);
 app=await (await import('../src/app.js')).buildApp({logger:false,serveStatic:false});
 const b=await app.inject({method:'POST',url:'/auth/bootstrap',payload:{username:'analytics_admin',displayName:'آزمایش',password,installSecret:process.env.BOOTSTRAP_SECRET}});assert.equal(b.statusCode,200,b.body);admin=String(b.headers['set-cookie']).split(';')[0]!;
 const {hashPassword}=await import('../src/auth.js');
 for(const [name,role,position] of [['analytics_liaison','caseworker','liaison'],['analytics_finance','accountant','finance_deputy']]){
  await pool.query('INSERT INTO users(username,display_name,password_hash,role,position)VALUES($1,$1,$2,$3,$4)',[name,await hashPassword(password),role,position]);
  const r=await app.inject({method:'POST',url:'/auth/login',payload:{username:name,password}});assert.equal(r.statusCode,200,r.body);const c=String(r.headers['set-cookie']).split(';')[0]!;if(position==='liaison')liaison=c;else finance=c;
 }
 const owner=(await pool.query("SELECT id FROM users WHERE username='analytics_admin'")).rows[0].id;
 familyId=(await pool.query("INSERT INTO families(case_number,family_surname,head_name,head_national_id,head_phone,housing_type,created_by)VALUES('810','PRIVATE_SURNAME','PRIVATE_HEAD','1234567890','09120000000','other',$1)RETURNING id",[owner])).rows[0].id;
 secondFamily=(await pool.query("INSERT INTO families(case_number,family_surname,head_name,head_national_id,head_phone,housing_type,created_by)VALUES('811','SECOND_PRIVATE','PRIVATE_HEAD','1234567891','09120000000','other',$1)RETURNING id",[owner])).rows[0].id;
 fundId=(await pool.query("INSERT INTO funds(name,created_by)VALUES('synthetic fund',$1)RETURNING id",[owner])).rows[0].id;
 for(let i=6;i>=0;i--){const p=shiftPeriod(current,-i),amount=i===0?999999:100;
  const fc=(await pool.query("INSERT INTO financial_cases(family_id,title,category,amount,status,created_by)VALUES($1,'synthetic','سایر',$2,'پرداخت شده',$3)RETURNING id",[familyId,amount,owner])).rows[0].id;
  await pool.query("INSERT INTO financial_payments(financial_case_id,fund_id,amount,jalali_year,jalali_month,paid_at,reference_no,created_by)VALUES($1,$2,$3,$4,$5,current_date,'synthetic',$6)",[fc,fundId,amount,p.year,p.month,owner]);
 }
 for(const [status,amount,year,month] of [['تأیید شده',250,next.year,next.month],['درخواست جدید',900,next.year,next.month],['تأیید شده',800,current.year,current.month],['تأیید شده',700,null,null]])await pool.query('INSERT INTO financial_cases(family_id,title,category,amount,status,jalali_year,jalali_month,created_by)VALUES($1,\'synthetic\',\'سایر\',$2,$3,$4,$5,$6)',[familyId,amount,status,year,month,owner]);
});
after(async()=>{await app?.close();await pool?.end();});
test('analytics requires authenticated financial authorization',async()=>{
 assert.equal((await req('','/api/financial-analytics')).statusCode,401);
 assert.equal((await req(liaison,'/api/financial-analytics')).statusCode,403);
 assert.equal((await req(liaison,'/api/financial-analytics/families')).statusCode,403);
 assert.equal((await req(finance,'/api/financial-analytics')).statusCode,200);
});
test('current partial month excluded, exact totals, only next-month approved commitments',async()=>{
 const r=await req(admin,'/api/financial-analytics');assert.equal(r.statusCode,200,r.body);const d=r.json();
 assert.equal(d.totalPaid,'600');assert.equal(d.current.amount,'999999');assert.equal(d.committed,'250');assert.equal(d.forecast.estimate,'100');assert.equal(d.plan.likely,'250');
 assert.equal(d.monthly.filter((m:any)=>m.amount===null).length,6);assert.equal(d.monthly.filter((m:any)=>m.amount==='100').length,6);
 assert.equal(d.forecast.backtestMonths,3);assert.equal(d.forecast.mae,'0');assert.equal(d.methodology.llmUsed,false);assert.equal(d.unit,'تومان');
 for(const privateValue of ['PRIVATE_HEAD','PRIVATE_SURNAME','password_hash'])assert.equal(r.body.includes(privateValue),false);
});
test('family and category filters do not mix another household or produce fake history',async()=>{
 const d=(await req(admin,'/api/financial-analytics?familyId='+secondFamily)).json();assert.equal(d.totalPaid,'0');assert.equal(d.forecast.available,false);assert.equal(d.committed,'0');assert.equal(d.monthly.every((m:any)=>m.amount===null),true);
 const c=(await req(admin,'/api/financial-analytics?category='+encodeURIComponent('درمان'))).json();assert.equal(c.totalPaid,'0');assert.equal(c.forecast.available,false);
 assert.equal((await req(admin,'/api/financial-analytics?familyId=00000000-0000-4000-8000-000000000000')).statusCode,404);
 assert.equal((await req(admin,'/api/financial-analytics?archive=oops')).statusCode,400);
 assert.equal((await req(admin,'/api/financial-analytics?unexpected=true')).statusCode,400);
});
test('fund filter keeps spent history but does not invent fund allocation for commitments',async()=>{
 const r=await req(finance,'/api/financial-analytics?fundId='+fundId);assert.equal(r.statusCode,200,r.body);const d=r.json();assert.equal(d.totalPaid,'600');assert.equal(d.committed,null);assert.equal(d.plan.likely,'100');assert.equal(d.methodology.commitmentsIncluded,false);
});
test('family search is bounded and contains case reference only',async()=>{
 const r=await req(admin,'/api/financial-analytics/families?q=810');assert.equal(r.statusCode,200,r.body);const d=r.json();assert.equal(d.families.length,1);assert.deepEqual(Object.keys(d.families[0]).sort(),['archived','caseNumber','id']);assert.equal(d.families[0].id,familyId);
 const injection=await req(admin,'/api/financial-analytics/families?q='+encodeURIComponent("%' OR 1=1 --"));assert.equal(injection.statusCode,200);assert.equal(injection.json().families.length,0);
});
test('archived history remains opt-in filterable; outstanding archived cases excluded',async()=>{
 await pool.query('UPDATE families SET archived=true WHERE id=$1',[familyId]);
 const all=(await req(admin,'/api/financial-analytics')).json();assert.equal(all.totalPaid,'600');assert.equal(all.committed,'0');
 const active=(await req(admin,'/api/financial-analytics?archive=active')).json();assert.equal(active.totalPaid,'0');
 const archived=(await req(admin,'/api/financial-analytics?archive=archived')).json();assert.equal(archived.totalPaid,'600');
});
