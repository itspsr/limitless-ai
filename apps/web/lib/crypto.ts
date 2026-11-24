import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
function key() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || !/^[0-9a-f]{64}$/i.test(secret))
    throw new Error("ENCRYPTION_SECRET requires 32 hex-encoded bytes");
  return Buffer.from(secret, "hex");
}
export function seal(value: string, owner: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, data, cipher.getAuthTag()]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function unseal(value: string, owner: string) {
  const [iv, data, tag] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
