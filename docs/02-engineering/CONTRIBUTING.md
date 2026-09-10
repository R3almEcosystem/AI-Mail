---
title: "AI-Mail — Contributing"
application_id: "ai-mail"
repository: "R3almEcosystem/AI-Mail"
application_version: "0.1.0"
document_status: "Baseline"
last_reviewed: "2026-09-10"
next_review: "2026-12-10"
---

# Contributing

> AI-Mail · Content · Pre-Alpha

AI-Mail is cataloged as a Content application focused on email and messaging operations.

> **Baseline notice:** This document defines the expected operating standard. It does not claim that a control, integration, model, or certification is already implemented; verify the code, configuration, and production evidence before release.

## Workflow

1. Start from the current default branch and link the work to an issue or approved change.
2. Keep the change narrowly scoped; document any behavior or contract change.
3. Add or update tests at the same boundary as the change.
4. Run formatting, linting, type checks, tests, and the production build.
5. Open a review with risk, evidence, migration impact, and rollback notes.
6. Resolve review feedback without rewriting unrelated history.
7. Merge through the repository's protected workflow.

## Pull request evidence

Every change should state: user outcome, implementation summary, security and privacy impact, data or migration impact, integration compatibility, screenshots or API examples when relevant, test evidence, observability changes, and rollback method.

## Review ownership

| Change | Required perspective |
| --- | --- |
| User workflow or copy | Product / design |
| Authentication, permissions, secrets | Security |
| Schema, retention, lineage | Data owner |
| External contract | Owning producer and consumer |
| Model or automated decision | AI/model risk owner |
| Deployment or alerting | Operations |

## Compatibility

Do not overwrite existing user data or silently reinterpret persisted state. Use versioned migrations and contracts, backfill separately, and test both forward and rollback paths.
