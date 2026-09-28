import assert from "node:assert/strict";
const origin = process.env.YENZE_CHECK_ORIGIN || "https://studio.yenze.io";
const u = new URL(origin);
if (u.protocol !== "https:" || u.origin !== origin)
  throw Error("Use an exact HTTPS origin");
for (const route of ["/api/health", "/api/me", "/?page=signup"]) {
  const response = await fetch(origin + route, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  assert.equal(response.status, 200, route + " unavailable");
  if (route.startsWith("/api/")) {
    assert.match(
      response.headers.get("content-type") || "",
      /application\/json/,
    );
    const data = await response.json();
    if (route === "/api/health") assert.equal(data.ok, true);
    else {
      assert.equal(data.user, null);
      assert.deepEqual(data.organizations, []);
    }
  } else {
    const html = await response.text();
    const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/);
    assert.ok(asset, "Application bundle missing");
    const js = await fetch(origin + asset[1], {
      method: "HEAD",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(js.status, 200, "Application bundle unavailable");
  }
  console.log("OK " + route);
}
