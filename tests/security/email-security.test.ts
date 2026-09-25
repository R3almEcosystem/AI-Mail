// The same cases also run dependency-free under the native Node runner.
import { test } from 'vitest';
import * as security from '../../src/security/email-security';
import { registerSecurityCases } from './email-security.cases';
registerSecurityCases(test, security);
