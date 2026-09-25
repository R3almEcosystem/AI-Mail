# Layered email-security increment

## Intent and deployment boundary
Learn from Proofpoint's layered gateway, DLP, and user-warning approach without representing local rules as Proofpoint-equivalent protection. Add working deterministic controls to r3alm email-gateway and the active AI-Mail source tree. Keep the own-SMTP architecture, existing auth/tenant boundaries, immutable content snapshots, and demo isolation. Do not alter DNS, credentials, production configuration, production data, or send real email. AI-Mail changes are stacked on its unmerged phase-1 security branch, not vulnerable main.

## Scope
A dependency-free, versioned assessment core is byte-identical in both repositories. It validates and bounds inputs, returns static/redacted reason codes, and never fetches URLs or submits message content to third parties. It detects private-key markers, contextual SSNs, likely payment-card numbers with network/length/Luhn checks, unsafe URL schemes, embedded URL credentials, suspicious links, reply-to domain mismatch, risky attachment metadata, and heuristic social-engineering signals. It is not a complete DLP classifier, antivirus, MIME-content scanner, BEC model, SPF/DKIM/DMARC verifier, or reputation service.

Hard policy matches and inspection-limit failures prevent outbound delivery. Review findings remain advisory to avoid blocking every international domain, attachment, or urgent legitimate business email. A no-match result means only that this bounded ruleset found no configured indicators, never that a message is safe. Public results contain neither extracted secrets nor original URLs/body snippets. Sender authentication, malware scanning, and URL reputation always report not verified/not scanned/not checked in this increment.

Gateway invokes the guard after content rendering, before quota and new queue acceptance; dispatch checks the immutable snapshot again before provider selection and transport. Existing idempotent replays remain acknowledgements, not new sends. Policy denials are not reconciled as quota races. Dispatch uses the existing terminal dead-letter mechanism; no new database state or unaudited release route is introduced.

AI-Mail invokes the same guard in its shared browser/MCP SMTP transport and assesses fetched MIME text/HTML plus attachment metadata before display truncation. Results flow to a dedicated, accessible, non-HTML-rendering inbox warning panel. Uninspected list/demo messages are explicitly labelled. No arbitrary message header is trusted as an authentication verdict.

## Remaining architecture
True predelivery inbound enforcement needs a trusted Exim/MX ingest integration. Malware scanners must bind verdicts to exact bytes and fail closed when scanning is required. Quarantine requires scoped persistence, UIDVALIDITY/UID identities, immutable audit, retention and MFA-gated rescan/release; a mail folder or heuristic label alone is not quarantine. Time-of-click protection requires signed links, safe redirect handling, no open redirect or SSRF, and a reputation provider. Postdelivery remediation requires mailbox-scoped authority and compensating actions. Do not advertise these as active until end-to-end tests exist.

## Validation
Native tests execute the real core, including benign mail, each blocking rule, advisory-only cases, encoded links, false-positive controls, redacted output, size/URL/attachment limits, unknown scan status, and transport no-send behavior. A strict TypeScript check is required for the core. Attempt repository test/build commands; report unavailable dependencies separately from passing native tests. Publish draft pull requests with exact bases and verification limits.
