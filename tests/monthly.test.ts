import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyAmount, monthlySnapshot, monthlyRevision, type MonthlyFamily } from '../src/domain/monthly.js';
const family = (id: string, supervisorId: string | null, amount: string | null): MonthlyFamily => ({ id, caseNumber: id, familyName: id, supervisorId, supervisorName: supervisorId ?? 'بدون سرپرست', baseAmount: amount, aids: [], conflict: false });
test('monthly amounts normalize Persian digits and preserve explicit zero', () => {
    assert.equal(monthlyAmount('۲٬۴۵۰٬۰۰۰'), '2450000');
    assert.equal(monthlyAmount('٠'), '0');
    for (const v of ['', null, undefined, '-1', '12.5', 'NaN', '9000000000001'])
        assert.equal(monthlyAmount(v), null);
});
test('all families included, with separate supervisor subtotals and family-specific aid', () => {
    const a = family('a', 'first', '2000000'), b = family('b', 'second', '4000000'), c = family('c', 'first', '0');
    a.aids = [{ id: 'medical', familyId: 'a', title: 'درمان', category: 'پزشکی', amount: '3500000' }];
    const s = monthlySnapshot([a, b, c], ['medical']);
    assert.equal(s.familyCount, 3);
    assert.equal(s.totalAmount, '9500000');
    assert.equal(s.baseAmount, '6000000');
    assert.equal(s.extraAmount, '3500000');
    assert.equal(s.groups[0]!.families.length, 2);
    assert.equal(s.groups[0]!.totalAmount, '5500000');
    assert.equal(s.groups[1]!.families[0]!.extras.length, 0);
    assert.equal(s.groups[0]!.families[0]!.extras[0]!.title, 'درمان');
});
test('unknown and duplicate aid IDs are rejected, not silently moved to another family', () => {
    const a = family('a', 'first', '1');
    a.aids = [{ id: 'x', familyId: 'a', title: 'x', category: 'x', amount: '1' }];
    assert.throws(() => monthlySnapshot([a], ['foreign']));
    assert.throws(() => monthlySnapshot([a], ['x', 'x']));
});
test('missing and conflicting families stay visible, zero does not count as missing', () => {
    const a = family('a', null, null), b = family('b', null, '0');
    b.conflict = true;
    const s = monthlySnapshot([a, b], []);
    assert.deepEqual(s.missingAmounts, ['a']);
    assert.deepEqual(s.conflictingFamilies, ['b']);
    assert.equal(s.familyCount, 2);
});
test('sum remains exact beyond JS safe integer, revision detects changed amounts', () => {
    const rows = Array.from({ length: 1100 }, (_, i) => family(String(i), 'a', '9000000000000'));
    assert.equal(monthlySnapshot(rows, []).totalAmount, '9900000000000000');
    const before = monthlyRevision(rows);
    rows[0]!.baseAmount = '1';
    assert.notEqual(monthlyRevision(rows), before);
});
