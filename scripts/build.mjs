import {existsSync} from 'node:fs';
if(existsSync('public/app/manifest.json'))await import('./check-frontend.mjs');
import {rm,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
await rm('dist',{recursive:true,force:true});
const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p','tsconfig.build.json'],{stdio:'inherit'});
if(result.error||result.status!==0)process.exit(result.status||1);
// CommonJS shared rules are loaded at runtime via createRequire, not emitted by tsc.
await copyFile('src/reportRules.cjs','dist/reportRules.cjs');
await copyFile('src/domain/persianRules.cjs','dist/domain/persianRules.cjs');
await copyFile('src/domain/iranDivisions.cjs','dist/domain/iranDivisions.cjs');
