---
title: "AI-Mail — Access Control"
application_id: "ai-mail"
repository: "R3almEcosystem/AI-Mail"
application_version: "0.1.0"
document_status: "Baseline"
last_reviewed: "2026-09-10"
next_review: "2026-12-10"
---

# Access Control

> AI-Mail · Content · Pre-Alpha

AI-Mail is cataloged as a Content application focused on email and messaging operations.

> **Baseline notice:** This document defines the expected operating standard. It does not claim that a control, integration, model, or certification is already implemented; verify the code, configuration, and production evidence before release.

## Principles

Access is deny-by-default, least privilege, individually attributable, environment-scoped, and time-bounded for elevation. Authentication proves identity; authorization is checked again at every protected operation and data boundary.

## Baseline roles

| Role | Typical scope | Prohibited by default |
| --- | --- | --- |
| Viewer | Read explicitly permitted message data | Mutation, export, administration |
| Operator | Execute approved workflow steps | Policy, role, or audit changes |
| Reviewer | Approve or reject governed transitions | Self-approval where separation is required |
| Administrator | Configuration and access administration | Reading restricted content without business need |
| Service identity | One narrow machine contract | Interactive login or broad wildcard access |
| Auditor | Read evidence and control state | Operational mutation |

## Enforcement

Derive permissions from trusted server-side claims. Scope every query and mutation to tenant, owner, role, and record state as applicable. Log grants, revocations, privileged actions, failed checks, and emergency elevation without logging credentials.

## Lifecycle

Access requires owner approval, documented purpose, and expiry where temporary. Review privileged access at least quarterly or more often when risk requires. Revoke promptly on role change, termination, compromise, or expired need. Test negative authorization paths.
