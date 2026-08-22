import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";

import {
  connectionCount,
  pushToUser,
  pushToUsers,
  registerClient,
  unregisterClient,
} from "@/lib/sse.js";

function mockRes() {
  return { write: vi.fn() } as unknown as Response;
}

describe("sse registry", () => {
  it("delivers a push to every open connection for a user", () => {
    const userId = `user-${Math.random()}`;
    const res1 = mockRes();
    const res2 = mockRes();
    registerClient(userId, res1);
    registerClient(userId, res2);

    pushToUser(userId, { type: "notification", data: { title: "hi" } });

    expect(res1.write).toHaveBeenCalledWith(expect.stringContaining("event: notification"));
    expect(res2.write).toHaveBeenCalledWith(expect.stringContaining("event: notification"));
    expect(connectionCount(userId)).toBe(2);

    unregisterClient(userId, res1);
    unregisterClient(userId, res2);
    expect(connectionCount(userId)).toBe(0);
  });

  it("does not deliver to a user with no open connections", () => {
    expect(() => pushToUser("nobody-connected", { type: "x", data: {} })).not.toThrow();
    expect(connectionCount("nobody-connected")).toBe(0);
  });

  it("pushToUsers fans out to multiple recipients", () => {
    const userA = `a-${Math.random()}`;
    const userB = `b-${Math.random()}`;
    const resA = mockRes();
    const resB = mockRes();
    registerClient(userA, resA);
    registerClient(userB, resB);

    pushToUsers([userA, userB], { type: "notification", data: {} });

    expect(resA.write).toHaveBeenCalled();
    expect(resB.write).toHaveBeenCalled();
  });

  it("removing one connection leaves the others intact", () => {
    const userId = `multi-${Math.random()}`;
    const res1 = mockRes();
    const res2 = mockRes();
    registerClient(userId, res1);
    registerClient(userId, res2);
    unregisterClient(userId, res1);

    pushToUser(userId, { type: "notification", data: {} });

    expect(res1.write).not.toHaveBeenCalled();
    expect(res2.write).toHaveBeenCalled();
  });
});
