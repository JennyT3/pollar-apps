"use client";

import type { PollarClient } from "@pollar/core";
import type { Goal, HistoryEntry } from "@/lib/goals";
import { AUTH_HEADER, AUTH_TTL_MS, joinMessage, setAsideMessage, statusMessage } from "@/lib/sep53";

export type GoalWithProgress = Goal & { saved: string; progress: number };

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

/**
 * Signs `buildMessage(address, exp)` with the caller's Pollar wallet
 * (SEP-53) and returns it as the auth header the server verifies — proof
 * the request really comes from `address`, not just a claim in the body.
 */
async function signedAuthHeader(
  client: PollarClient,
  address: string,
  buildMessage: (address: string, exp: number) => string
): Promise<Record<string, string>> {
  const exp = Date.now() + AUTH_TTL_MS;
  const proof = await client.stellar.sep53.signMessage(buildMessage(address, exp));
  if (proof.status !== "signed") {
    throw new Error(proof.details ?? "No pudimos firmar con tu wallet. Probá de nuevo.");
  }
  return { [AUTH_HEADER]: JSON.stringify({ address, exp, signature: proof.signature }) };
}

export function listGoals(address: string): Promise<{ goals: GoalWithProgress[] }> {
  return request(`/api/goals?address=${encodeURIComponent(address)}`);
}

export function createGoal(input: {
  name: string;
  emoji: string;
  targetAmount: string;
  deadline: string | null;
  mode: "personal" | "shared";
  currency: string;
  ownerAddress: string;
}): Promise<{ goal: Goal }> {
  return request(`/api/goals`, { method: "POST", body: JSON.stringify(input) });
}

export interface GoalDetail {
  goal: GoalWithProgress;
  history: HistoryEntry[];
  shared: {
    members: { goalId: string; address: string; joinedAt: string }[];
    memberTotals: { address: string; total: string }[];
  } | null;
}

export function getGoalDetail(id: string): Promise<GoalDetail> {
  return request(`/api/goals/${id}`);
}

export async function setGoalStatus(
  id: string,
  status: "active" | "completed" | "archived",
  address: string,
  client: PollarClient
): Promise<{ goal: Goal }> {
  const headers = await signedAuthHeader(client, address, (addr, exp) => statusMessage(addr, id, status, exp));
  return request(`/api/goals/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status }),
  });
}

export async function setAside(
  goalId: string,
  address: string,
  amount: string,
  type: "add" | "withdraw",
  client: PollarClient
): Promise<{ saved: string }> {
  const headers = await signedAuthHeader(client, address, (addr, exp) => setAsideMessage(addr, goalId, type, amount, exp));
  return request(`/api/goals/${goalId}/set-aside`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amount, type }),
  });
}

export async function joinGoal(goalId: string, address: string, client: PollarClient): Promise<{ ok: true }> {
  const headers = await signedAuthHeader(client, address, (addr, exp) => joinMessage(addr, goalId, exp));
  return request(`/api/goals/${goalId}/join`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
}

export function recordContribution(
  goalId: string,
  amount: string,
  hash: string
): Promise<{ saved: string }> {
  return request(`/api/goals/${goalId}/contributions`, {
    method: "POST",
    body: JSON.stringify({ amount, hash }),
  });
}

export function getCoverage(address: string): Promise<{ committed: string }> {
  return request(`/api/coverage?address=${encodeURIComponent(address)}`);
}
