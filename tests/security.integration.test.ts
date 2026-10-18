// Run against a disposable test database only. Without TEST_DATABASE_URL, use Testcontainers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { FastifyInstance, InjectOptions } from 'fastify';
import type { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
let app: FastifyInstance, pool: Pool, container: StartedPostgreSqlContainer | undefined;
let admin = '', userNumber = 0, familyNumber = 700;
const password = 'SyntheticTestPass123';
const nid = (prefix: string) => {
  const sum = [...prefix].reduce((n,d,i) => n + Number(d)*(10-i),0) % 11;
  return prefix + (sum < 2 ? sum : 11-sum);
};
const request = (cookie: string, options: InjectOptions) => app.inject({ ...options, headers: { cookie, ...options.headers } });
async function createUser(position: string, role = 'caseworker') {
  const username = `security_user_${++userNumber}`;
  const { hashPassword } = await import('../src/auth.js');
  const user = await pool.query("INSERT INTO users(username,display_name,password_hash,role,position) VALUES($1,'کاربر آزمایشی',$2,$3,$4) RETURNING id", [username,await hashPassword(password),role,position]);
  const login = await app.inject({method:'POST',url:'/auth/login',payload:{username,password}});
  assert.equal(login.statusCode,200,login.body);
  return {id:user.rows[0].id as string,cookie:String(login.headers['set-cookie']).split(';')[0]!};
}
async function createFamily(assignedTo?: string) {
  const n = ++familyNumber;
  const response = await request(admin,{method:'POST',url:'/api/families',payload:{
    caseNumber:String(n),familySurname:'خانواده نمونه',headName:'سرپرست نمونه',headNationalId:nid(String(200000000+n)),
    headPhone:'09121234567',headCardNumber:'6037990000000000',notes:'private-note',medical:{diagnosis:'synthetic-private'},
    members:[{name:'عضو نمونه',relation:'فرزند',nationalId:nid(String(300000000+n)),birthDate:'1390/01/01'}],
  }});
  assert.equal(response.statusCode,201,response.body);
  const id = response.json().familyId as string;
  if (assignedTo) await pool.query('UPDATE families SET assigned_to=$2 WHERE id=$1',[id,assignedTo]);
  return id;
}
async function createCase(familyId: string, amount = 100) {
  const response = await request(admin,{method:'POST',url:`/api/families/${familyId}/financial-cases`,payload:{title:'کمک آزمایشی',category:'سایر',amount}});
  assert.equal(response.statusCode,201,response.body);
  return response.json().financialCaseId as string;
}
const transition = (cookie: string, id: string, action: string) => request(cookie,{method:'POST',url:`/api/financial-cases/${id}/transition`,payload:{action,reason:'تصمیم آزمایشی'}});
before(async () => {
  let url = process.env.TEST_DATABASE_URL;
  if (url) {
    if (!new URL(url).pathname.toLowerCase().includes('test')) throw new Error('TEST_DATABASE_URL must name a disposable test database');
  } else {
    container = await new PostgreSqlContainer('postgres:16-alpine').withDatabase('charity_security_test').start();
    url = container.getConnectionUri();
  }
  process.env.NODE_ENV='test';
  process.env.DATABASE_URL=url;
  process.env.COOKIE_SECURE='false';
  process.env.BOOTSTRAP_SECRET='synthetic_bootstrap_secret';
  // Legacy flag must not enable capture, even in test mode.
  process.env.DEV_CAPTURE_PASSWORDS='true';
  pool=(await import('../src/db.js')).pool;
  const existing=await pool.query("SELECT to_regclass('public.users') AS users");
  if (existing.rows[0].users) throw new Error('Use an empty disposable test database; refusing to alter an existing schema');
  await (await import('../src/migrations.js')).runMigrations(pool);
  app=await (await import('../src/app.js')).buildApp({logger:false,serveStatic:false});
  const bootstrap=await app.inject({method:'POST',url:'/auth/bootstrap',payload:{username:'security_admin',displayName:'مدیر آزمایشی',password,installSecret:process.env.BOOTSTRAP_SECRET}});
  assert.equal(bootstrap.statusCode,200,bootstrap.body);
  admin=String(bootstrap.headers['set-cookie']).split(';')[0]!;
});
after(async () => {await app?.close();await pool?.end();await container?.stop();});

test('summary readers cannot obtain derived medical data, identity/card fields, members or print exports',async()=>{
  const owner=await createUser('liaison'),familyId=await createFamily(owner.id);
  for(const [position,role] of [['finance_deputy','accountant'],['supervision_deputy','caseworker'],['viewer','viewer']]) {
    const user=await createUser(position!,role!);
    const response=await request(user.cookie,{method:'GET',url:`/api/families/${familyId}`});
    assert.equal(response.statusCode,200,response.body);
    const detail=response.json().family;
    assert.equal(detail.profileRestricted,true);
    for(const key of ['profileData','medical','headNationalId','headCardNumber','notes','insurance','address']) assert.equal(key in detail,false,key);
    assert.deepEqual(detail.members,[]);
    assert.deepEqual(detail.notesHistory,[]);
    assert.equal((await request(user.cookie,{method:'GET',url:`/api/families/${familyId}/print`})).statusCode,403);
    assert.equal((await request(user.cookie,{method:'GET',url:`/api/families/${familyId}/comprehensive`})).statusCode,403);
  }
  for(const cookie of [admin,owner.cookie]) {
    const full=await request(cookie,{method:'GET',url:`/api/families/${familyId}`});
    assert.equal(full.json().family.medical.diagnosis,'synthetic-private');
    assert.equal(full.json().family.members.length,1);
    assert.equal((await request(cookie,{method:'GET',url:`/api/families/${familyId}/print`})).statusCode,200);
  }
});
test('only an in-scope liaison can start financial review, and archived cases are immutable',async()=>{
  const owner=await createUser('liaison'),outsider=await createUser('liaison');
  const familyId=await createFamily(owner.id),id=await createCase(familyId);
  assert.equal((await transition(outsider.cookie,id,'review')).statusCode,403);
  assert.equal((await transition(owner.cookie,id,'review')).statusCode,200);
  const archivedCase=await createCase(familyId);
  await pool.query('UPDATE families SET archived=true WHERE id=$1',[familyId]);
  assert.equal((await transition(owner.cookie,archivedCase,'review')).statusCode,409);
});
test('two concurrent reviews or approvals cannot both transition from the same state',async()=>{
  const id=await createCase(await createFamily());
  for(const action of ['review','approve']) {
    const responses=await Promise.all([transition(admin,id,action),transition(admin,id,action)]);
    assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409],responses.map(r=>r.body).join('\n'));
  }
  const events=await pool.query("SELECT action,count(*)::int AS n FROM financial_case_events WHERE financial_case_id=$1 AND action IN ('review','approve') GROUP BY action",[id]);
  assert.equal(events.rows.length,2);
  assert.ok(events.rows.every(row=>row.n===1));
});
test('approval rereads the amount after acquiring the row lock, not a stale snapshot',async()=>{
  const id=await createCase(await createFamily());
  assert.equal((await transition(admin,id,'review')).statusCode,200);
  const c=await pool.connect();
  let pending:ReturnType<typeof transition>|undefined;
  try {
    await c.query('BEGIN');
    await c.query('UPDATE financial_cases SET amount=250 WHERE id=$1',[id]);
    pending=transition(admin,id,'approve');
    // Wait until the request is blocked on our uncommitted row write.
    let waiting=false;
    for(let i=0;i<100;i++) {
      const q=await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%financial_cases%' AND pid<>pg_backend_pid()");
      if(q.rowCount) {waiting=true;break;}
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'approval never reached the row lock');
    await c.query('COMMIT');
    const response=await pending;
    assert.equal(response.statusCode,200,response.body);
    const row=(await pool.query('SELECT amount::text,approved_amount::text FROM financial_cases WHERE id=$1',[id])).rows[0];
    assert.equal(row.approved_amount,row.amount);
    assert.equal(row.approved_amount,'250');
  } finally {await c.query('ROLLBACK');c.release();if(pending) await pending;}
});
test('edits cannot change an approved financial request',async()=>{
  const id=await createCase(await createFamily());
  await transition(admin,id,'review');await transition(admin,id,'approve');
  const response=await request(admin,{method:'PATCH',url:`/api/financial-cases/${id}`,payload:{title:'تغییر آزمایشی',category:'سایر',amount:999}});
  assert.equal(response.statusCode,409,response.body);
  assert.equal((await pool.query('SELECT amount::text FROM financial_cases WHERE id=$1',[id])).rows[0].amount,'100');
});
test('a liaison cannot delete or replace another family document, even when it is not marked sensitive',async()=>{
  const owner=await createUser('liaison'),outsider=await createUser('liaison');
  const familyId=await createFamily(owner.id);
  const contentBase64=Buffer.from('%PDF-1.4\nsynthetic').toString('base64');
  const payload={fileName:'test.pdf',mimeType:'application/pdf',category:'سایر',contentBase64,sensitive:false};
  const created=await request(admin,{method:'POST',url:`/api/families/${familyId}/documents`,payload});
  assert.equal(created.statusCode,201,created.body);
  const id=created.json().documentId;
  assert.equal((await request(outsider.cookie,{method:'DELETE',url:`/api/documents/${id}`,payload:{reason:'تست دسترسی'}})).statusCode,403);
  assert.equal((await request(outsider.cookie,{method:'POST',url:`/api/documents/${id}/replace`,payload:{...payload,reason:'تست دسترسی'}})).statusCode,403);
  assert.equal((await pool.query('SELECT deleted_at FROM family_documents WHERE id=$1',[id])).rows[0].deleted_at,null);
});
test('user creation/reset/registry never capture or expose plaintext, even with the legacy flag',async()=>{
  const created=await request(admin,{method:'POST',url:'/api/users',payload:{username:'no_capture',displayName:'کاربر نمونه',password,position:'liaison'}});
  assert.equal(created.statusCode,201,created.body);
  const id=created.json().userId;
  assert.equal((await request(admin,{method:'POST',url:`/api/users/${id}/reset-password`,payload:{password:'ReplacementTestPass123'}})).statusCode,200);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM user_password_log')).rows[0].n,0);
  const registry=await request(admin,{method:'GET',url:'/api/users/registry'});
  assert.equal(registry.statusCode,200,registry.body);
  assert.equal(registry.json().passwordCaptureEnabled,false);
  for(const row of registry.json().users) for(const field of ['capturedPassword','passwordCapturedAt','passwordSetBy','hashPrefix','password_hash']) assert.equal(field in row,false,field);
});
test('upgrade purges legacy plaintext, expires affected sessions, and forbids future capture',async()=>{
  const user=await createUser('liaison');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    // Reconstruct the previous schema within a rolled-back test transaction only.
    await c.query('ALTER TABLE user_password_log DROP CONSTRAINT user_password_log_capture_disabled');
    await c.query('INSERT INTO user_password_log(user_id,password_plain) VALUES($1,$2)',[user.id,'synthetic-legacy-secret']);
    await c.query(await readFile(new URL('../migrations/032_purge_plaintext_passwords.sql',import.meta.url),'utf8'));
    assert.equal((await c.query('SELECT count(*)::int AS n FROM user_password_log')).rows[0].n,0);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM sessions WHERE user_id=$1',[user.id])).rows[0].n,0);
    assert.equal((await c.query('SELECT must_change_password FROM users WHERE id=$1',[user.id])).rows[0].must_change_password,true);
    await assert.rejects(c.query('INSERT INTO user_password_log(user_id,password_plain) VALUES($1,$2)',[user.id,'must-not-save']));
  } finally {await c.query('ROLLBACK');c.release();}
});

