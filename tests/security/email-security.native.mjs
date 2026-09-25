import test from 'node:test';
import * as security from '../../src/security/email-security.ts';
import { registerSecurityCases } from './email-security.cases.ts';
registerSecurityCases(test, security);
