import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {familyInput} from '../src/domain/familyInput.js';
import {validateEnhancedFamily,iranDivisions} from '../src/domain/persianFields.js';
const R=createRequire(import.meta.url)('../src/domain/persianRules.cjs');
const base={caseNumber:'620',familySurname:'آزمایشی',headName:'سرپرست نمونه',headNationalId:'1000000011',headPhone:'09120000000'};
test('browser and server share identical Persian rules and versioned location data',()=>{
 assert.equal(readFileSync('public/app/persian-rules.js','utf8'),readFileSync('src/domain/persianRules.cjs','utf8'));
 assert.equal(readFileSync('public/app/iran-divisions.js','utf8'),readFileSync('src/domain/iranDivisions.cjs','utf8'));
 assert.equal(Object.keys(iranDivisions).length,31);assert.ok(iranDivisions['تهران']?.includes('تهران'));
});
test('digits and checksums retain zeroes, reject excess and do not delete letters',()=>{
 assert.equal(R.digits('۰۰۱-۲۳۴۵۶۷-۸'),'0012345678');assert.equal(R.digits('٠٠١ ٢٣٤'),'001234');assert.equal(R.digits('12abc34'),'12abc34');
 assert.equal(R.national('1000000011'),true);assert.equal(R.national('1111111111'),false);assert.equal(R.national('10000000110'),false);
 assert.equal(R.card('۶۰۳۷ ۹۹۰۰ ۰۰۰۰ ۰۰۰۶'),true);assert.equal(R.card('6037990000000000'),false);assert.equal(R.card('0000000000000000'),false);
 assert.equal(R.iban('IR062960000000100324200001'),true);assert.equal(R.iban('IR062960000000100324200002'),false);assert.equal(R.iban('IR0629600000001003242000010'),false);
 assert.equal(R.postal('۸۱۶۳۸-۴۷۳۵۱'),true);assert.equal(R.postal('81638473510'),false);assert.equal(R.postal('0000000000'),false);
});
test('time validation is strict and banks are informational',()=>{
 for(const t of ['00:00','14:30','23:59'])assert.equal(R.time(t),true);
 for(const t of ['25:80','24:00','14:60','1:30','13:5'])assert.equal(R.time(t),false);
 assert.equal(R.cardBank('6037990000000006'),'ملی');assert.equal(R.cardBank('9999990000000000'),null);
});
test('server rejects invalid new bank/address data while preserving unchanged legacy values',()=>{
 const f=familyInput.parse({...base,headCardNumber:'۶۰۳۷ ۹۹۰۰ ۰۰۰۰ ۰۰۰۶',headIban:'IR062960000000100324200001',province:'تهران',city:'تهران',postalCode:'۸۱۶۳۸-۴۷۳۵۱'});
 validateEnhancedFamily(f);assert.equal(f.headCardNumber,'6037990000000006');assert.equal(f.postalCode,'8163847351');
 for(const patch of [{headCardNumber:'6037990000000000'},{headIban:'IR062960000000100324200002'},{province:'تهران',city:'شیراز'},{province:'غیرمجاز',city:'تهران'},{postalCode:'0000000000'}])assert.throws(()=>validateEnhancedFamily({...base,...patch}));
 assert.doesNotThrow(()=>validateEnhancedFamily({...base,headCardNumber:'6037990000000000'},{headCardNumber:'6037990000000000'}));
 assert.throws(()=>validateEnhancedFamily({...base,headCardNumber:'6037990000000010'},{headCardNumber:'6037990000000000'}));
});