test('payment and cancellation serialize on the same financial row',async()=>{
  const id=await createCase(await createFamily(),100);
  for(const action of ['review','approve','refer']) assert.equal((await transition(admin,id,action)).statusCode,200);
  const fund=await request(admin,{method:'POST',url:'/api/funds',payload:{name:'صندوق آزمون امنیت',description:''}});
  assert.equal(fund.statusCode,201,fund.body);
  const fundId=fund.json().fundId;
  const budget=await request(admin,{method:'PUT',url:`/api/funds/${fundId}/budget`,payload:{jalaliYear:1405,jalaliMonth:7,amount:1000}});
  assert.equal(budget.statusCode,200,budget.body);
  const pay=request(admin,{method:'POST',url:`/api/financial-cases/${id}/pay`,payload:{fundId,jalaliYear:1405,jalaliMonth:7,paidAt:'2026-10-19',referenceNo:'security-payment',receipt:null}});
  const cancel=transition(admin,id,'cancel');
  const responses=await Promise.all([pay,cancel]);
  assert.equal(responses.filter(r=>r.statusCode===409).length,1,responses.map(r=>r.body).join('\n'));
  const final=(await pool.query('SELECT status FROM financial_cases WHERE id=$1',[id])).rows[0].status;
  const payments=(await pool.query('SELECT count(*)::int AS n FROM financial_payments WHERE financial_case_id=$1',[id])).rows[0].n;
  assert.ok((final==='پرداخت شده'&&payments===1)||(final==='لغو شده'&&payments===0));
});
