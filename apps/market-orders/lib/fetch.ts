"use client";

export function adminHeaders(adminToken: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminToken) headers["X-Admin-Token"] = adminToken;
  return headers;
}