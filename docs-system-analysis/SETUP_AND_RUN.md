# SETUP_AND_RUN

## Scope
This file describes how the system is set up and run based on the repository scripts and configuration files.

Primary references:

- `package.json`
- `README.md`
- `.env.example`
- `.env.local.example`
- `supabase/.env.example`
- `supabase/config.toml`
- `docs/supabase-function-setup.md`

## Runtime Model

### Confirmed from code
The project is a React + Vite frontend with optional Supabase-backed runtime.

Operational modes visible in the codebase:

- local/demo mode
- Supabase-backed mode

## Requirements

### Confirmed or strongly implied

- Node.js
- npm

### High-confidence inference
For local Supabase development:

- Supabase CLI
- Docker

### Confirmed from repository docs
For hosted originality analysis:

- Supabase project
- Gemini API key

## Install

```bash
npm install
```

## Development Commands

### Frontend

```bash
npm run dev
```

### Preview

```bash
npm run preview
```

### Build

```bash
npm run build
```

Optional dev-mode build:

```bash
npm run build:dev
```

## Quality / Verification Commands

```bash
npm run lint
npm test
```

Supabase-related checks:

```bash
npm run supabase:check
npm run supabase:check:repo
npm run supabase:check:cli
npm run supabase:check:start
npm run supabase:check:db
npm run supabase:check:frontend
npm run supabase:check:function
npm run supabase:check:serve
npm run supabase:check:deploy
```

Live smoke / health scripts:

```bash
npm run supabase:e2e:smoke
npm run supabase:e2e:admin-user
npm run supabase:e2e:admin-user-update
npm run supabase:e2e:admin-user-demote
npm run supabase:e2e:admin-user-delete
npm run supabase:e2e:teacher-subject
npm run supabase:e2e:teacher-subject-unlink
npm run supabase:e2e:student-subject-access
npm run supabase:e2e:subject-delete
npm run supabase:e2e:subject-update
npm run supabase:e2e:notification-reads
npm run supabase:e2e:healthcheck
```

## Frontend Environment Variables

### Confirmed from `.env.example`

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_ALLOW_LOCAL_DEMO_FALLBACK`

## Supabase Function / Backend Environment Variables

### Confirmed from `supabase/.env.example`

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

### Confirmed from repository docs
Hosted Supabase Edge Functions also receive:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

from Supabase automatically in hosted environments.

## Initial Frontend Environment Setup

Copy frontend env placeholders from either:

- `.env.example`
- `.env.local.example`

to one of:

- `.env`
- `.env.local`

Then populate the variable names above with real values.

Helper scripts:

```bash
npm run supabase:env:plan
npm run supabase:env:init
```

## Supabase Local/Hosted Setup

### Local start

```bash
npm run supabase:start
```

### Push database changes

```bash
npm run supabase:db:push
```

### Serve functions locally

```bash
npm run supabase:functions:serve
```

### Deploy functions

```bash
npm run supabase:functions:deploy
```

## SQL Bundle Generation

### Confirmed from `package.json`
The repository can generate a bundled SQL file:

```bash
npm run supabase:db:bundle
```

This creates:

- `supabase/manual-deploy.sql`

## Demo / Local Fallback Behavior

### Confirmed from code
If Supabase is not configured, or if local fallback is enabled and remote auth is unavailable, the app can run using browser-stored demo data.

Relevant code:

- `src/contexts/AuthContext.tsx`
- `src/lib/auth.ts`
- `src/lib/supabase-app.ts`

## AI/Originality Setup Notes

### Confirmed from code and docs
The originality pipeline depends on:

- `supabase/functions/analyze-submission/index.ts`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

The default model value shown in examples is:

- `gemini-2.5-flash`

## Deployment Notes

### Confirmed from repository contents
The repository clearly supports frontend build output plus Supabase database/functions deployment.

### Uncertain

- The exact production hosting provider for the frontend is not visible from the repository alone.
- The exact CI/CD pipeline is not visible from the repository alone.

## Recommended Minimal Setup Path

1. Install dependencies with `npm install`
2. Create frontend env file from `.env.example`
3. Create Supabase function env file from `supabase/.env.example`
4. Run `npm run lint`
5. Run `npm test`
6. Run `npm run dev`
7. If using Supabase locally, run `npm run supabase:start`
8. If using hosted Supabase, verify env values and function secrets

## Final Operational Note

This project should be understood as:

- a Vite React SPA frontend
- a Supabase-backed relational/storage/auth backend
- a Gemini-assisted originality-analysis subsystem running through Supabase Edge Functions
