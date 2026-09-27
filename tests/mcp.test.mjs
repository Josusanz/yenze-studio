import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
test("MCP advertises scoped tools and validates a folder plan over stdio", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["server/mcp.mjs"],
    env: { ...process.env, YENZE_API_TOKEN: "yz_test_not_a_real_token" },
    stderr: "pipe",
  });
  const client = new Client({ name: "yenze-test", version: "1.0" });
  await client.connect(transport);
  t.after(() => client.close());
  const list = await client.listTools();
  assert.ok(list.tools.some((t) => t.name === "publish_product"));
  assert.ok(list.tools.some((t) => t.name === "upload_asset"));
  const answer = await client.callTool({
    name: "plan_layers",
    arguments: {
      name: "Test",
      basePrice: 1000,
      files: [{ path: "01_finish/oak/frontal.png", width: 100, height: 100 }],
    },
  });
  assert.equal(answer.isError, undefined);
  assert.equal(JSON.parse(answer.content[0].text).groups[0].id, "finish");
  const invalid = await client.callTool({
    name: "plan_layers",
    arguments: {
      name: "Test",
      basePrice: 1000,
      files: [{ path: "../../private.png", width: 100, height: 100 }],
    },
  });
  assert.equal(invalid.isError, true);
});
