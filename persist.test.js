import { describe, expect, it, vi } from "vitest";
import { loadBest, saveBest } from "./persist.js";

describe("night market persistence", () => {
  it("loads a valid best score and recovers from invalid data", async () => {
    const ok = vi.fn(async () => ({ ok: true, text: async () => "321" }));
    const broken = vi.fn(async () => ({ ok: true, text: async () => "oops" }));

    await expect(loadBest(ok)).resolves.toBe(321);
    await expect(loadBest(broken)).resolves.toBe(0);
  });

  it("only writes a new record and degrades cleanly when unavailable", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));

    await expect(saveBest(250, 300, fetcher)).resolves.toBe(300);
    expect(fetcher).not.toHaveBeenCalled();

    await expect(saveBest(350, 300, fetcher)).resolves.toBe(350);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/nightstall:best", {
      method: "PUT",
      body: "350",
    });

    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(saveBest(400, 350, offline)).resolves.toBe(400);
  });
});
