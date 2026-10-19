import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastRecordedMonths as forecast, jalaliPeriod, shiftPeriod, planningEnvelope } from '../src/domain/financialAnalytics.js';
test('Jalali year rollover and Tehran period boundaries',()=>{
 assert.deepEqual(shiftPeriod({year:1405,month:12},1),{year:1406,month:1});
 assert.deepEqual(shiftPeriod({year:1405,month:1},-1),{year:1404,month:12});
 assert.deepEqual(jalaliPeriod(new Date('2026-10-18T20:49:56.629Z')),{year:1405,month:7});
});
test('no fabricated forecast with empty or sparse paid months',()=>{
 for(const v of [[],['100'],['100','0','100'],['0','0','0','0']])assert.equal(forecast(v).available,false);
});
test('baseline is exact beyond JS safe integer and does not overlap commitments twice',()=>{
 const f=forecast(['9007199254740993','9007199254740993','9007199254740993']);
 assert.equal(f.available,true);if(!f.available)return;
 assert.equal(f.estimate,'9007199254740993');assert.equal(f.mae,null);
 assert.deepEqual(planningEnvelope(f,'10000000000000000'),{low:'10000000000000000',likely:'10000000000000000',high:'10000000000000000'});
});
test('rolling-origin holdouts use no future values',()=>{
 const f=forecast(['100','100','100','100','500']);assert.equal(f.available,true);if(!f.available)return;
 assert.equal(f.method,'mean_3');assert.equal(f.estimate,'233');assert.equal(f.mae,'200');assert.equal(f.backtestMonths,2);
 assert.deepEqual(f.lastBacktest,{predicted:'100',actual:'500'});assert.equal(f.low,'0');assert.equal(f.high,'633');
});
test('last-month method wins on monotone series, with explicit uncalibrated planning range',()=>{
 const f=forecast(['100','200','300','400','500','600']);assert.equal(f.available,true);if(!f.available)return;
 assert.equal(f.method,'last_month');assert.equal(f.mae,'100');assert.equal(f.estimate,'600');assert.equal(f.low,'500');assert.equal(f.high,'700');
});
test('unknown history keeps plan unknown even when commitments exist',()=>{
 assert.deepEqual(planningEnvelope(forecast([]),'100'),{low:null,likely:null,high:null});
});
