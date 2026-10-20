import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import type {FastifyInstance,InjectOptions} from 'fastify';
import type {Pool} from 'pg';
let app:FastifyInstance,pool:Pool,admin='',liaison='',viewer='',familyId='',liaisonId='';
const password='SyntheticFieldsPass123';
const base={caseNumber:'812',familySurname:'آزمایشی',headName:'سرپرست نمونه',headNationalId:'1000000011',headPhone:'09120000000',headCardNumber:'6037990000000006',headIban:'IR062960000000100324200001',province:'تهران',city:'تهران',postalCode:'8163847351',address:'نشانی آزمایشی قبلی'};
const req=(cookie:string,options:InjectOptions)=>app.inject({...options,headers:{cookie,...options.headers}});
before(async()=>{
 const url=process.env.TEST_DATABASE_URL;if(!url||!new URL(url).pathname.includes('test'))throw Error('Fresh test database required');process.env.DATABASE_URL=url;process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.BOOTSTRAP_SECRET='synthetic_fields_only';
 pool=(await import('../src/db.js')).pool;if((await pool.query("SELECT to_regclass('public.users') users")).rows[0].users)throw Error('Refusing existing schema');await (await import('../src/migrations.js')).runMigrations(pool);app=await (await import('../src/app.js')).buildApp({logger:false,serveStatic:false});
 const b=await app.inject({method:'POST',url:'/auth/bootstrap',payload:{username:'fields_admin',displayName:'آزمایش',password,installSecret:process.env.BOOTSTRAP_SECRET}});assert.equal(b.statusCode,200,b.body);admin=String(b.headers['set-cookie']).split(';')[0]!;
 const {hashPassword}=await import('../src/auth.js');for(const [name,role,position] of [['fields_liaison','caseworker','liaison'],['fields_viewer','viewer','viewer']]){const result=await pool.query('INSERT INTO users(username,display_name,password_hash,role,position)VALUES($1,$1,$2,$3,$4)RETURNING id',[name,await hashPassword(password),role,position]);const response=await app.inject({method:'POST',url:'/auth/login',payload:{username:name,password}});const cookie=String(response.headers['set-cookie']).split(';')[0]!;if(position==='liaison'){liaison=cookie;liaisonId=result.rows[0].id;}else viewer=cookie;}
});
after(async()=>{await app?.close();await pool?.end();});
test('new family fields are normalized, persisted and hidden from summary readers',async()=>{
 const response=await req(admin,{method:'POST',url:'/api/families',payload:{...base,headCardNumber:'۶۰۳۷ ۹۹۰۰ ۰۰۰۰ ۰۰۰۶',postalCode:'۸۱۶۳۸-۴۷۳۵۱'}});assert.equal(response.statusCode,201,response.body);familyId=response.json().familyId;
 const detail=(await req(admin,{method:'GET',url:'/api/families/'+familyId})).json().family;assert.equal(detail.headIban,base.headIban);assert.equal(detail.postalCode,base.postalCode);assert.equal(detail.address,base.address);assert.equal(detail.headCardNumber,base.headCardNumber);
 const restricted=await req(viewer,{method:'GET',url:'/api/families/'+familyId});assert.equal(restricted.statusCode,200,restricted.body);for(const key of ['headIban','postalCode','province','accountHolder'])assert.equal(key in restricted.json().family,false);
 await pool.query('UPDATE families SET assigned_to=$2 WHERE id=$1',[familyId,liaisonId]);
});
test('create, import and profile write reject malformed bank and location pairs',async()=>{
 for(const [route,payload] of [['/api/families',{...base,headCardNumber:'6037990000000000'}],['/api/families/import',{families:[{...base,headIban:'IR062960000000100324200002'}]}]])assert.equal((await req(admin,{method:'POST',url:route as string,payload})).statusCode,400);
 const detail=(await req(admin,{method:'GET',url:'/api/families/'+familyId})).json().family;
 for(const patch of [{headIban:'IR062960000000100324200002'},{province:'تهران',city:'شیراز'},{postalCode:'0000000000'}]){const response=await req(admin,{method:'PATCH',url:'/api/families/'+familyId,payload:{...base,...detail,housingDeposit:0,housingRent:0,...patch}});assert.equal(response.statusCode,400,response.body);}
 const response=await req(admin,{method:'PUT',url:'/api/families/'+familyId+'/profile',payload:{...base,headIban:'IR062960000000100324200002'}});assert.equal(response.statusCode,400,response.body);
});
test('legacy card remains untouched on unrelated edit, while a newly changed bad card is rejected',async()=>{
 await pool.query("UPDATE families SET head_card_number='6037990000000000' WHERE id=$1",[familyId]);
 const detail=(await req(admin,{method:'GET',url:'/api/families/'+familyId})).json().family;
 let response=await req(admin,{method:'PATCH',url:'/api/families/'+familyId,payload:{...detail,housingDeposit:0,housingRent:0,notes:'تغییر توضیح ساختگی'}});assert.equal(response.statusCode,200,response.body);
 assert.equal((await pool.query('SELECT head_card_number FROM families WHERE id=$1',[familyId])).rows[0].head_card_number,'6037990000000000');
 response=await req(admin,{method:'PATCH',url:'/api/families/'+familyId,payload:{...detail,housingDeposit:0,housingRent:0,headCardNumber:'6037990000000010'}});assert.equal(response.statusCode,400,response.body);
});
test('liaison bank field edits use review workflow and do not bypass approval',async()=>{
 const detail=(await req(liaison,{method:'GET',url:'/api/families/'+familyId})).json().family;
 const response=await req(liaison,{method:'PATCH',url:'/api/families/'+familyId,payload:{proposedData:{accountHolder:'صاحب حساب آزمایشی'},changedFields:['accountHolder']}});assert.equal(response.statusCode,202,response.body);
 const before=(await req(admin,{method:'GET',url:'/api/families/'+familyId})).json().family;assert.notEqual(before.accountHolder,'صاحب حساب آزمایشی');
 const id=response.json().changeRequestId;assert.ok(id);
 const approve=await req(admin,{method:'POST',url:`/api/family-change-requests/${id}/review`,payload:{decision:'approve',note:'تأیید آزمایشی'}});assert.equal(approve.statusCode,200,approve.body);
 assert.equal((await req(admin,{method:'GET',url:'/api/families/'+familyId})).json().family.accountHolder,'صاحب حساب آزمایشی');
});
