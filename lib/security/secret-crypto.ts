import crypto from "node:crypto";
import { ValidationError } from "@/lib/api/errors";

const VERSION = "v1";

function getSecretKeyMaterial(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new ValidationError("NEXTAUTH_SECRET is missing or too short for secret encryption");
  }

  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plainText: string): string {
  const value = plainText.trim();
  if (!value) {
    throw new ValidationError("Secret value must not be empty");
  }

  const key = getSecretKeyMaterial();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    encrypted.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new ValidationError("Invalid encrypted secret format");
  }

  const [, ivB64, dataB64, tagB64] = parts;
  const key = getSecretKeyMaterial();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function toTokenHint(token: string): string {
  const value = token.trim();
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
