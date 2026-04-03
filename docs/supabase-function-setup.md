# Supabase Function Setup

This project currently uses two Edge Functions:

- `analyze-submission`
- `admin-create-user`
- `admin-update-user`
- `admin-delete-user`
- `admin-delete-subject`

Their runtime config is defined in [supabase/config.toml](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/config.toml). Both functions currently use `verify_jwt = false` at the gateway level, then validate the caller internally using the Supabase access token and profile role.

Detailed contracts:

- [supabase/functions/analyze-submission/README.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/analyze-submission/README.md)
- [supabase/functions/admin-create-user/README.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/admin-create-user/README.md)
- [supabase/functions/admin-update-user/README.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/admin-update-user/README.md)
- [supabase/functions/admin-delete-user/README.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/admin-delete-user/README.md)
- [supabase/functions/admin-delete-subject/README.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/admin-delete-subject/README.md)

## Required Local Secrets

Create a local secrets file from [supabase/.env.example](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/.env.example) or [supabase/.env.local.example](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/.env.local.example):

```bash
cp supabase/.env.example supabase/.env.local
```

Fill these values for local serving:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

`supabase/.env.local` is ignored by git. The local serve script also accepts `supabase/.env`.

You can scaffold the env files automatically:

```bash
npm run supabase:env:plan
npm run supabase:env:init
```

## Hosted Project Secrets

For the hosted Supabase project:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase automatically inside Edge Functions.
- You only need to add:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

## Local Workflow

You can use either direct `supabase` CLI commands or the project scripts in [package.json](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/package.json).

Start the local Supabase stack:

```bash
supabase start
```

Or:

```bash
npm run supabase:start
```

The npm start script runs `supabase:check:start` first.

Before serving or deploying, run the full preflight check:

```bash
npm run supabase:check
```

If you only want to validate the checked-in Supabase repo assets without requiring local CLI or secrets:

```bash
npm run supabase:check:repo
```

Other focused checks:

```bash
npm run supabase:check:cli
npm run supabase:check:start
npm run supabase:check:db
npm run supabase:check:frontend
npm run supabase:check:function
npm run supabase:check:serve
npm run supabase:check:deploy
```

Apply the latest schema:

```bash
supabase db push
```

Or:

```bash
npm run supabase:db:push
```

If `db push` is blocked, build a single SQL bundle from the checked-in migrations:

```bash
npm run supabase:db:bundle
```

This writes [supabase/manual-deploy.sql](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/manual-deploy.sql), which can be executed manually in `Supabase Dashboard -> SQL Editor`.

Serve functions locally with your secrets file:

```bash
supabase functions serve analyze-submission --env-file supabase/.env.local
```

Or:

```bash
npm run supabase:functions:serve
```

The npm script runs `supabase:check:serve` first, then selects `supabase/.env.local` or `supabase/.env` automatically.

## Deployment Workflow

Link the local repo to your hosted project:

```bash
supabase link --project-ref your-project-ref
```

Push migrations:

```bash
supabase db push
```

Set hosted function secrets:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

Deploy the analysis function:

```bash
supabase functions deploy analyze-submission
```

Deploy the admin user function:

```bash
supabase functions deploy admin-create-user
```

Deploy the admin user update function:

```bash
supabase functions deploy admin-update-user
```

Deploy the admin user delete function:

```bash
supabase functions deploy admin-delete-user
```

Deploy the admin subject delete function:

```bash
supabase functions deploy admin-delete-subject
```

Or use the npm wrapper for the analysis function:

```bash
npm run supabase:functions:deploy
```

## Live Smoke Tests

Run a PDF smoke test against the hosted project:

```bash
npm run supabase:e2e:smoke -- --cleanup
```

Run a DOCX smoke test:

```bash
npm run supabase:e2e:smoke -- --format=docx --cleanup
```

Run the admin user creation smoke test:

```bash
npm run supabase:e2e:admin-user
```

Run the admin role-demotion smoke test:

```bash
npm run supabase:e2e:admin-user-demote
```

Run the subject delete smoke test:

```bash
npm run supabase:e2e:subject-delete
```

Run the full hosted healthcheck:

```bash
npm run supabase:e2e:healthcheck
```

## Optional Post-Launch Cleanup

If the hosted project is already working and the healthcheck passes, the remaining cleanup steps are optional only:

- Remove old unused schema fields such as `section_label` and `word_protection_enabled` by running:
  [202603280001_remove_sections_and_word_protection.sql](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/migrations/202603280001_remove_sections_and_word_protection.sql)
  in `Supabase Dashboard -> SQL Editor`.
- Clean up smoke/demo data later only when you are sure you no longer need it:

```bash
node scripts/live-cleanup-demo-data.mjs --include-manual-demo
node scripts/live-cleanup-demo-data.mjs --include-manual-demo --apply
```

The first command previews candidates only. `--apply` performs actual deletion.

## Notes

- These scripts assume the Supabase CLI is installed and available in your shell.
- `supabase start` additionally requires Docker Desktop or another compatible Docker runtime.
- The frontend must never receive `GEMINI_API_KEY`.
- The function code reads its secrets from `Deno.env`.
