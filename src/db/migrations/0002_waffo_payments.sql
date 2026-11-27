CREATE TABLE IF NOT EXISTS "payment_events" (
  "event_key" varchar(512) PRIMARY KEY NOT NULL,
  "order_no" varchar(255) NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "payment_id" varchar(255) NOT NULL,
  "charged_cents" integer NOT NULL,
  "refunded_cents" integer DEFAULT 0 NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_events_order_idx" ON "payment_events" ("order_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kitchen_moderation" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "generation_id" varchar(255) NOT NULL,
  "stage" varchar(30) NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Backend-only audit data: no browser-facing Data API policies are granted.
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "kitchen_moderation" ENABLE ROW LEVEL SECURITY;
