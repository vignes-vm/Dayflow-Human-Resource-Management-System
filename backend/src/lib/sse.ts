import type { Response } from "express";

/**
 * Per-user registry of open SSE connections. A user can have several tabs
 * open at once, so each userId maps to a Set of live responses — a push
 * writes to every one of them.
 */

const clients = new Map<string, Set<Response>>();

export function registerClient(userId: string, res: Response): void {
  const existing = clients.get(userId);
  if (existing) {
    existing.add(res);
  } else {
    clients.set(userId, new Set([res]));
  }
}

export function unregisterClient(userId: string, res: Response): void {
  const existing = clients.get(userId);
  if (!existing) return;
  existing.delete(res);
  if (existing.size === 0) clients.delete(userId);
}

export interface SseEvent {
  type: string;
  data: unknown;
}

function write(res: Response, event: SseEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

export function pushToUser(userId: string, event: SseEvent): void {
  const sockets = clients.get(userId);
  if (!sockets) return;
  for (const res of sockets) write(res, event);
}

export function pushToUsers(userIds: string[], event: SseEvent): void {
  for (const userId of userIds) pushToUser(userId, event);
}

/** Test/diagnostic helper — number of open connections for a user. */
export function connectionCount(userId: string): number {
  return clients.get(userId)?.size ?? 0;
}
