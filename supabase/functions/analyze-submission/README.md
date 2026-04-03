# analyze-submission

Edge Function for the originality workflow.

This function is configured in [supabase/config.toml](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/config.toml) with `verify_jwt = false`. It still requires an authenticated caller, but the JWT is validated inside the function so the app can use Supabase client sessions safely.

## Request Contract

Request body:

```json
{
  "submission_id": "uuid"
}
```

A ready-to-edit example payload is available in [request.example.json](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/analyze-submission/request.example.json).

## Runtime Configuration

The function reads these values from `Deno.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

Notes:

- For local `supabase functions serve`, provide all values in `supabase/.env.local`.
- On the hosted Supabase project, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
- On the hosted project you only need to add `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `Edge Functions -> Secrets`.

See [supabase/.env.local.example](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/.env.local.example) and [docs/supabase-function-setup.md](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/docs/supabase-function-setup.md).

## Success Modes

Completed analysis:

```json
{
  "ok": true,
  "originality_check_id": "uuid",
  "analysis_status": "completed",
  "risk_level": "medium",
  "recommended_status": "review"
}
```

Manual review fallback:

```json
{
  "ok": true,
  "mode": "manual_review_required",
  "originality_check_id": "uuid"
}
```

Technical failure after extraction or analysis:

```json
{
  "ok": true,
  "mode": "failed",
  "error": "error message"
}
```

Validation or authorization failure:

```json
{
  "error": "submission_id is required"
}
```

## What The Function Does

1. Receives `submission_id`.
2. Validates the caller and checks access to the submission.
3. Marks the submission as `processing`.
4. Loads system settings and submission metadata.
5. Downloads the uploaded `PDF` or `DOCX` file from `student-submissions`.
6. Extracts text.
7. Falls back to `manual_review_required` or `failed` if extraction is not usable.
8. Loads internal candidate submissions in this priority:
   - same assignment
   - same subject
   - same level/semester
9. Ranks candidate matches.
10. Sends the submission plus the top internal matches to Gemini.
11. Persists `originality_checks` and `submission_matches`.
12. Updates submission analysis fields.

## Smoke Testing

Run a live smoke test against the hosted project:

```bash
npm run supabase:e2e:smoke -- --cleanup
```

Run the same smoke with a generated DOCX instead of PDF:

```bash
npm run supabase:e2e:smoke -- --format=docx --cleanup
```

## Notes

- The function is an analysis assistant only. Final academic decision stays with teacher or admin.
- The frontend must never receive `GEMINI_API_KEY`.
- The source code lives in [index.ts](/c:/Users/aol59/OneDrive/Desktop/academic-iqama-main/supabase/functions/analyze-submission/index.ts).
