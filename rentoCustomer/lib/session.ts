import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "rento_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  phone: string;
}

const DEFAULT_JWT_SECRET = "rento-default-jwt-secret-key-32-chars-min-prod";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn("JWT_SECRET is missing from environment variables. Using fallback session secret.");
    return DEFAULT_JWT_SECRET;
  }
  return secret;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_TTL_SECONDS, algorithm: "HS256" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    // Pin the algorithm explicitly (defense-in-depth against algorithm-confusion
    // attacks) rather than trusting whatever `alg` the token header itself claims.
    return jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export function readSessionFromCookies(): SessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
