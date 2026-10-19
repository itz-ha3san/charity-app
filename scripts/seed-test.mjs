import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {assertTestDatabase} from './lib/test-database.mjs';
assertTestDatabase(process.env.TEST_DATABASE_URL);
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.BOOTSTRAP_SECRET='synthetic_qa_bootstrap_only';
const {pool}=await import('../dist/db.js');
const {runMigrations}=await import('../dist/migrations.js');
const {buildApp}=await import('../dist/app.js');
const {hashPassword}=await import('../dist/auth.js');
let app;
try {
 if((await pool.query("SELECT to_regclass('public.users') AS users")).rows[0].users)throw Error('Seed requires an empty disposable database; refusing existing schema');
 await runMigrations(pool);app=await buildApp({logger:false,serveStatic:false});
 const password='SyntheticQaPass123';
 const boot=await app.inject({method:'POST',url:'/auth/bootstrap',payload:{username:'qa_admin',displayName:'مدیر آزمایشی',password,installSecret:process.env.BOOTSTRAP_SECRET}});
 if(boot.statusCode!==200)throw Error('Synthetic bootstrap failed');
 const cookie=String(boot.headers['set-cookie']).split(';')[0];
 const users={admin:{username:'qa_admin',password,position:'ceo'}};
 const positions={ceo:'admin',liaison:'caseworker',other_liaison:'caseworker',health_officer:'caseworker',education_officer:'caseworker',health_deputy:'caseworker',education_deputy:'caseworker',supervision_deputy:'caseworker',finance_deputy:'accountant',finance_officer:'accountant',viewer:'viewer'};
 for(const [name,role] of Object.entries(positions)){
  const position=name==='other_liaison'?'liaison':name;
  const q=await pool.query('INSERT INTO users(username,display_name,password_hash,role,position)VALUES($1,$2,$3,$4,$5)RETURNING id',['qa_'+name,'کاربر آزمایشی '+name,await hashPassword(password),role,position]);
  users[name]={id:q.rows[0].id,username:'qa_'+name,password,position};
 }
 async function api(method,url,payload){const r=await app.inject({method,url,headers:{cookie},payload});if(r.statusCode>=300)throw Error(`Synthetic setup failed at ${url}: ${r.statusCode}`);return r.json()}
 const nid=prefix=>{const n=[...prefix].reduce((sum,d,i)=>sum+Number(d)*(10-i),0)%11;return prefix+(n<2?n:11-n)};
 const family=(await api('POST','/api/families',{caseNumber:'610',familySurname:'خانواده آزمایشی',headName:'سرپرست ساختگی',headNationalId:nid('600000610'),headPhone:'09120000000',notes:'SYNTHETIC_QA_ONLY',members:[]})).familyId;
 await pool.query('UPDATE families SET assigned_to=$2 WHERE id=$1',[family,users.liaison.id]);
 const action=(await api('POST',`/api/families/${family}/actions`,{title:'اقدام آزمایشی کیفیت انتشار',domain:'general'})).actionId;
 const financial=(await api('POST',`/api/families/${family}/financial-cases`,{title:'کمک آزمایشی انتشار',category:'سایر',amount:100,jalaliYear:1405,jalaliMonth:7})).financialCaseId;
 const fund=(await api('POST','/api/funds',{name:'صندوق ساختگی تست',description:'SYNTHETIC_QA_ONLY'})).fundId;
 await api('PUT',`/api/funds/${fund}/budget`,{jalaliYear:1405,jalaliMonth:7,amount:10000});
 const specialist={};
 for(const domain of ['health','education']){
  const user=users[domain+'_officer'];
  const referral=(await api('POST',`/api/families/${family}/referrals`,{domain,assignedTo:user.id,reason:'ارجاع ساختگی آزمون'})).referralId;
  const c=await api('POST',`/api/families/${family}/specialist-cases`,{domain,referralId:referral,summary:'SYNTHETIC_'+domain});
  specialist[domain]={referralId:referral,caseId:c.specialistCaseId};
 }
 const manifest={synthetic:true,users,familyId:family,actionId:action,financialCaseId:financial,fundId:fund,specialist};
 const path=resolve(process.env.QA_FIXTURE_PATH||'.tmp/qa-fixtures.json');await mkdir(dirname(path),{recursive:true});
 await writeFile(path,JSON.stringify(manifest,null,2),{mode:0o600});
 console.log('Synthetic QA fixture created (12 users, one family; never run against production)');
}finally{await app?.close();await pool.end()}
