# UNKNOWNS_AND_GAPS

## Purpose
This document records what cannot be fully confirmed from repository contents alone.

The goal is to separate:

- confirmed implementation facts
- reasonable inferences
- unresolved unknowns requiring runtime verification or maintainer confirmation

## 1. Deployment State vs Repository State

### Uncertain
The repository includes many migrations and Edge Functions, but the code alone cannot prove that every target Supabase environment has:

- all migrations applied
- all functions deployed
- all function secrets configured correctly
- all bucket policies aligned with the latest code

## 2. Production Hosting Details

### Uncertain
The repository does not clearly identify:

- the frontend hosting platform
- the deployment pipeline
- whether deployments are manual or automated
- rollback strategy

## 3. External Monitoring / Observability

### Confirmed from code
No dedicated monitoring SDK or logging SaaS integration is obvious in the inspected frontend dependencies.

### Uncertain
There may still be:

- Supabase logs only
- infrastructure-level monitoring outside the repository
- platform-level dashboards not represented in code

## 4. Realtime Usage

### Confirmed from code
No clear Supabase Realtime subscription flow was confirmed as a core app dependency.

### High-confidence inference
The project relies more on polling/refresh patterns than on Realtime.

## 5. Email Delivery

### Confirmed from code
Settings include an email notification preference, but frontend code does not show a real email-sending integration.

### Uncertain
There may be an external process or backend email workflow not present in the repository.

## 6. AI Scope Limit

### Confirmed from code
The originality pipeline is an internal similarity/originality system based on:

- submission text extraction
- internal candidate match retrieval
- Gemini-assisted interpretation

### Confirmed from code
It is **not** a confirmed standalone detector for AI-generated text when no internal similarity exists.

### Uncertain
Whether future or external services add separate AI-writing detection is not visible in the repository.

## 7. AdminRoles Page Semantics

### Confirmed from code
`src/pages/admin/AdminRoles.tsx` is descriptive/oversight-oriented.

### Confirmed from code
It is not a true dynamic RBAC editor.

## 8. Exact Security Posture of Edge Functions

### Confirmed from code
Edge Functions in `supabase/config.toml` use `verify_jwt = false`.

### Confirmed from code
They then perform manual caller checks.

### Gap
This pattern works only if every function consistently validates caller identity and role.

## 9. Data Retention and Cleanup Policies

### Uncertain
The repository does not clearly define:

- retention periods for uploads
- retention periods for originality artifacts
- archival policy
- purge policy for historical reviews or activity logs

## 10. Backup and Disaster Recovery

### Uncertain
No explicit backup/restore strategy is documented in source code.

## 11. Package Usage Completeness

### Confirmed from code
The project depends on a large UI package set.

### Uncertain
Some installed libraries may be scaffold remnants or partial-use dependencies rather than essential runtime dependencies for all features.

## 12. Browser / Device Support Policy

### Uncertain
No formal compatibility matrix is present in the repository.

## 13. Exact Storage Policy Behavior

### Confirmed from code
Storage buckets are used for:

- assignment attachments
- student submissions

### Uncertain
The repository does not fully expose all hosted storage policies or lifecycle rules outside migration-level assumptions.

## 14. Dataset / Seed Expectations

### Confirmed from code
The repository contains catalog seed SQL such as:

- `202603270001_seed_academic_subject_catalog.sql`

### Uncertain
Whether every environment should always have those exact records is not guaranteed from code alone.

## 15. Manual Operational Dependencies

### Confirmed from docs
Some operational steps rely on manual execution:

- SQL Editor migrations
- function secret setup
- optional cleanup scripts

## 16. What Needs Manual Verification

To fully close remaining uncertainty, these require runtime validation:

1. Hosted environment migration parity
2. Hosted function deployment parity
3. End-to-end upload and originality flow in the target environment
4. Role access checks for real institution accounts
5. Storage access and signed URL behavior in production
6. Notification behavior under real usage volume

## Final Summary of Gaps

### Confirmed from code
The repository is strong enough to document:

- architecture
- route model
- Supabase usage
- originality workflow
- major CRUD workflows

### Still not fully provable from code alone

- production deployment parity
- external monitoring/operations
- full hosted security posture
- long-term data retention policy
- whether all environments match the latest repository state
