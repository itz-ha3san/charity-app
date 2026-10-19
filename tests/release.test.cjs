const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
test('QA database guard refuses remote hosts, real database names and missing URLs',async()=>{
 const {assertTestDatabase}=await import('../scripts/lib/test-database.mjs');
 assert.equal(assertTestDatabase('postgresql://qa@127.0.0.1:5432/charity_browser_test').pathname,'/charity_browser_test');
 for(const url of [undefined,'postgresql://qa@prod.example/charity_test','postgresql://qa@localhost/family_case','postgresql://qa@localhost/test_production','https://localhost/charity_test'])assert.throws(()=>assertTestDatabase(url));
});
test('restore refuses every target without exact explicit confirmation, before any database tool',()=>{
 const r=spawnSync(process.execPath,['scripts/db-restore.mjs','nonexistent.dump.enc'],{env:{...process.env,BACKUP_ENCRYPTION_KEY:'synthetic_key_12345678',RESTORE_DATABASE:'family_case',RESTORE_CONFIRM:''},encoding:'utf8',timeout:3000});
 assert.equal(r.status,2);assert.match(r.stderr,/identical RESTORE_CONFIRM/);
});
test('backup refuses missing encryption key',()=>{
 const r=spawnSync(process.execPath,['scripts/db-backup.mjs'],{env:{...process.env,BACKUP_ENCRYPTION_KEY:''},encoding:'utf8',timeout:3000});
 assert.equal(r.status,2);assert.match(r.stderr,/BACKUP_ENCRYPTION_KEY/);
});
test('release artifact has an all-success gate and no production credentials',()=>{
 const s=fs.readFileSync('.github/workflows/quality.yml','utf8');
 assert.match(s,/needs: \[quality, integration, browser, recovery, container\]/);
 assert.match(s,/all\(\.\[\]; \.result == "success"\)/);
 assert.match(s,/needs: \[release-gate\]/);assert.doesNotMatch(s,/pull_request_target|secrets\./);
 assert.match(s,/permissions:\n  contents: read/);
});
