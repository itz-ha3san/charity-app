import {spawn} from 'node:child_process';
export function databaseTool(tool, args, {database} = {}) {
  const transport=process.env.BACKUP_TRANSPORT || 'docker';
  if (!['local','docker'].includes(transport)) throw Error('BACKUP_TRANSPORT must be local or docker');
  if (transport==='docker') return spawn('docker',['compose','exec','-T','postgres',tool,'-U','family_app','-d',database||'family_case',...args],{stdio:['pipe','pipe','inherit']});
  const url=new URL(process.env.DATABASE_URL || '');
  if (!['postgres:','postgresql:'].includes(url.protocol)) throw Error('Invalid PostgreSQL DATABASE_URL');
  // Credentials are passed through the child environment, never command arguments.
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:database||decodeURIComponent(url.pathname.slice(1)),PGCONNECT_TIMEOUT:'10'};
  if(url.searchParams.has('sslmode'))env.PGSSLMODE=url.searchParams.get('sslmode');
  return spawn(tool,tool==='pg_restore'?['--dbname',env.PGDATABASE,...args]:args,{env,stdio:['pipe','pipe','inherit']});
}
export function exited(child) {
  // Subscribe before streaming; a fast subprocess may exit before pipeline ends.
  return new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('close',code=>code===0?resolve():reject(Error('Database tool failed')));
  });
}
