import {test} from 'node:test';
import assert from 'node:assert/strict';
import {financialStatuses,financialTransitionRules,reviewStatus} from '../src/domain/financial.js';
import {DomainError,isConcurrencyConflict} from '../src/domain/errors.js';
test('every financial transition targets a known state and paid is terminal',()=>{
 for(const rule of Object.values(financialTransitionRules)){
  assert.ok(financialStatuses.includes(rule.to));
  assert.ok(!(rule.from as readonly string[]).includes('پرداخت شده'));
 }
 assert.equal(financialTransitionRules.refer.to,financialTransitionRules.queue_payment.to);
 assert.equal(reviewStatus('cancel'),'cancelled');
});
test('domain and database conflict errors retain stable public codes',()=>{
 const e=new DomainError(409,'CHANGE_REQUEST_NOT_PENDING');assert.equal(e.status,409);assert.equal(e.error,'CHANGE_REQUEST_NOT_PENDING');
 for(const code of ['40P01','40001','55P03'])assert.equal(isConcurrencyConflict(code),true);
 for(const code of [undefined,'23505','secret'])assert.equal(isConcurrencyConflict(code),false);
});
