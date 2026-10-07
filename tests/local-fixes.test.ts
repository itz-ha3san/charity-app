import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {reportRangeShape,validateReportRange,validateReportPeriod} from '../src/reportFilters.js';
const require=createRequire(import.meta.url);
const rules=require('../src/reportRules.cjs');
const range=z.object(reportRangeShape).superRefine(validateReportRange);
const period=z.object({jalaliYear:z.coerce.number().int().min(1300).optional(),jalaliMonth:z.coerce.number().int().min(1).max(12).optional()}).superRefine(validateReportPeriod);
test('browser/server report rules stay identical',()=>{
  assert.equal(readFileSync(new URL('../src/reportRules.cjs',import.meta.url),'utf8'),readFileSync(new URL('../public/report-rules.js',import.meta.url),'utf8'));
});
test('Iran midnight determines today, not the server timezone',()=>{
  assert.equal(rules.today(new Date('2026-10-07T20:29:59Z')),'2026-10-07');
  assert.equal(rules.today(new Date('2026-10-07T20:30:00Z')),'2026-10-08');
});
test('empty, historical and today report ranges are valid',()=>{
  assert.equal(range.safeParse({}).success,true);
  assert.equal(range.safeParse({from:'2020-01-01',to:rules.today()}).success,true);
  assert.equal(range.safeParse({from:rules.today(),to:rules.today()}).success,true);
});
test('future, reversed and invalid calendar dates are rejected',()=>{
  for(const q of [{from:'9999-01-01'},{to:'9999-01-01'},{from:'2021-01-01',to:'2020-01-01'},{from:'2026-02-30'}])assert.equal(range.safeParse(q).success,false);
});
test('current month and previous years are accepted; future periods rejected',()=>{
  const p=rules.currentPeriod();
  for(const q of [{},{jalaliYear:p.year,jalaliMonth:p.month},{jalaliYear:p.year-1,jalaliMonth:12}])assert.equal(period.safeParse(q).success,true);
  for(const q of [{jalaliYear:p.year+1,jalaliMonth:1},{jalaliYear:p.year},{jalaliMonth:1},{jalaliYear:p.year,jalaliMonth:13}])assert.equal(period.safeParse(q).success,false);
  if(p.month<12)assert.equal(period.safeParse({jalaliYear:p.year,jalaliMonth:p.month+1}).success,false);
});
test('financial limits roll over at Nowruz instead of using a fixed year',()=>{
  assert.deepEqual(rules.currentPeriod(new Date('2026-03-20T10:00:00Z')),{year:1404,month:12});
  assert.deepEqual(rules.currentPeriod(new Date('2026-03-21T10:00:00Z')),{year:1405,month:1});
  assert.equal(rules.periodErrors({jalaliYear:1405,jalaliMonth:2},new Date('2026-03-21T10:00:00Z')).length,1);
  assert.equal(rules.periodErrors({jalaliYear:1404,jalaliMonth:12},new Date('2026-03-21T10:00:00Z')).length,0);
});
