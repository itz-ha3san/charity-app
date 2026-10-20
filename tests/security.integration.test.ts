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
    headPhone:'09121234567',headCardNumber:'6037990000000006',notes:'private-note',medical:{diagnosis:'synthetic-private'},
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


// Specialist regression coverage: use synthetic documents and disposable databases only.
const specialistDocument = {
  documentType: 'medical_record', fileName: 'synthetic-specialist.pdf',
  mimeType: 'application/pdf', contentBase64: Buffer.from('%PDF-1.4\nsynthetic-only\n%%EOF').toString('base64'),
};
async function specialistFixture(domain = 'health') {
  const specialist = await createUser(domain === 'health' ? 'health_officer' : 'education_officer');
  const familyId = await createFamily();
  const referralId = await specialistReferral(familyId, specialist.id, domain);
  const created = await request(specialist.cookie, {method:'POST',url:`/api/families/${familyId}/specialist-cases`,payload:{domain,referralId,summary:'پرونده تخصصی آزمایشی'}});
  assert.equal(created.statusCode,201,created.body);
  const caseId = created.json().specialistCaseId as string;
  const doc = await request(specialist.cookie,{method:'POST',url:`/api/specialist-cases/${caseId}/documents`,payload:specialistDocument});
  assert.equal(doc.statusCode,201,doc.body);
  return {...specialist,familyId,referralId,caseId,documentId:doc.json().documentId as string,domain};
}
async function specialistReferral(familyId: string, assignedTo: string, domain: string) {
  const r = await request(admin,{method:'POST',url:`/api/families/${familyId}/referrals`,payload:{domain,assignedTo,reason:'ارجاع آزمایشی'}});
  assert.equal(r.statusCode,201,r.body);
  return r.json().referralId as string;
}
async function assertSpecialistBlocked(x: Awaited<ReturnType<typeof specialistFixture>>) {
  const requests: InjectOptions[] = [
    {method:'GET',url:`/api/specialist-cases/${x.caseId}/documents`},
    {method:'GET',url:`/api/specialist-documents/${x.documentId}/download`,headers:{'x-access-reason':'بررسی آزمایشی'}},
    {method:'PATCH',url:`/api/specialist-cases/${x.caseId}`,payload:{assessment:'نباید ذخیره شود'}},
    {method:'POST',url:`/api/specialist-cases/${x.caseId}/transition`,payload:{to:x.domain==='health'?'initial_assessment':'assessment'}},
    {method:'POST',url:`/api/specialist-cases/${x.caseId}/documents`,payload:specialistDocument},
  ];
  for(const options of requests) {
    const r=await request(x.cookie,options);
    assert.equal(r.statusCode,403,`${options.url}: ${r.body}`);
  }
  const inbox=await request(x.cookie,{method:'GET',url:'/api/specialist-cases/inbox'});
  assert.equal(inbox.statusCode,200,inbox.body);
  assert.ok(!inbox.json().items.some((c: {id:string})=>c.id===x.caseId));
  const row=(await pool.query('SELECT status,assessment FROM specialist_cases WHERE id=$1',[x.caseId])).rows[0];
  assert.equal(row.status,'new_referral');assert.equal(row.assessment,'');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM specialist_case_documents WHERE specialist_case_id=$1',[x.caseId])).rows[0].n,1);
}
for(const domain of ['health','education']) {
  test(`${domain}: closing or cancelling the linked referral revokes all specialist routes, even with another active referral`,async()=>{
    for(const status of ['cancelled','done']) {
      const x=await specialistFixture(domain);
      // A different active referral must not authorize the old case or its documents.
      await specialistReferral(x.familyId,x.id,domain);
      const close=await request(admin,{method:'PATCH',url:`/api/referrals/${x.referralId}`,payload:{status}});
      assert.equal(close.statusCode,200,close.body);
      assert.equal((await request(x.cookie,{method:'GET',url:`/api/families/${x.familyId}`})).statusCode,200);
      await assertSpecialistBlocked(x);
      const listing=await request(x.cookie,{method:'GET',url:`/api/families/${x.familyId}/specialist-cases`});
      assert.equal(listing.statusCode,200,listing.body);
      assert.ok(!listing.json().cases.some((c:{id:string})=>c.id===x.caseId));
      assert.ok(!listing.json().history.some((e:{caseId:string})=>e.caseId===x.caseId));
      // Managers retain historical read access after closure.
      assert.equal((await request(admin,{method:'GET',url:`/api/specialist-documents/${x.documentId}/download`,headers:{'x-access-reason':'بررسی مدیریتی'}})).statusCode,200);
    }
  });
}
test('reassigning the linked referral revokes the former specialist even if the case assignment is stale',async()=>{
  const x=await specialistFixture(),replacement=await createUser('health_officer');
  await specialistReferral(x.familyId,x.id,'health');
  await pool.query('UPDATE service_referrals SET assigned_to=$2 WHERE id=$1',[x.referralId,replacement.id]);
  await assertSpecialistBlocked(x);
  // Also cover the normal reassignment shape where both assignments are updated.
  await pool.query('UPDATE specialist_cases SET assigned_to=$2 WHERE id=$1',[x.caseId,replacement.id]);
  await assertSpecialistBlocked(x);
  const listing=await request(x.cookie,{method:'GET',url:`/api/families/${x.familyId}/specialist-cases`});
  assert.equal(listing.statusCode,200,listing.body);
  assert.ok(!listing.json().cases.some((c:{id:string})=>c.id===x.caseId));
  assert.ok(!listing.json().history.some((e:{caseId:string})=>e.caseId===x.caseId));
});
for(const domain of ['health','education']) {
  test(`${domain}: archive blocks every specialist mutation for specialists and managers; unarchive restores valid access`,async()=>{
    const x=await specialistFixture(domain),pendingReferral=await specialistReferral(x.familyId,x.id,domain);
    const archived=await request(admin,{method:'POST',url:`/api/families/${x.familyId}/archive`,payload:{reason:'بایگانی آزمایشی'}});
    assert.equal(archived.statusCode,200,archived.body);
    const requests: InjectOptions[] = [
      {method:'PATCH',url:`/api/specialist-cases/${x.caseId}`,payload:{assessment:'نباید ذخیره شود'}},
      {method:'POST',url:`/api/specialist-cases/${x.caseId}/transition`,payload:{to:domain==='health'?'initial_assessment':'assessment'}},
      {method:'POST',url:`/api/specialist-cases/${x.caseId}/documents`,payload:specialistDocument},
      {method:'POST',url:`/api/families/${x.familyId}/specialist-cases`,payload:{domain,referralId:pendingReferral,summary:'پرونده جدید آزمایشی'}},
    ];
    for(const cookie of [x.cookie,admin]) for(const options of requests) {
      const r=await request(cookie,options);
      assert.equal(r.statusCode,409,`${options.url}: ${r.body}`);
      assert.equal(r.json().error,'FAMILY_ARCHIVED');
    }
    assert.equal((await pool.query('SELECT assessment FROM specialist_cases WHERE id=$1',[x.caseId])).rows[0].assessment,'');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM specialist_cases WHERE family_id=$1',[x.familyId])).rows[0].n,1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM specialist_case_documents WHERE specialist_case_id=$1',[x.caseId])).rows[0].n,1);
    assert.equal((await request(x.cookie,{method:'GET',url:`/api/specialist-documents/${x.documentId}/download`,headers:{'x-access-reason':'بررسی آزمایشی'}})).statusCode,200);
    const restored=await request(admin,{method:'POST',url:`/api/families/${x.familyId}/unarchive`,payload:{reason:'بازگشایی آزمایشی'}});
    assert.equal(restored.statusCode,200,restored.body);
    assert.equal((await request(x.cookie,{method:'PATCH',url:`/api/specialist-cases/${x.caseId}`,payload:{assessment:'ارزیابی معتبر'}})).statusCode,200);
  });
}
for(const resource of ['archive','referral']) {
  test(`specialist mutation rechecks ${resource} after waiting for a concurrent transaction`,async()=>{
    const x=await specialistFixture(),c=await pool.connect();
    let pending: ReturnType<typeof request>|undefined;
    try {
      await c.query('BEGIN');
      if(resource==='archive') await c.query('UPDATE families SET archived=true WHERE id=$1',[x.familyId]);
      else await c.query("UPDATE service_referrals SET status='cancelled' WHERE id=$1",[x.referralId]);
      pending=request(x.cookie,{method:'PATCH',url:`/api/specialist-cases/${x.caseId}`,payload:{assessment:'نباید ذخیره شود'}});
      let waiting=false;
      for(let i=0;i<100;i++) {
        const q=await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%specialist_cases%' AND pid<>pg_backend_pid()");
        if(q.rowCount) {waiting=true;break;}
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(waiting,true,'mutation did not lock the authorization rows');
      await c.query('COMMIT');
      const r=await pending;
      assert.equal(r.statusCode,resource==='archive'?409:403,r.body);
      assert.equal((await pool.query('SELECT assessment FROM specialist_cases WHERE id=$1',[x.caseId])).rows[0].assessment,'');
    } finally {await c.query('ROLLBACK');c.release();if(pending) await pending;}
  });
}

for(const domain of ['health','education']) {
  test(`${domain}: active specialist workflow still completes and closing its referral removes specialist read access`,async()=>{
    const x=await specialistFixture(domain);
    assert.equal((await request(x.cookie,{method:'GET',url:`/api/specialist-cases/${x.caseId}/documents`})).statusCode,200);
    const download=await request(x.cookie,{method:'GET',url:`/api/specialist-documents/${x.documentId}/download`,headers:{'x-access-reason':'بررسی آزمایشی'}});
    assert.equal(download.statusCode,200,download.body);
    assert.equal(download.rawPayload.toString('base64'),specialistDocument.contentBase64);
    const patch=await request(x.cookie,{method:'PATCH',url:`/api/specialist-cases/${x.caseId}`,payload:{assessment:'ارزیابی معتبر',result:'نتیجه آزمایشی'}});
    assert.equal(patch.statusCode,200,patch.body);
    const flow=domain==='health'?['initial_assessment','appointment_scheduled','in_treatment','completed']:['assessment','support_plan','follow_up','completed'];
    for(const to of flow) {
      const r=await request(x.cookie,{method:'POST',url:`/api/specialist-cases/${x.caseId}/transition`,payload:{to}});
      assert.equal(r.statusCode,200,r.body);
    }
    assert.equal((await pool.query('SELECT status FROM service_referrals WHERE id=$1',[x.referralId])).rows[0].status,'done');
    assert.equal((await request(x.cookie,{method:'GET',url:`/api/specialist-cases/${x.caseId}/documents`})).statusCode,403);
    assert.equal((await request(admin,{method:'GET',url:`/api/specialist-cases/${x.caseId}/documents`})).statusCode,200);
  });
}

// Shared scope/archive policy regressions. All records and secrets below are synthetic.
async function specialistInFamily(familyId: string, domain: string) {
  const user=await createUser(domain==='health'?'health_officer':'education_officer');
  const referralId=await specialistReferral(familyId,user.id,domain);
  const c=await request(user.cookie,{method:'POST',url:`/api/families/${familyId}/specialist-cases`,payload:{domain,referralId,summary:`SYNTHETIC_${domain}_SUMMARY`}});
  assert.equal(c.statusCode,201,c.body);const caseId=c.json().specialistCaseId as string;
  const updated=await request(user.cookie,{method:'PATCH',url:`/api/specialist-cases/${caseId}`,payload:{assessment:`SYNTHETIC_${domain}_ASSESSMENT`,result:`SYNTHETIC_${domain}_RESULT`}});
  assert.equal(updated.statusCode,200,updated.body);
  const d=await request(user.cookie,{method:'POST',url:`/api/specialist-cases/${caseId}/documents`,payload:{...specialistDocument,fileName:`SYNTHETIC_${domain}_PRIVATE.pdf`}});
  assert.equal(d.statusCode,201,d.body);
  return {...user,caseId,referralId,documentId:d.json().documentId as string};
}
test('summary roles cannot obtain specialist cases, assessments, event history or document metadata',async()=>{
  const liaison=await createUser('liaison'),familyId=await createFamily(liaison.id);
  const health=await specialistInFamily(familyId,'health');await specialistInFamily(familyId,'education');
  await pool.query("UPDATE specialist_cases SET next_follow_up_at='2026-12-01T12:00:00Z' WHERE id=$1",[health.caseId]);
  const download=await request(admin,{method:'GET',url:`/api/specialist-documents/${health.documentId}/download`,headers:{'x-access-reason':'SYNTHETIC_MEDICAL_ACCESS_REASON'}});
  assert.equal(download.statusCode,200,download.body);
  for(const [position,role] of [['viewer','viewer'],['finance_deputy','accountant'],['finance_officer','accountant'],['supervision_deputy','caseworker']]) {
    const user=await createUser(position!,role!);
    const r=await request(user.cookie,{method:'GET',url:`/api/families/${familyId}/specialist-cases`});
    assert.equal(r.statusCode,200,r.body);assert.equal(r.json().restricted,true);
    assert.deepEqual(r.json().cases,[]);assert.deepEqual(r.json().history,[]);assert.deepEqual(r.json().availableReferrals,[]);
    assert.equal(r.body.includes('SYNTHETIC_'),false);
    assert.equal((await request(user.cookie,{method:'GET',url:'/api/specialist-cases/inbox'})).statusCode,403);
  }
  const direct=await request(liaison.cookie,{method:'GET',url:`/api/families/${familyId}/specialist-cases`});
  assert.equal(direct.statusCode,200,direct.body);assert.equal(direct.json().restricted,true);
  const comprehensive=await request(liaison.cookie,{method:'GET',url:`/api/families/${familyId}/comprehensive`});
  assert.equal(comprehensive.statusCode,200,comprehensive.body);
  assert.deepEqual(comprehensive.json().specialistCases,[]);
  assert.equal(comprehensive.json().followUp.nextFollowUpAt,null);
  assert.equal(comprehensive.body.includes('SYNTHETIC_'),false,'comprehensive/timeline bypassed specialist permissions');
});
test('officers see only their active cases and deputies see only their own domain, consistently across list/history/documents',async()=>{
  const familyId=await createFamily(),health=await specialistInFamily(familyId,'health'),otherHealth=await specialistInFamily(familyId,'health'),education=await specialistInFamily(familyId,'education');
  const healthDeputy=await createUser('health_deputy'),educationDeputy=await createUser('education_deputy');
  for(const [user,allowed] of [[health,[health.caseId]],[otherHealth,[otherHealth.caseId]],[education,[education.caseId]],[healthDeputy,[health.caseId,otherHealth.caseId]],[educationDeputy,[education.caseId]]] as const) {
    const r=await request(user.cookie,{method:'GET',url:`/api/families/${familyId}/specialist-cases`});
    assert.equal(r.statusCode,200,r.body);
    assert.deepEqual(r.json().cases.map((c:{id:string})=>c.id).sort(),[...allowed].sort());
    assert.ok(r.json().history.every((e:{caseId:string})=>(allowed as readonly string[]).includes(e.caseId)));
    const inbox=await request(user.cookie,{method:'GET',url:'/api/specialist-cases/inbox'});
    assert.equal(inbox.statusCode,200,inbox.body);
    assert.ok(inbox.json().items.filter((c:{familyId:string})=>c.familyId===familyId).every((c:{id:string})=>(allowed as readonly string[]).includes(c.id)));
    for(const c of [health,otherHealth,education]) {
      const status=(allowed as readonly string[]).includes(c.caseId)?200:403;
      const docs=await request(user.cookie,{method:'GET',url:`/api/specialist-cases/${c.caseId}/documents`});
      assert.equal(docs.statusCode,status,docs.body);
      const dl=await request(user.cookie,{method:'GET',url:`/api/specialist-documents/${c.documentId}/download`,headers:{'x-access-reason':'آزمون حوزه'}});
      assert.equal(dl.statusCode,status,dl.body);
    }
  }
  const pending=await specialistReferral(familyId,education.id,'education');
  const denied=await request(healthDeputy.cookie,{method:'POST',url:`/api/families/${familyId}/specialist-cases`,payload:{domain:'education',referralId:pending,summary:'نباید ایجاد شود'}});
  assert.equal(denied.statusCode,403,denied.body);
  const all=await request(admin,{method:'GET',url:`/api/families/${familyId}/specialist-cases`});
  assert.equal(all.statusCode,200,all.body);assert.equal(all.json().cases.length,3);
});
test('stale action/report/financial ownership does not bypass current family scope',async()=>{
  const owner=await createUser('liaison'),old=await createUser('liaison'),familyId=await createFamily(owner.id);
  const action=(await pool.query("INSERT INTO case_actions(family_id,title,domain,status,proposed_by,assigned_to)VALUES($1,'اقدام قدیمی','general','assigned',$2,$2) RETURNING id",[familyId,old.id])).rows[0].id;
  const completed=await request(old.cookie,{method:'POST',url:`/api/actions/${action}/complete`,payload:{result:'نباید ذخیره شود'}});
  assert.equal(completed.statusCode,403,completed.body);
  const supervisor=(await pool.query("INSERT INTO supervisors(name,liaison_id,created_by)VALUES('سرپرست آزمایش',$1,$1)RETURNING id",[owner.id])).rows[0].id;
  const report=(await pool.query("INSERT INTO supervision_reports(family_id,supervisor_id,liaison_id,week_start,contact_at,contact_method,checklist,priority,summary)VALUES($1,$2,$3,'2026-10-17',now(),'phone','{}','normal','گزارش قدیمی')RETURNING id",[familyId,supervisor,old.id])).rows[0].id;
  for(const options of [
    {method:'PATCH',url:`/api/supervision-reports/${report}`,payload:{summary:'نباید ذخیره شود'}},
    {method:'POST',url:`/api/supervision-reports/${report}/submit`,payload:{}},
  ] as InjectOptions[]) assert.equal((await request(old.cookie,options)).statusCode,403);
  const financial=await createCase(familyId);
  await pool.query('UPDATE financial_cases SET created_by=$2 WHERE id=$1',[financial,old.id]);
  const doc=await request(admin,{method:'POST',url:`/api/financial-cases/${financial}/documents`,payload:{...specialistDocument,documentType:'supporting_document'}});
  assert.equal(doc.statusCode,201,doc.body);
  for(const options of [
    {method:'GET',url:`/api/financial-cases/${financial}/documents`},
    {method:'POST',url:`/api/financial-cases/${financial}/documents`,payload:{...specialistDocument,documentType:'supporting_document'}},
    {method:'GET',url:`/api/financial-documents/${doc.json().documentId}/download`,headers:{'x-access-reason':'آزمون دسترسی'}},
  ] as InjectOptions[]) assert.equal((await request(old.cookie,options)).statusCode,403);
});
test('a specialist cannot reopen a closed referral to regain family access',async()=>{
  const x=await specialistFixture();
  assert.equal((await request(admin,{method:'PATCH',url:`/api/referrals/${x.referralId}`,payload:{status:'cancelled'}})).statusCode,200);
  const reopened=await request(x.cookie,{method:'PATCH',url:`/api/referrals/${x.referralId}`,payload:{status:'open'}});
  assert.equal(reopened.statusCode,403,reopened.body);
  assert.equal((await pool.query('SELECT status FROM service_referrals WHERE id=$1',[x.referralId])).rows[0].status,'cancelled');
  assert.equal((await request(admin,{method:'PATCH',url:`/api/referrals/${x.referralId}`,payload:{status:'open'}})).statusCode,200);
});
test('shared archive gate covers direct families, child IDs, financial sources and linked allocation/inventory routes',async()=>{
  const x=await specialistFixture(),financial=await createCase(x.familyId);
  const action=(await pool.query("INSERT INTO case_actions(family_id,title,domain,proposed_by)VALUES($1,'اقدام آزمایش','general',$2)RETURNING id",[x.familyId,x.id])).rows[0].id;
  const note=(await pool.query("INSERT INTO notes(family_id,body,created_by)VALUES($1,'یادداشت آزمایش',$2)RETURNING id",[x.familyId,x.id])).rows[0].id;
  const doc=(await pool.query("INSERT INTO family_documents(family_id,file_name,mime_type,category,file_data,size_bytes,created_by)VALUES($1,'synthetic.pdf','application/pdf','سایر',$2,$3,$4)RETURNING id",[x.familyId,Buffer.from('%PDF-1.4'),8,x.id])).rows[0].id;
  const change=(await pool.query("INSERT INTO family_change_requests(family_id,requested_by,proposed_data)VALUES($1,$2,'{}')RETURNING id",[x.familyId,x.id])).rows[0].id;
  const supervisor=(await pool.query("INSERT INTO supervisors(name,liaison_id,created_by)VALUES('سرپرست آزمایش',$1,$1)RETURNING id",[x.id])).rows[0].id;
  const report=(await pool.query("INSERT INTO supervision_reports(family_id,supervisor_id,liaison_id,week_start,contact_at,contact_method,checklist,priority,summary)VALUES($1,$2,$3,'2026-10-17',now(),'phone','{}','normal','گزارش آزمایش')RETURNING id",[x.familyId,supervisor,x.id])).rows[0].id;
  const archived=await request(admin,{method:'POST',url:`/api/families/${x.familyId}/archive`,payload:{reason:'آزمون محافظ سراسری'}});
  assert.equal(archived.statusCode,200,archived.body);
  const endpoints: [string,string,unknown?][]=[
    ['PATCH',`/families/${x.familyId}`],['PUT',`/families/${x.familyId}/profile`],
    ['POST',`/families/${x.familyId}/actions`],['POST',`/families/${x.familyId}/notes`],
    ['POST',`/families/${x.familyId}/documents`],['POST',`/families/${x.familyId}/referrals`],
    ['POST',`/families/${x.familyId}/supervisor`],['POST',`/families/${x.familyId}/tags`],
    ['DELETE',`/families/${x.familyId}/tags/${x.id}`],['PATCH',`/families/${x.familyId}/geography`],
    ['PUT',`/families/${x.familyId}/supervision-plan`],['POST',`/families/${x.familyId}/supervision-reports`],
    ['POST',`/families/${x.familyId}/review`],['POST',`/families/${x.familyId}/financial-cases`],
    ['POST',`/actions/${action}/assign`],['POST',`/actions/${action}/complete`],['POST',`/actions/${action}/review`],['POST',`/actions/${action}/cancel`],
    ['PATCH',`/notes/${note}`],['DELETE',`/documents/${doc}`],['POST',`/documents/${doc}/replace`],
    ['PATCH',`/referrals/${x.referralId}`],['POST',`/family-change-requests/${change}/review`],
    ['PATCH',`/supervision-reports/${report}`],['POST',`/supervision-reports/${report}/submit`],['POST',`/supervision-reports/${report}/review`],['POST',`/supervision-reports/${report}/actions`],
    ['PATCH',`/financial-cases/${financial}`],['POST',`/financial-cases/${financial}/transition`],['POST',`/financial-cases/${financial}/pay`],['POST',`/financial-cases/${financial}/documents`],
    ['POST','/financial-sources/request',{sourceType:'health_case',sourceId:x.caseId}],
    ['POST',`/donations/${x.id}/allocate`,{familyId:x.familyId}],['POST','/inventory/transactions',{familyId:x.familyId}],
  ];
  for(const [method,url,payload] of endpoints) {
    const r=await request(admin,{method:method as InjectOptions['method'],url:'/api'+url,payload:payload??{}});
    assert.equal(r.statusCode,409,`${method} ${url}: ${r.body}`);assert.equal(r.json().error,'FAMILY_ARCHIVED');
  }
  const viewer=await createUser('viewer','viewer');
  assert.equal((await request(viewer.cookie,{method:'POST',url:`/api/families/${x.familyId}/actions`,payload:{title:'نباید ثبت شود'}})).statusCode,403);
  assert.equal((await request(admin,{method:'GET',url:`/api/families/${x.familyId}`})).statusCode,200);
  assert.equal((await request(admin,{method:'GET',url:`/api/specialist-documents/${x.documentId}/download`,headers:{'x-access-reason':'خواندن تاریخچه'}})).statusCode,200);
});
test('database archive invariant covers all twenty business child tables, including indirect payments',async()=>{
  const familyId=await createFamily(),financial=await createCase(familyId);
  await pool.query('UPDATE families SET archived=true WHERE id=$1',[familyId]);
  const tables=['family_members','notes','family_documents','family_change_requests','family_supervisor_assignments','service_referrals','family_supervision_plans','supervision_reports','case_actions','case_action_events','specialist_cases','specialist_case_documents','specialist_case_events','financial_cases','financial_case_documents','financial_case_events','family_tag_assignments','donation_allocations','inventory_transactions'];
  for(const table of tables) {
    // BEFORE triggers must reject archived writes before any NOT NULL/FK checks.
    await assert.rejects(pool.query(`INSERT INTO ${table}(family_id) VALUES($1)`,[familyId]),(e:any)=>e.code==='P7501',table);
  }
  await assert.rejects(pool.query('INSERT INTO financial_payments(financial_case_id) VALUES($1)',[financial]),(e:any)=>e.code==='P7501');
  await assert.rejects(pool.query('UPDATE families SET notes=$2 WHERE id=$1',[familyId,'نباید ذخیره شود']),(e:any)=>e.code==='P7501');
  await assert.rejects(pool.query('DELETE FROM families WHERE id=$1',[familyId]),(e:any)=>e.code==='P7501');
  await assert.rejects(pool.query('UPDATE families SET archived=false,notes=$2 WHERE id=$1',[familyId,'تغییر همزمان با بازگشایی']),(e:any)=>e.code==='P7501');
  // Reading archived data is still auditable; these logs are deliberately exempt.
  await pool.query("INSERT INTO audit_logs(action,entity_type,entity_id,details)VALUES('test.archived.read','family',$1,'{}')",[familyId]);
  const reopened=await request(admin,{method:'POST',url:`/api/families/${familyId}/unarchive`,payload:{reason:'بازگشایی آزمایشی'}});
  assert.equal(reopened.statusCode,200,reopened.body);
  await pool.query("INSERT INTO notes(family_id,body)VALUES($1,'یادداشت بعد از بازگشایی')",[familyId]);
});
test('database guard prevents editing, deleting or moving an existing child out of an archived family',async()=>{
  const familyId=await createFamily(),other=await createFamily();
  const note=(await pool.query("INSERT INTO notes(family_id,body)VALUES($1,'یادداشت تاریخی')RETURNING id",[familyId])).rows[0].id;
  await pool.query('UPDATE families SET archived=true WHERE id=$1',[familyId]);
  await assert.rejects(pool.query("UPDATE notes SET body='نباید ذخیره شود' WHERE id=$1",[note]),(e:any)=>e.code==='P7501');
  await assert.rejects(pool.query('DELETE FROM notes WHERE id=$1',[note]),(e:any)=>e.code==='P7501');
  await assert.rejects(pool.query('UPDATE notes SET family_id=$2 WHERE id=$1',[note,other]),(e:any)=>e.code==='P7501');
  const row=(await pool.query('SELECT family_id,body FROM notes WHERE id=$1',[note])).rows[0];
  assert.equal(row.family_id,familyId);assert.equal(row.body,'یادداشت تاریخی');
});
test('bulk transactions roll back earlier writes when an archived family is encountered',async()=>{
  const active=await createFamily(),archived=await createFamily(),c=await pool.connect();
  await pool.query('UPDATE families SET archived=true WHERE id=$1',[archived]);
  try {
    await c.query('BEGIN');
    await c.query("INSERT INTO notes(family_id,body)VALUES($1,'SYNTHETIC_ROLLBACK')",[active]);
    await assert.rejects(c.query("INSERT INTO notes(family_id,body)VALUES($1,'SYNTHETIC_FORBIDDEN')",[archived]),(e:any)=>e.code==='P7501');
    await c.query('ROLLBACK');
    assert.equal((await pool.query("SELECT count(*)::int n FROM notes WHERE family_id=ANY($1::uuid[]) AND body LIKE 'SYNTHETIC_%'",[[active,archived]])).rows[0].n,0);
  }finally{await c.query('ROLLBACK');c.release();}
});
test('a write that passed the API precheck still fails if archive commits before the SQL write',async()=>{
  const familyId=await createFamily(),c=await pool.connect();let pending:Promise<any>|undefined;
  try {
    await c.query('BEGIN');await c.query('UPDATE families SET archived=true WHERE id=$1',[familyId]);
    pending=pool.query("INSERT INTO notes(family_id,body)VALUES($1,'SYNTHETIC_RACE')",[familyId]).then(()=>({ok:true}),e=>({code:e.code}));
    let waiting=false;
    for(let i=0;i<100;i++) {
      const q=await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'INSERT INTO notes%' AND pid<>pg_backend_pid()");
      if(q.rowCount){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'write did not wait for archive');await c.query('COMMIT');
    assert.equal((await pending).code,'P7501');
    assert.equal((await pool.query("SELECT count(*)::int n FROM notes WHERE family_id=$1 AND body='SYNTHETIC_RACE'",[familyId])).rows[0].n,0);
  }finally{await c.query('ROLLBACK');c.release();if(pending)await pending;}
});
test('archive waits for an already authorized child write, then makes later writes read-only',async()=>{
  const familyId=await createFamily(),c=await pool.connect();let pending:ReturnType<typeof request>|undefined;
  try {
    await c.query('BEGIN');await c.query("INSERT INTO notes(family_id,body)VALUES($1,'SYNTHETIC_BEFORE_ARCHIVE')",[familyId]);
    pending=request(admin,{method:'POST',url:`/api/families/${familyId}/archive`,payload:{reason:'آزمون ترتیب تراکنش'}});
    let waiting=false;
    for(let i=0;i<100;i++) {
      const q=await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%UPDATE families SET archived=true%' AND pid<>pg_backend_pid()");
      if(q.rowCount){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'archive did not wait for child transaction');await c.query('COMMIT');
    const r=await pending;assert.equal(r.statusCode,200,r.body);
    assert.equal((await pool.query('SELECT archived FROM families WHERE id=$1',[familyId])).rows[0].archived,true);
    assert.equal((await pool.query("SELECT count(*)::int n FROM notes WHERE family_id=$1 AND body='SYNTHETIC_BEFORE_ARCHIVE'",[familyId])).rows[0].n,1);
  }finally{await c.query('ROLLBACK');c.release();if(pending)await pending;}
});

test('current in-scope liaison can create an action, but stale inbox ownership does not leak it',async()=>{
  const owner=await createUser('liaison'),outsider=await createUser('liaison'),familyId=await createFamily(owner.id);
  const payload={title:'اقدام مجاز آزمایشی'};
  assert.equal((await request(outsider.cookie,{method:'POST',url:`/api/families/${familyId}/actions`,payload})).statusCode,403);
  const created=await request(owner.cookie,{method:'POST',url:`/api/families/${familyId}/actions`,payload});
  assert.equal(created.statusCode,201,created.body);const id=created.json().actionId;
  await pool.query("UPDATE case_actions SET assigned_to=$2,status='assigned' WHERE id=$1",[id,owner.id]);
  let inbox=await request(owner.cookie,{method:'GET',url:'/api/actions/inbox'});
  assert.equal(inbox.statusCode,200,inbox.body);assert.ok(inbox.json().items.some((x:any)=>x.id===id));
  await pool.query('UPDATE families SET assigned_to=$2 WHERE id=$1',[familyId,outsider.id]);
  inbox=await request(owner.cookie,{method:'GET',url:'/api/actions/inbox'});
  assert.equal(inbox.statusCode,200,inbox.body);assert.ok(!inbox.json().items.some((x:any)=>x.id===id));
});
test('finance deputy retains permitted notes and finance officer can pay a properly referred case',async()=>{
  const deputy=await createUser('finance_deputy','accountant'),officer=await createUser('finance_officer','accountant'),familyId=await createFamily();
  const note=await request(deputy.cookie,{method:'POST',url:`/api/families/${familyId}/notes`,payload:{text:'یادداشت مجاز مالی'}});
  assert.equal(note.statusCode,201,note.body);
  const id=await createCase(familyId);
  for(const action of ['review','approve','refer'])assert.equal((await transition(admin,id,action)).statusCode,200);
  const fund=await request(admin,{method:'POST',url:'/api/funds',payload:{name:'صندوق گردش مجاز',description:''}});
  assert.equal(fund.statusCode,201,fund.body);const fundId=fund.json().fundId;
  assert.equal((await request(admin,{method:'PUT',url:`/api/funds/${fundId}/budget`,payload:{jalaliYear:1405,jalaliMonth:7,amount:1000}})).statusCode,200);
  const pay=await request(officer.cookie,{method:'POST',url:`/api/financial-cases/${id}/pay`,payload:{fundId,jalaliYear:1405,jalaliMonth:7,paidAt:'2026-10-19',referenceNo:'permitted-finance',receipt:null}});
  assert.equal(pay.statusCode,201,pay.body);
});
test('clinical financial-source requests respect the department and active family scope',async()=>{
  const familyId=await createFamily(),health=await specialistInFamily(familyId,'health');
  const good=await createUser('health_deputy'),wrong=await createUser('education_deputy');
  await pool.query("UPDATE specialist_cases SET status='completed' WHERE id=$1",[health.caseId]);
  await pool.query("UPDATE service_referrals SET status='done' WHERE id=$1",[health.referralId]);
  const payload={sourceType:'health_case',sourceId:health.caseId,title:'درخواست هزینه مجاز',category:'بهداشت و درمان',amount:100};
  assert.equal((await request(wrong.cookie,{method:'POST',url:'/api/financial-sources/request',payload})).statusCode,403);
  assert.equal((await request(health.cookie,{method:'POST',url:'/api/financial-sources/request',payload})).statusCode,403);
  const allowed=await request(good.cookie,{method:'POST',url:'/api/financial-sources/request',payload});
  assert.equal(allowed.statusCode,201,allowed.body);
});
test('authenticated API responses, including denied responses, must not be cached',async()=>{
  const viewer=await createUser('viewer','viewer'),familyId=await createFamily();
  for(const [url,status] of [[`/api/families/${familyId}`,200],[`/api/families/${familyId}/comprehensive`,403]] as const){
    const r=await request(viewer.cookie,{method:'GET',url});assert.equal(r.statusCode,status,r.body);
    assert.equal(r.headers['cache-control'],'private, no-store');
  }
});

test('message unread count spans the 100-item window and reads never acknowledge or cross recipients',async()=>{
 const recipient=await createUser('liaison'),outsider=await createUser('liaison');
 const sent=await request(admin,{method:'POST',url:'/api/messages',payload:{title:'پیام قدیمی آزمایشی',body:'تأیید باید فقط با اقدام صریح انجام شود',recipientIds:[recipient.id],acknowledgementRequired:true}});
 assert.equal(sent.statusCode,201,sent.body);const id=sent.json().messageId;
 await pool.query("UPDATE liaison_messages SET created_at=now()-interval '1 day' WHERE id=$1",[id]);
 await pool.query(`WITH messages AS (
   INSERT INTO liaison_messages(sender_id,sender_name,sender_position,title,body,severity)
   SELECT sender_id,sender_name,sender_position,'پیام جدید خوانده‌شده','داده ساختگی آزمون','important' FROM liaison_messages,generate_series(1,100) WHERE id=$1 RETURNING id
 ) INSERT INTO liaison_message_recipients(message_id,recipient_id,read_at) SELECT id,$2,now() FROM messages`,[id,recipient.id]);
 const inbox=await request(recipient.cookie,{method:'GET',url:'/api/messages/inbox?includeRead=true'});
 assert.equal(inbox.statusCode,200,inbox.body);assert.equal(inbox.json().messages.length,100);assert.equal(inbox.json().unread,1);assert.equal('unreadTotal' in inbox.json().messages[0],false);
 assert.equal((await request(outsider.cookie,{method:'GET',url:'/api/messages/inbox?includeRead=true'})).json().messages.length,0);
 assert.equal((await request(outsider.cookie,{method:'POST',url:`/api/messages/${id}/read`,payload:{}})).statusCode,404);
 assert.equal((await request(outsider.cookie,{method:'POST',url:`/api/messages/${id}/acknowledge`,payload:{}})).statusCode,404);
 assert.equal((await request(recipient.cookie,{method:'POST',url:`/api/messages/${id}/read`,payload:{}})).statusCode,200);
 let row=(await pool.query('SELECT read_at,acknowledged_at FROM liaison_message_recipients WHERE message_id=$1 AND recipient_id=$2',[id,recipient.id])).rows[0];assert.ok(row.read_at);assert.equal(row.acknowledged_at,null);
 assert.equal((await request(recipient.cookie,{method:'POST',url:`/api/messages/${id}/acknowledge`,payload:{}})).statusCode,200);
 row=(await pool.query('SELECT acknowledged_at FROM liaison_message_recipients WHERE message_id=$1 AND recipient_id=$2',[id,recipient.id])).rows[0];assert.ok(row.acknowledged_at);
});
