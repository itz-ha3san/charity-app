// Build the previous commit as a compatibility probe; never deploy it automatically.
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,copyFile,access} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';
import {resolve} from 'node:path';
const ref=process.argv[2]||'HEAD^',root=process.cwd(),target=resolve('.tmp/rollback-release');
if(ref.startsWith('-'))throw Error('Invalid git revision');
const sha=spawnSync('git',['rev-parse','--verify',ref+'^{commit}'],{encoding:'utf8'});
if(sha.status!==0)throw Error('Previous commit unavailable; fetch at least two commits');
try{await access(target);throw Error('Rollback probe directory exists; use a clean workspace')}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(target,{recursive:true});
const archive=spawn('git',['archive',sha.stdout.trim()],{stdio:['ignore','pipe','inherit']});
const tar=spawn('tar',['-xf','-','-C',target],{stdio:['pipe','inherit','inherit']});
const archived=once(archive,'exit'),extracted=once(tar,'exit');
await pipeline(archive.stdout,tar.stdin);
if((await archived)[0]!==0||(await extracted)[0]!==0)throw Error('Previous commit extraction failed');
const install=spawnSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:target,stdio:'inherit',timeout:120000});
if(install.status!==0)throw Error('Previous release dependency install failed');
await copyFile('tsconfig.build.json',resolve(target,'tsconfig.build.json'));
const build=spawnSync(process.execPath,[resolve(root,'scripts/build.mjs')],{cwd:target,stdio:'inherit',timeout:120000});
if(build.status!==0)throw Error('Previous release build failed');
console.log(`Rollback compatibility probe prepared: ${sha.stdout.trim()}`);
