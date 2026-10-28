import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Parameters are stored inside each hash, so they can be raised later without
// invalidating existing passwords. N=2^15 with r=8 uses about 32 MB per hash.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMS = { N: 32768, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 200;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (![params.N, params.r, params.p].every(Number.isInteger)) return false;
  const expected = Buffer.from(keyB64 ?? "", "base64");
  const actual = await deriveKey(
    password,
    Buffer.from(saltB64 ?? "", "base64"),
    params,
    expected.length,
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Stops "wrong email" from being faster than "wrong password": both do a full hash. */
let dummyHash: Promise<string> | undefined;
export function burnPasswordCheck(password: string): Promise<boolean> {
  dummyHash ??= hashPassword("not-a-real-password-used-for-timing");
  return dummyHash.then((hash) => verifyPassword(password, hash));
}

export function isAcceptablePasswordInput(password: string): boolean {
  return password.length > 0 && password.length <= MAX_PASSWORD_LENGTH;
}

function deriveKey(
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
  keyLength = KEY_LENGTH,
): Promise<Buffer> {
  return scrypt(password.normalize("NFKC"), salt, keyLength, {
    ...params,
    maxmem: 128 * params.N * params.r * 2,
  });
}
