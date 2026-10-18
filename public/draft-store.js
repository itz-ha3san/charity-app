// Sensitive drafts stay in this tab's session, scoped to an authenticated user.
(function (root) {
  const prefix = "family-case-create-draft-v2:";
  const legacyKey = "family-case-create-draft-v1";
  const ttl = 8 * 60 * 60 * 1000;
  const key = owner => typeof owner === "string" && owner ? prefix + owner : null;
  function removeLegacy() {
    try { root.localStorage.removeItem(legacyKey); } catch {}
  }
  function clear(owner) {
    const name = key(owner);
    try { if (name) root.sessionStorage.removeItem(name); } catch {}
  }
  function save(owner, entries) {
    const name = key(owner);
    if (!name) return false;
    try {
      root.sessionStorage.setItem(name, JSON.stringify({ owner, savedAt: new Date().toISOString(), entries }));
      return true;
    } catch { return false; }
  }
  function read(owner) {
    const name = key(owner);
    if (!name) return null;
    try {
      const draft = JSON.parse(root.sessionStorage.getItem(name) || "null");
      if (!draft) return null;
      const age = Date.now() - Date.parse(draft.savedAt);
      if (draft.owner !== owner || !Number.isFinite(age) || age < 0 || age >= ttl ||
          !Array.isArray(draft.entries) || !draft.entries.length ||
          !draft.entries.every(entry => Array.isArray(entry) && entry.length === 2 && entry.every(v => typeof v === "string"))) {
        clear(owner);
        return null;
      }
      return draft;
    } catch { clear(owner); return null; }
  }
  function clearSession() {
    removeLegacy();
    try {
      const storage = root.sessionStorage;
      for (let i = storage.length - 1; i >= 0; i--) {
        const name = storage.key(i);
        if (name?.startsWith(prefix)) storage.removeItem(name);
      }
    } catch {}
  }
  removeLegacy();
  root.CaseDraftStore = { save, read, clear, clearSession };
})(window);
