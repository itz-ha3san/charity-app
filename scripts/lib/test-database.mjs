export function assertTestDatabase(raw) {
  if (!raw) throw Error('TEST_DATABASE_URL is required; never use a production database');
  const url = new URL(raw);
  if (!['postgres:','postgresql:'].includes(url.protocol) ||
      !['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
      !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1)))
    throw Error('Only a loopback PostgreSQL database ending in _test is allowed');
  return url;
}
