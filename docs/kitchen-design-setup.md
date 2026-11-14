# Kitchen design setup

The kitchen tool sends the source photo or selected result to Replicate and stores original/result images in a private Supabase Storage bucket. PostgreSQL records the authenticated user UUID, object keys, parameters, prompt, provider-prefixed model and generation status. Existing project authentication and database connections are reused.

Set these server-only secrets in `.env.local` and the deployed environment:

```
REPLICATE_API_TOKEN=...
KITCHEN_REPLICATE_MODEL=google/nano-banana-2.1
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=kitchen-design
DATABASE_URL=...
```

Create a private Supabase Storage bucket. Keep the storage credentials on the server. Replicate receives a signed GET URL for the input image that expires in 10 minutes. Keep Replicate billing enabled and ensure model access. Nano Banana 2.1 is the default and outputs a single 1K image. If a local or deployed environment already sets KITCHEN_REPLICATE_MODEL to a FLUX model, update that value to switch providers' models on Replicate. Both FLUX Kontext Pro and Max remain available as explicit overrides.

The adapter creates one prediction, waits up to 60 seconds initially, then polls its status until succeeded, failed, canceled or the overall deadline (240 seconds for generation, 200 seconds for edits). Creation requests are never automatically retried. It requests PNG output matching the input aspect ratio, downloads only authenticated HTTPS replicate.delivery outputs (no redirects), limits downloads to 30 MB, validates PNG bytes, then uploads to Supabase Storage. Replicate output URLs are temporary and are never used as permanent history URLs. Non-successful predictions receive a best-effort cancellation request, and Cancel-After bounds prediction lifetime even if the application disconnects.

Run `pnpm db:migrate` before using generation. Migration 0001 creates kitchen_generations, a user/time index, and an atomic unique index limiting each user to one processing job. Do not use db:push instead of this migration: the SQL contains the partial concurrency index.

Endpoints:
- POST /api/kitchen-design/generate: authenticated multipart image, parameters and request UUID; one image per request.
- GET /api/kitchen-design/history: newest 50 completed designs owned by the current user.
- GET /api/kitchen-design/images/{uuid}?kind=source|result: owner-only private image access.

Storage keys are kitchen-design/{user_uuid}/{generation_uuid}/source.ext and result.png. The database is the source of truth for ownership. Client-provided user IDs and object keys are never trusted. History restores both matching original image and saved settings. User favorite selection remains a local UI feature.

Limits: 10 generation attempts per hour per account; duplicate request UUIDs never invoke the model again; concurrent requests are rejected by the database. Provider calls time out after 240 seconds and are not automatically retried. Configure hosting request duration to at least 300 seconds. Browser cancellation does not guarantee provider cancellation: completed work can still appear in History. Jobs interrupted by process crashes expire after 10 minutes on the next submission.

Database and Supabase Storage cannot be one atomic transaction. Errors mark the generation failed; source/result objects are retained under that generation UUID for recovery. A scheduled cleanup of failed-job objects is recommended before high-volume deployment. No credit charging was added.

Manual checks after setup: signed-out request returns 401; invalid files return 400; parallel jobs return 409; source photo influences output; new browser restores account History; another account cannot access either image; provider or storage failure never returns success.

API references:
- https://replicate.com/google/nano-banana-2.1/api
- https://replicate.com/docs/reference/http
