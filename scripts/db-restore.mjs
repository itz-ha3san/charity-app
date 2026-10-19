import {createReadStream,createWriteStream} from 'node:fs';
import {open,stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDecipheriv,scryptSync} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {databaseTool,exited} from './lib/database-tools.mjs';
const file=process.argv[2],pass=process.env.BACKUP_ENCRYPTION_KEY,target=process.env.RESTORE_DATABASE;
if(!file||!pass||pass.length<16){console.error('usage: BACKUP_ENCRYPTION_KEY=... RESTORE_DATABASE=... RESTORE_CONFIRM=... npm run db:restore -- backup.dump.enc');process.exit(2)}
if(!target||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(target)||process.env.RESTORE_CONFIRM!==target){console.error('Explicit RESTORE_DATABASE and identical RESTORE_CONFIRM are required');process.exit(2)}
let directory,child;
try {
  const size=(await stat(file)).size;if(size<49)throw Error('invalid backup');
  const fd=await open(file,'r'),header=Buffer.alloc(33),tag=Buffer.alloc(16);
  try{await fd.read(header,0,33,0);await fd.read(tag,0,16,size-16)}finally{await fd.close()}
  if(header.subarray(0,5).toString()!=='FCBK1')throw Error('unsupported format');
  const decipher=createDecipheriv('aes-256-gcm',scryptSync(pass,header.subarray(5,21),32),header.subarray(21,33));decipher.setAuthTag(tag);
  directory=await mkdtemp(join(tmpdir(),'charity-restore-'));
  const plaintext=join(directory,'verified.dump');
  // Authenticate the ENTIRE encrypted backup before starting pg_restore.
  // Otherwise a wrong key/corrupted tail could leave a partially modified DB.
  await pipeline(createReadStream(file,{start:33,end:size-17}),decipher,createWriteStream(plaintext,{flags:'wx',mode:0o600}));
  child=databaseTool('pg_restore',['--clean','--if-exists','--no-owner','--no-acl','--exit-on-error','--single-transaction'],{database:target});
  child.stdout.resume();
  const completion=exited(child);
  await Promise.all([pipeline(createReadStream(plaintext),child.stdin),completion]);
  console.log(`restore completed: ${target}`);
} catch {
  child?.kill();console.error('restore failed: verify key, backup integrity and database target');process.exitCode=1;
} finally {if(directory)await rm(directory,{recursive:true,force:true});}
