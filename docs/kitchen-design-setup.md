# Kitchen design setup

The kitchen tool sends the actual source photo to Replicate FLUX Kontext and stores original/result images in a private Cloudflare R2 bucket. PostgreSQL records the authenticated user UUID, object keys, parameters, prompt, provider-prefixed model and generation status. Existing project authentication and database connections are reused.

Set these server-only secrets in `.env.local` and the deployed environment:

```
REPLICATE_API_TOKEN=...
KITCHEN_REPLICATE_MODEL=black-forest-labs/flux-kontext-pro
KITCHEN_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
KITCHEN_R2_BUCKET=kitchen-design
KITCHEN_R2_ACCESS_KEY=...
KITCHEN_R2_SECRET_KEY=...
DATABASE_URL=...
```

Create a private R2 bucket with public access disabled. Issue bucket-scoped Object Read & Write S3 credentials. Existing STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY are accepted as fallback values. Kitchen-specific credentials allow separation from public site assets. No browser credentials or R2 CORS settings are required. Replicate receives a source-only R2 GET URL signed for 10 minutes; this URL is never returned to the browser. Keep Replicate billing enabled and ensure model access. Supported models are black-forest-labs/flux-kontext-pro (default) and black-forest-labs/flux-kontext-max, which share this adapter's input schema. Arbitrary model names are rejected rather than sent incompatible input fields. The old KITCHEN_IMAGE_MODEL setting is no longer used; no OpenAI key is needed for the kitchen feature.

The adapter creates one prediction, waits up to 60 seconds initially, then polls its status until succeeded, failed, canceled or the 240-second overall deadline. Creation requests are never automatically retried. It requests PNG output matching the source aspect ratio, downloads only authenticated HTTPS replicate.delivery outputs (no redirects), limits downloads to 30 MB, validates PNG bytes, then uploads to R2. Replicate output URLs are temporary and are never used as permanent history URLs. Non-successful predictions receive a best-effort cancellation request, and Cancel-After bounds prediction lifetime even if the application disconnects.

Run `pnpm db:migrate` before using generation. Migration 0001 creates kitchen_generations, a user/time index, and an atomic unique index limiting each user to one processing job. Do not use db:push instead of this migration: the SQL contains the partial concurrency index.

Endpoints:
- POST /api/kitchen-design/generate: authenticated multipart image, parameters and request UUID; one image per request.
- GET /api/kitchen-design/history: newest 50 completed designs owned by the current user.
- GET /api/kitchen-design/images/{uuid}?kind=source|result: owner-only private image access.

R2 keys are kitchen-design/{user_uuid}/{generation_uuid}/source.ext and result.png. The database is the source of truth for ownership. Client-provided user IDs and R2 keys are never trusted. History restores both matching original image and saved settings. User favorite selection remains a local UI feature.

Limits: 10 generation attempts per hour per account; duplicate request UUIDs never invoke the model again; concurrent requests are rejected by the database. Provider calls time out after 240 seconds and are not automatically retried. Configure hosting request duration to at least 300 seconds. Browser cancellation does not guarantee provider cancellation: completed work can still appear in History. Jobs interrupted by process crashes expire after 10 minutes on the next submission.

Database and R2 cannot be one atomic transaction. Errors mark the generation failed; source/result objects are retained under that generation UUID for recovery. A scheduled cleanup of failed-job objects is recommended before high-volume deployment. No credit charging was added.

Configuration, database migration and paid API calls were not executed during implementation. Manual checks after setup: signed-out request returns 401; invalid files return 400; parallel jobs return 409; source photo influences output; new browser restores account History; another account cannot access either image; provider/R2 failure never returns success.

API references:
- https://replicate.com/black-forest-labs/flux-kontext-pro/api/schema
- https://replicate.com/docs/reference/http
- https://developers.cloudflare.com/r2/api/s3/api/
