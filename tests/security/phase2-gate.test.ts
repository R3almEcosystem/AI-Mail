// @vitest-environment node
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
test('phase-2 scanner, AI privacy and inbox regression suite',()=>{
  const result=spawnSync(process.execPath,['--experimental-strip-types','--test',
    'tests/security/attachment-scan.native.mjs','tests/security/ai-disclosure.native.cjs','tests/security/ai-request.native.mjs',
    'tests/security/ai-provider.native.cjs','tests/security/ai-route.native.cjs','tests/security/mime-scan.native.cjs','tests/security/dashboard-security.native.cjs'],
    {cwd:process.cwd(),encoding:'utf8',timeout:15000,maxBuffer:1000000,env:{PATH:process.env.PATH,NODE_ENV:'test'}});
  expect(result.error,result.stderr).toBeUndefined();expect(result.status,`${result.stdout}\n${result.stderr}`).toBe(0);
},20000);
