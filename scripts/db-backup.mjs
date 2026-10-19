import {createWriteStream} from 'node:fs';
import {link,unlink} from 'node:fs/promises';
import {randomBytes,scryptSync,createCipheriv} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {finished} from 'node:stream/promises';
import {databaseTool,exited} from './lib/database-tools.mjs';
const pass=process.env.BACKUP_ENCRYPTION_KEY;
if(!pass||pass.length<16){console.error('BACKUP_ENCRYPTION_KEY (minimum 16 characters) is required');process.exit(2)}
const out=process.argv[2]||`family-case-${new Date().toISOString().slice(0,10)}.dump.enc`;
const temporary=out+'.partial-'+randomBytes(8).toString('hex');
let child,file;
try {
  const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',scryptSync(pass,salt,32),iv);
  file=createWriteStream(temporary,{flags:'wx',mode:0o600});
  file.write(Buffer.concat([Buffer.from('FCBK1'),salt,iv]));
  child=databaseTool('pg_dump',['-Fc','--no-owner','--no-acl']);
  child.stdin.end();
  const completion=exited(child);
  // Always consume both outcomes, including early executable/stream failures.
  await Promise.all([pipeline(child.stdout,cipher,file,{end:false}),completion]);
  file.end(cipher.getAuthTag());await finished(file);
  await link(temporary,out); // atomic publication; never overwrite an existing backup
  console.log(`encrypted backup written: ${out}`);
} catch {
  child?.kill();console.error('backup failed; no complete backup published');process.exitCode=1;
} finally {file?.destroy();await unlink(temporary).catch(()=>{});}
