import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync('public/index.html','utf8'),manifest=JSON.parse(readFileSync('public/app/manifest.json','utf8'));
let previous=-1;
for(const src of manifest.eager){
 const position=html.indexOf(`src="${src}"`);
 if(position<=previous)throw Error(`Missing or out-of-order feature: ${src}`);
 previous=position;
}
for(const src of [...manifest.eager,...Object.values(manifest.lazy)]){
 if(!existsSync('public'+src))throw Error(`Missing frontend asset: ${src}`);
 new Script(readFileSync('public'+src,'utf8'),{filename:src});
}
// Parse concatenated declarations too: individual-file checks miss duplicate lexical names.
new Script(manifest.eager.map(src=>readFileSync('public'+src,'utf8')).join('\n')+'\n'+readFileSync('public/app/admin.js','utf8'));
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!match[1].includes('src=')&&match[2].trim())throw Error('Application code must not return to inline scripts');
for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]*)/g))if(!existsSync('public'+match[1]))throw Error(`Missing linked asset ${match[1]}`);
console.log('Frontend manifest, syntax, load order and linked assets: PASS');
