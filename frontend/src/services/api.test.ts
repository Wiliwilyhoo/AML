import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("API responses", () => {
  it.each([
    [500, ""],
    [502, "Bad Gateway"],
    [200, "<html>Frontend fallback</html>"],
  ])("explains a non-JSON HTTP %s response", async (status, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
    await expect(api("/dashboard")).rejects.toThrow(
      `API returned an empty or non-JSON response (HTTP ${status}). Check FastAPI at http://127.0.0.1:8000/api/health.`,
    );
  });

  it("preserves the backend validation message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { detail: "Minimum amount exceeds maximum" }, { status: 422 },
    )));
    await expect(api("/transactions")).rejects.toThrow("Minimum amount exceeds maximum");
  });

  it("handles JSON errors without a detail field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(null, { status: 503 })));
    await expect(api("/dashboard")).rejects.toThrow("API request failed (HTTP 503)");
  });

  it("returns backend JSON and sends mutation bodies", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ status: "Under Review" }));
    vi.stubGlobal("fetch", fetch);
    const body = { status: "Under Review", reviewer: "Demo Analyst" };
    await expect(api("/alerts/AL-demo/review", body)).resolves.toEqual({ status: "Under Review" });
    expect(fetch).toHaveBeenCalledWith("/api/alerts/AL-demo/review", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  });
});
