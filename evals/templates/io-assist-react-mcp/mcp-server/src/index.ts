import { randomUUID } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { clients, payments, portfolios, transactions } from "./data.js";

const PORT = Number(process.env.PORT ?? 7070);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:4004";

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

function createServer(): McpServer {
  const server = new McpServer({ name: "acme-mcp", version: "0.0.0" });

  server.registerTool(
    "list_clients",
    {
      title: "List clients",
      description: "Lists all ACME clients with their id, name, segment and advisor.",
      inputSchema: {},
    },
    async () => json(clients),
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Get portfolio",
      description: "Returns the holdings of a client's portfolio.",
      inputSchema: { clientId: z.string().describe("Client id, e.g. c-100") },
    },
    async ({ clientId }) => {
      const holdings = portfolios[clientId];
      if (!holdings) return { ...json({ error: `Unknown client ${clientId}` }), isError: true };
      return json({ clientId, holdings });
    },
  );

  server.registerTool(
    "list_transactions",
    {
      title: "List transactions",
      description: "Lists recent transactions for a client.",
      inputSchema: { clientId: z.string().describe("Client id, e.g. c-100") },
    },
    async ({ clientId }) => json(transactions.filter((t) => t.clientId === clientId)),
  );

  server.registerTool(
    "submit_payment",
    {
      title: "Submit payment",
      description: "Submits a payment on behalf of a client.",
      inputSchema: {
        clientId: z.string(),
        amount: z.number().positive(),
        currency: z.string().length(3),
        beneficiary: z.string().min(1),
      },
    },
    async ({ clientId, amount, currency, beneficiary }) => {
      if (!clients.some((c) => c.id === clientId)) {
        return { ...json({ error: `Unknown client ${clientId}` }), isError: true };
      }
      const payment = { id: randomUUID(), clientId, amount, currency, beneficiary, status: "submitted" as const };
      payments.push(payment);
      return json(payment);
    },
  );

  return server;
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Stateless: a fresh server and transport per request.
app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.all("/mcp", (_req, res) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
});

app.listen(PORT, () => {
  console.log(`acme-mcp listening on http://localhost:${PORT}/mcp`);
});
