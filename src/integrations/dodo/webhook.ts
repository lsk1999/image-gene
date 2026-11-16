const encoder = new TextEncoder();

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function verifyDodoWebhook(body: string, headers: Headers, secret: string) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    decodeBase64(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signed = encoder.encode(`${id}.${timestamp}.${body}`);
  for (const entry of signatures.trim().split(/\s+/)) {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) continue;
    try {
      if (await crypto.subtle.verify("HMAC", key, decodeBase64(signature), signed)) {
        return true;
      }
    } catch {
      // A malformed signature may be followed by a valid one during key rotation.
    }
  }
  return false;
}
