import { describe, it, expect } from "vitest";

describe("Pool Closing Logic", () => {
  it("Pool con total >= goalAmount cierra automáticamente", () => {
    const total = "100.0000000";
    const goalAmount = "100.0000000";
    const shouldClose = parseFloat(total) >= parseFloat(goalAmount);
    expect(shouldClose).toBe(true);
  });

  it("Pool con total < goalAmount no cierra", () => {
    const total = "99.9999999";
    const goalAmount = "100.0000000";
    const shouldClose = parseFloat(total) >= parseFloat(goalAmount);
    expect(shouldClose).toBe(false);
  });

  it("Pool con deadline pasado se reporta como cerrado", () => {
    const deadline = new Date(Date.now() - 10000).toISOString();
    const isClosed = new Date() > new Date(deadline);
    expect(isClosed).toBe(true);
  });

  it("Pool con deadline futuro sigue abierto", () => {
    const deadline = new Date(Date.now() + 10000).toISOString();
    const isClosed = new Date() > new Date(deadline);
    expect(isClosed).toBe(false);
  });

  it("Pool sin deadline nunca cierra por deadline", () => {
    const deadline = null;
    const isClosed = deadline ? new Date() > new Date(deadline) : false;
    expect(isClosed).toBe(false);
  });
});
