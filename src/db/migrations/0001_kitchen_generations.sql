CREATE TABLE "kitchen_generations" (
 "uuid" varchar(255) PRIMARY KEY,
 "user_uuid" varchar(255) NOT NULL REFERENCES "users"("uuid"),
 "status" varchar(30) NOT NULL CHECK (status IN ('processing','completed','failed')),
 "source_key" text NOT NULL,
 "result_key" text,
 "parameters" jsonb NOT NULL,
 "prompt" text NOT NULL,
 "model" varchar(100) NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "kitchen_user_created_idx" ON "kitchen_generations" ("user_uuid", "created_at" DESC);
CREATE UNIQUE INDEX "kitchen_one_active_per_user" ON "kitchen_generations" ("user_uuid") WHERE "status" = 'processing';
