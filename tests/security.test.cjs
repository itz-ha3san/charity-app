const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}
function draftStore() {
  const window = { localStorage: storage({ 'family-case-create-draft-v1': 'legacy sensitive data' }), sessionStorage: storage() };
  vm.runInNewContext(fs.readFileSync('public/draft-store.js', 'utf8'), { window });
  return { ...window, store: window.CaseDraftStore };
}
test('drafts remove legacy persistent data and never persist new personal data to localStorage', () => {
  const { store, localStorage, sessionStorage } = draftStore();
  assert.equal(localStorage.length, 0);
  assert.equal(store.save('alice', [['headNationalId', 'synthetic-id']]), true);
  assert.equal(localStorage.length, 0);
  assert.equal(sessionStorage.length, 1);
});
test('drafts are isolated by owner and reject unauthenticated saves', () => {
  const { store } = draftStore();
  assert.equal(store.save(null, [['headName', 'synthetic']]), false);
  store.save('alice', [['headName', 'alice family']]);
  assert.equal(store.read('bob'), null);
  assert.equal(store.read('alice').entries[0][1], 'alice family');
});
test('drafts expire and malformed records are removed', () => {
  const { store, sessionStorage } = draftStore();
  const key = 'family-case-create-draft-v2:alice';
  for (const value of ['{broken', JSON.stringify({owner:'bob', savedAt:new Date().toISOString(), entries:[['name','x']]}), JSON.stringify({owner:'alice', savedAt:new Date(Date.now()-9*3600000).toISOString(), entries:[['name','x']]})]) {
    sessionStorage.setItem(key, value);
    assert.equal(store.read('alice'), null);
    assert.equal(sessionStorage.getItem(key), null);
  }
});
test('logout removes all account drafts but preserves unrelated session preferences', () => {
  const { store, sessionStorage } = draftStore();
  store.save('alice', [['name', 'a']]);
  store.save('bob', [['name', 'b']]);
  sessionStorage.setItem('unrelated-preference', 'keep');
  store.clearSession();
  assert.equal(store.read('alice'), null);
  assert.equal(store.read('bob'), null);
  assert.equal(sessionStorage.getItem('unrelated-preference'), 'keep');
});
test('server/profile privacy uses an allowlist, never an incomplete denylist', () => {
  const ts = require('typescript');
  const source = ts.transpileModule(fs.readFileSync('src/familyPrivacy.ts','utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 }}).outputText;
  const module = { exports: {} };
  vm.runInNewContext('(function(module,exports){'+source+'})(module,module.exports)', { module });
  const full = {id:'f',caseNumber:'1',headName:'visible',headNationalId:'private',headCardNumber:'private',medical:{diagnosis:'private'},profileData:{secret:'private'},futureSecret:'private',members:[{nationalId:'private'}],notesHistory:[{text:'private'}],tags:[]};
  const safe = module.exports.restrictedFamilyDetail(full);
  assert.equal(safe.headName, 'visible');
  for (const field of ['headNationalId','headCardNumber','medical','profileData','futureSecret']) assert.equal(field in safe, false, field);
  assert.equal(safe.members.length, 0);
  assert.equal(safe.notesHistory.length, 0);
  assert.equal(full.members.length, 1, 'redaction must not mutate the original');
});
test('browser scripts including inline entry scripts parse', () => {
  for (const file of ['public/draft-store.js','public/case-wizard.js','public/sw.js']) new vm.Script(fs.readFileSync(file,'utf8'), {filename:file});
  const html=fs.readFileSync('public/index.html','utf8');
  for (const [index,match] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()) new vm.Script(match[1], {filename:'index-inline-'+index});
  assert.ok(html.indexOf('/draft-store.js') < html.indexOf('/case-wizard.js'));
  assert.match(html, /function showAuth\([^)]*\)\{window\.CaseWizard\?\.clearSession\(\)/);
  assert.equal(html.includes('copyPasswords'), false);
  assert.equal(html.includes('capturedPassword'), false);
});
