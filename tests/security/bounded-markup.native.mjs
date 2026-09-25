import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('malformed markup remains bounded without regex backtracking exhaustion',()=>{
  const url=new URL('../../src/security/email-security.ts',import.meta.url).href;
  const code=`import {assessEmailSecurity} from ${JSON.stringify(url)}; for (const html of ['<'.repeat(200000),'<a '.repeat(50000)]) {const result=assessEmailSecurity({direction:'inbound',subject:'',text:'',html});if(!result.disposition)throw Error('No result');}`;
  const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{timeout:2500,encoding:'utf8'});
  assert.equal(result.error,undefined,'Inspection exceeded its adversarial regression budget');
  assert.equal(result.status,0,result.stderr);
});
