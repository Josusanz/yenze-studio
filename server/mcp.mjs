import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { planLayers } from "../core/layers.mjs";
const base = process.env.YENZE_API_URL || "http://localhost:3061",
  token = process.env.YENZE_API_TOKEN;
if (!token) throw Error("Configura YENZE_API_TOKEN con un token del estudio.");
const server = new McpServer({ name: "yenze-studio", version: "0.2.0" });
async function call(path, method = "GET", body) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "API error");
  return data;
}
function tool(name, description, schema, fn) {
  server.registerTool(
    name,
    { description, inputSchema: schema },
    async (args) => {
      try {
        return {
          content: [
            { type: "text", text: JSON.stringify(await fn(args), null, 2) },
          ],
        };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    },
  );
}
const id = z.string().regex(/^[a-f0-9]{32}$/);
tool("list_templates", "List editable product templates.", {}, () =>
  call("/templates"),
);
tool("list_products", "List products in the authorized workspace.", {}, () =>
  call("/products"),
);
tool(
  "get_product",
  "Read a product draft, revision and publication state.",
  { id },
  (a) => call("/products/" + a.id),
);
tool(
  "create_product",
  "Create an unpublished draft from a template.",
  {
    template: z.enum(["cabinet", "sofa", "shirt", "empty", "model", "images", "scene", "guided"]),
    name: z.string().max(120).optional(),
  },
  (a) => call("/products", "POST", a),
);
tool(
  "save_product",
  "Save a draft using its current revision. Does not publish. Asset IDs must belong to this workspace.",
  {
    id,
    revision: z.number().int(),
    manifest: z.record(z.unknown()),
    mode: z.enum(["quote", "purchase"]),
  },
  ({ id, ...body }) => call("/products/" + id, "PATCH", body),
);
tool(
  "publish_product",
  "Publish a reviewed saved revision. Requires publish permission; purchase mode requires enabled Stripe.",
  { id, revision: z.number().int() },
  (a) =>
    call("/products/" + a.id + "/publish", "POST", { revision: a.revision }),
);
tool(
  "unpublish_product",
  "Remove a product from the public storefront.",
  { id },
  (a) => call("/products/" + a.id + "/unpublish", "POST", {}),
);
tool(
  "upload_asset",
  "Upload a base64 PNG, WebP, JPEG or self-contained GLB, maximum 20 MB. Returns an asset ID.",
  { name: z.string().max(180), data: z.string() },
  (a) => call("/assets", "POST", a),
);
tool(
  "plan_layers",
  "Validate folder metadata and prepare a layer manifest. Upload assets separately and replace relative paths with returned IDs before saving.",
  {
    files: z
      .array(
        z.object({
          path: z.string(),
          width: z.number().int(),
          height: z.number().int(),
        }),
      )
      .max(500),
    name: z.string().max(120),
    basePrice: z.number().int().nonnegative(),
  },
  (a) => planLayers(a.files, { name: a.name, basePrice: a.basePrice }),
);
tool(
  "list_orders",
  "Read workspace orders and saved configuration snapshots.",
  {},
  () => call("/orders"),
);
await server.connect(new StdioServerTransport());
