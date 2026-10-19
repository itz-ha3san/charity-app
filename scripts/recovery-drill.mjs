import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
import {assertTestDatabase} from './lib/test-database.mjs';
const source=assertTestDatabase(process.env.TEST_DATABASE_URL),target=new URL(source);
target.pathname=source.pathname.replace(/_test$/,'_restored_test');
assertTestDatabase(target.href);assert.ok(target.pathname.length<=64,'test database name too long');
const name=target.pathname.slice(1),control=new URL(source);control.pathname='/postgres';
const admin=new pg.Pool({connectionString:control.href}),original=new pg.Pool({connectionString:source.href});
let restored,directory,created=false,server;
const environment={...process.env,NODE_ENV:'test',BACKUP_TRANSPORT:'local',DATABASE_URL:source.href,BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
function run(script,args=[],env={}){
 const r=spawnSync(process.execPath,[script,...args],{env:{...environment,...env},encoding:'utf8',timeout:120000});
 return {ok:!r.error&&r.status===0,status:r.status}; // do not echo credentials or dump content
}
async function fingerprint(db){
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const result=[];
 for(const {tablename} of tables){const q='"'+tablename.replaceAll('"','""')+'"';const row=(await db.query(`SELECT count(*)::int rows,md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) hash FROM ${q} t`)).rows[0];result.push({table:tablename,...row});}
 return result;
}
try {
 if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)throw Error('Restore target already exists; refusing to touch it');
 directory=await mkdtemp(join(tmpdir(),'charity-recovery-test-'));
 assert.ok(run('scripts/seed-test.mjs',[],{QA_FIXTURE_PATH:join(directory,'fixture.json')}).ok,'synthetic seed failed (use a fresh empty test database)');
 const before=await fingerprint(original),file=join(directory,'snapshot.dump.enc');
 assert.ok(run('scripts/db-backup.mjs',[file]).ok,'encrypted backup failed');
 const bytes=await readFile(file),digest=createHash('sha256').update(bytes).digest('hex');
 assert.equal(run('scripts/db-backup.mjs',[file]).ok,false,'existing backup must not be overwritten');
 assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),digest);
 await admin.query(`CREATE DATABASE "${name}"`);created=true;restored=new pg.Pool({connectionString:target.href});
 await restored.query("CREATE TABLE recovery_probe (value text);INSERT INTO recovery_probe VALUES('SYNTHETIC_UNCHANGED')");
 const probe=await fingerprint(restored);
 const env={RESTORE_DATABASE:name,RESTORE_CONFIRM:name};
 assert.equal(run('scripts/db-restore.mjs',[file],{...env,RESTORE_CONFIRM:''}).ok,false,'missing confirmation must fail');
 assert.equal(run('scripts/db-restore.mjs',[file],{...env,BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('hex')}).ok,false,'wrong key must fail');
 assert.deepEqual(await fingerprint(restored),probe,'wrong key changed target');
 const corrupt=join(directory,'corrupt.dump.enc'),tampered=Buffer.from(bytes);tampered[tampered.length-1]^=1;await writeFile(corrupt,tampered,{mode:0o600});
 assert.equal(run('scripts/db-restore.mjs',[corrupt],env).ok,false,'corrupted tag must fail');
 assert.deepEqual(await fingerprint(restored),probe,'corrupted backup changed target');
 await restored.query('DROP TABLE recovery_probe');
 assert.ok(run('scripts/db-restore.mjs',[file],env).ok,'restore failed');
 assert.deepEqual(await fingerprint(restored),before,'restored data differs from backup source');
 assert.ok(run('dist/migrate.js',[],{DATABASE_URL:target.href}).ok,'restored schema migration rerun failed');
 assert.deepEqual(await fingerprint(restored),before,'migration rerun changed data');
 assert.deepEqual(await fingerprint(original),before,'recovery drill modified source');
 const port=process.env.RECOVERY_PORT||'4175';
 async function stop(){if(!server)return;const active=server;server=undefined;active.kill('SIGTERM');await new Promise(resolve=>{if(active.exitCode!==null)return resolve();active.once('exit',resolve);setTimeout(()=>{active.kill('SIGKILL');resolve()},5000).unref()})}
 async function smoke(cwd){
  server=spawn(process.execPath,['dist/server.js'],{cwd,env:{...environment,DATABASE_URL:target.href,PORT:port,COOKIE_SECURE:'false',LOG_LEVEL:'silent'},stdio:'ignore'});
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/ready`)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.ok(ready,'compiled app did not become ready');
  const login=await fetch(`http://127.0.0.1:${port}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'qa_admin',password:'SyntheticQaPass123'})});
  assert.equal(login.status,200,'login failed after recovery/rollback');
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const families=await fetch(`http://127.0.0.1:${port}/api/families`,{headers:{cookie}});assert.equal(families.status,200);assert.equal((await families.json()).families.length,1);
  await stop();
 }
 await smoke(process.cwd());
 const rollback=process.env.ROLLBACK_APP_DIR;
 if(rollback){await smoke(rollback);await smoke(process.cwd())}
 console.log(JSON.stringify({recovery:'PASS',tables:before.length,checks:['encrypted-backup','no-overwrite','explicit-confirmation','wrong-key-no-write','corruption-no-write','exact-data-restore','migration-rerun','source-unchanged','compiled-readiness-login-and-family-read',...(rollback?['previous-code-rollback','return-to-candidate']:[])]}));
} finally {
 if(server){server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve()},5000).unref()})}
 await restored?.end();await original.end();
 if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
 await admin.end();if(directory)await rm(directory,{recursive:true,force:true});
}
