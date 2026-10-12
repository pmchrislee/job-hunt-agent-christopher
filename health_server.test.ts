import { describe, it, expect } from "bun:test";
import { handleRequest } from "./health_server";

describe("GET /health", () => {
  it("returns 200", async () => {
    const res = handleRequest(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
  });

  it("returns JSON content-type", async () => {
    const res = handleRequest(new Request("http://localhost/health"));
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("returns a body of { status: \"ok\" }", async () => {
    const res = handleRequest(new Request("http://localhost/health"));
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("unknown routes", () => {
  it("returns 404 for a path other than /health", async () => {
    const res = handleRequest(new Request("http://localhost/nope"));
    expect(res.status).toBe(404);
  });
});
