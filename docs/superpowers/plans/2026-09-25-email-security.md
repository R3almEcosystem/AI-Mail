# Layered Email Security Implementation Plan

**Goal:** Prevent locally detectable high-risk outbound email and surface honest inbound risk evidence.
**Architecture:** Identical pure TypeScript rules core; guards at acceptance and dispatch; AI-Mail shared transport and read-model/UI integration. No network calls in detection.
**Spec:** ../specs/2026-09-25-email-security.md
**Constraints:** Preserve transport/auth/data boundaries; no production changes; rules-only means not malware-cleared; redacted reasons only.

## Implementation and checks
- [x] Add native tests for `assessEmailSecurity` and `assertOutboundEmailSecurity`, first confirm they fail because the module is missing.
- [x] Implement `src/security/email-security.ts`; run `node --experimental-strip-types --test tests/security/email-security.native.mjs` and a strict standalone TypeScript check.
- [x] Add gateway `src/security/outbound.ts`; invoke from rendered-message acceptance and dispatch before provider activity. Preserve the existing permanent dead-letter path and public-safe errors.
- [x] Add authenticated assessment route using existing request-context resolution, bounded JSON reads and private responses.
- [x] Add AI-Mail shared transport guards and MIME assessment; propagate the assessment through the browser read model; add an accessible inbox security panel and safe error mapping.
- [x] Add integration regression tests proving blocked data does not reach SMTP or queue persistence, and unexpected errors do not produce false success.
- [x] Create repository roadmaps separating shipped rules from infrastructure-dependent scanner/auth/quarantine/remediation controls.
- [ ] Complete full repository verification in an authorized runner. Local native and standalone checks passed; full dependency-backed suites/builds are unavailable here. Inspect diffs for scope creep, auth regressions, secret disclosure, silently skipped inputs and fabricated protection claims. Publish draft PRs; do not merge or deploy production.

## Execution notes
Native checks: gateway 45/45; AI-Mail 46/46. The shared core is byte-identical. A malformed-markup performance regression was reproduced and fixed before publication. Full application CI/build, real infrastructure and visual browser checks remain unverified. See `docs/EMAIL_SECURITY_ROADMAP.md` for precise release gates and unimplemented enterprise features.
