---
title: "AI-Mail — Environments"
application_id: "ai-mail"
repository: "R3almEcosystem/AI-Mail"
application_version: "0.1.0"
document_status: "Baseline"
last_reviewed: "2026-09-10"
next_review: "2026-12-10"
---

# Environments

> AI-Mail · Content · Pre-Alpha

AI-Mail is cataloged as a Content application focused on email and messaging operations.

> **Baseline notice:** This document defines the expected operating standard. It does not claim that a control, integration, model, or certification is already implemented; verify the code, configuration, and production evidence before release.

## Environment model

| Environment | Purpose | Data | Access | External side effects |
| --- | --- | --- | --- | --- |
| Local | Individual development | Synthetic | Developer | Disabled or sandboxed |
| Preview | Change review | Synthetic | Team/reviewer | Sandbox only |
| Development | Shared integration | Synthetic or approved test | Engineering | Non-production |
| Staging | Production-like validation | Masked/synthetic preferred | Restricted | Controlled sandbox |
| Production | User service | Approved live data | Least privilege | Enabled and monitored |

## Isolation

Use distinct credentials, databases or schemas, storage, queues, domains, analytics projects, model/provider projects, and webhook endpoints. Production secrets never flow down to lower environments. Environment names must be visible in UI and logs where confusion could cause harm.

## Configuration

Keep non-secret configuration versioned and validate it at startup. Store secrets in an approved manager. Record who can modify production configuration, how changes are reviewed, how drift is detected, and how a prior version is restored.
