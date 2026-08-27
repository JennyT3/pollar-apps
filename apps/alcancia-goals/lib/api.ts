"use client";

import type { Goal, HistoryEntry } from "@/lib/goals";

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

export function setGoalStatus(
  id: string,
  status: "active" | "completed" | "archived",
  address: string
): Promise<{ goal: Goal }> {
  return request(`/api/goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, address }),
  });
}

export function setAside(
  goalId: string,
  address: string,
  amount: string,
  type: "add" | "withdraw"
): Promise<{ saved: string }> {
  return request(`/api/goals/${goalId}/set-aside`, {
    method: "POST",
    body: JSON.stringify({ address, amount, type }),
  });
}

export function joinGoal(goalId: string, address: string): Promise<{ ok: true }> {
  return request(`/api/goals/${goalId}/join`, {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export function recordContribution(
  goalId: string,
  address: string,
  amount: string,
  hash: string
): Promise<{ saved: string }> {
  return request(`/api/goals/${goalId}/contributions`, {
    method: "POST",
    body: JSON.stringify({ address, amount, hash }),
  });
}

export function getCoverage(address: string): Promise<{ committed: string }> {
  return request(`/api/coverage?address=${encodeURIComponent(address)}`);
}
