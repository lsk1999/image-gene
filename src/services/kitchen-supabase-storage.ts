import "server-only";

import { z } from "zod";

const signedUrlResponse = z.object({
  signedURL: z.string().optional(),
  signedUrl: z.string().optional(),
});

const OBJECT_KEY = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const BUCKET_NAME = /^[A-Za-z0-9_-]+$/;

function storageConfig() {
  const projectUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "";

  let origin: string;
  try {
    const url = new URL(projectUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error();
    }
    origin = url.origin;
  } catch {
    throw new Error("Supabase Storage URL is not configured correctly.");
  }

  if (!serviceRoleKey || !BUCKET_NAME.test(bucket)) {
    throw new Error("Supabase Storage is not configured.");
  }

  const storageUrl = `${origin}/storage/v1`;
  // 新版 sb_secret_ 密钥不是 JWT，放进 Authorization: Bearer 会被网关判为 Invalid JWT。
  // 旧版 service_role 是 JWT，必须同时带 Bearer 头才能解析出角色，因此按前缀区分。
  const headers: Record<string, string> = { apikey: serviceRoleKey };
  if (serviceRoleKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  return { bucket, headers, origin, storageUrl };
}

function encodeObjectPath(bucket: string, key: string) {
  if (!OBJECT_KEY.test(key)) throw new Error("Invalid kitchen image object key.");
  return [bucket, ...key.split("/")].map(encodeURIComponent).join("/");
}

async function requireSuccess(response: Response, operation: string) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Supabase Storage ${operation} failed (${response.status}).`);
  }
  return response;
}

export function kitchenStorage() {
  const { bucket, headers, origin, storageUrl } = storageConfig();

  return {
    async upload(key: string, body: Uint8Array, contentType: string) {
      const path = encodeObjectPath(bucket, key);
      const response = await fetch(`${storageUrl}/object/${path}`, {
        method: "POST",
        headers: {
          ...headers,
          "Cache-Control": "max-age=31536000",
          "Content-Type": contentType,
          "x-upsert": "false",
        },
        body: new Uint8Array(body).buffer,
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
      });
      await requireSuccess(response, "upload");
      await response.body?.cancel().catch(() => undefined);
    },

    async download(key: string) {
      const path = encodeObjectPath(bucket, key);
      return requireSuccess(
        await fetch(`${storageUrl}/object/${path}`, {
          headers,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(60_000),
        }),
        "download"
      );
    },

    async createSignedUrl(key: string, expiresIn = 600) {
      if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600) {
        throw new Error("Invalid Supabase Storage signed URL lifetime.");
      }
      const path = encodeObjectPath(bucket, key);
      const response = await requireSuccess(
        await fetch(`${storageUrl}/object/sign/${path}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn }),
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        }),
        "URL signing"
      );
      const parsed = signedUrlResponse.safeParse(await response.json());
      const relativeUrl = parsed.success ? parsed.data.signedURL || parsed.data.signedUrl : undefined;
      if (!relativeUrl) throw new Error("Supabase Storage returned no signed URL.");

      const signedUrl = new URL(
        relativeUrl.startsWith("/") ? `${storageUrl}${relativeUrl}` : `${storageUrl}/${relativeUrl}`
      );
      if (signedUrl.origin !== origin || !signedUrl.pathname.startsWith("/storage/v1/object/sign/")) {
        throw new Error("Supabase Storage returned an invalid signed URL.");
      }
      return signedUrl.toString();
    },
  };
}
