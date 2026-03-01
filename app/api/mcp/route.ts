import { NextRequest, NextResponse } from "next/server";
import {
  getRegisteredAgents,
  getAgent,
  getAgentEndpoint,
  getAgentPrice,
  DEMO_AGENTS,
  AgentInfo,
} from "@/lib/registry";
import { payAgent, DEMO_MODE, PaymentResult } from "@/lib/x402";

const AGENT_CALL_TIMEOUT_MS = 10_000;

// MCP JSON-RPC types
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

function jsonrpc(id: string | number, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(
  id: string | number | null,
  code: number,
  message: string
) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

// Tool definitions
const TOOLS = [
  {
    name: "discover_agents",
    description:
      "Browse available agents on the GOAT Network ERC-8004 registry",
    inputSchema: {
      type: "object" as const,
      properties: {
        capability: {
          type: "string",
          description:
            "Filter by capability keyword (matches name or description)",
        },
        min_reputation: {
          type: "number",
          description: "Minimum reputation score (not yet enforced)",
        },
        x402_only: {
          type: "boolean",
          description: "Only return agents with x402 payment support",
        },
      },
    },
  },
  {
    name: "hire_agent",
    description:
      "Hire an agent and pay via x402 on GOAT Testnet3. " +
      "WARNING: caller_private_key is transmitted over HTTPS. " +
      "Only use on trusted deployments. For production, implement a signing proxy.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "number",
          description: "ERC-8004 token ID of the agent to hire",
        },
        task: {
          type: "string",
          description:
            "Task type: 'summarize', 'translate', or 'explain-code'",
        },
        input: {
          type: "string",
          description: "The text or code input for the agent",
        },
        budget_usdt: {
          type: "string",
          description: "Maximum budget in USDT (default: 0.10)",
        },
        target_language: {
          type: "string",
          description: "Target language for translation tasks",
        },
        caller_private_key: {
          type: "string",
          description:
            "Private key of the calling agent's wallet. This agent pays for the hire. " +
            "If omitted, falls back to the marketplace demo wallet (demo mode only).",
        },
        caller_address: {
          type: "string",
          description:
            "Public address of the calling agent (for logging and proof).",
        },
      },
      required: ["agent_id", "task", "input"],
    },
  },
  {
    name: "get_agent",
    description: "Get details of a specific agent by ERC-8004 token ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "number",
          description: "ERC-8004 token ID",
        },
      },
      required: ["agent_id"],
    },
  },
];

// Helpers

function isExternalUrl(endpoint: string): boolean {
  return endpoint.startsWith("http://") || endpoint.startsWith("https://");
}

async function callAgentEndpoint(
  _agent: AgentInfo,
  endpoint: string,
  task: string,
  input: string,
  targetLanguage: string | undefined,
  payment: PaymentResult
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AGENT_CALL_TIMEOUT_MS
  );

  try {
    let url: string;
    let body: Record<string, unknown>;

    if (isExternalUrl(endpoint)) {
      url = endpoint;
      body = {
        task,
        input,
        ...(targetLanguage && { targetLanguage }),
        payment: {
          txHash: payment.txHash,
          orderId: payment.orderId,
          explorerUrl: payment.explorerUrl,
        },
      };
    } else {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      url = `${baseUrl}${endpoint}`;
      body = { text: input };
      if (task === "translate" && targetLanguage)
        body.targetLanguage = targetLanguage;
      if (task === "explain-code") body.code = input;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment": payment.txHash,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();
    return data.result || data.error || "No output";
  } finally {
    clearTimeout(timeout);
  }
}

// Tool handlers

async function handleDiscoverAgents(params: Record<string, unknown>) {
  const capability = params.capability as string | undefined;
  const x402Only = params.x402_only as boolean | undefined;

  let agents: AgentInfo[];
  try {
    const registryAgents = await getRegisteredAgents();
    agents = registryAgents.length > 0 ? registryAgents : DEMO_AGENTS;
  } catch {
    agents = DEMO_AGENTS;
  }

  // Filter by capability keyword
  if (capability) {
    const kw = capability.toLowerCase();
    agents = agents.filter(
      (a) =>
        a.name.toLowerCase().includes(kw) ||
        a.description.toLowerCase().includes(kw)
    );
  }

  // Filter by x402 support
  if (x402Only) {
    agents = agents.filter((a) => a.x402Support);
  }

  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    price: getAgentPrice(a) + " USDT",
    merchantId: a.merchantId,
    x402Support: a.x402Support,
  }));
}

async function handleHireAgent(params: Record<string, unknown>) {
  const agentId = params.agent_id as number;
  const task = params.task as string;
  const input = params.input as string;
  const budgetUsdt = (params.budget_usdt as string) || "0.10";
  const targetLanguage = params.target_language as string | undefined;
  const callerPrivateKey = params.caller_private_key as string | undefined;
  const callerAddress = params.caller_address as string | undefined;

  // Look up agent
  let agent: AgentInfo | null = null;
  try {
    agent = await getAgent(agentId);
  } catch {
    // Fall back to demo agents
  }
  if (!agent) {
    agent = DEMO_AGENTS.find((a) => a.id === agentId) || null;
  }
  if (!agent) {
    return { error: `Agent #${agentId} not found` };
  }

  const endpoint = getAgentEndpoint(agent);
  if (!endpoint) {
    return {
      error: `Agent #${agentId} has no callable endpoint. It may be discoverable but not hirable.`,
    };
  }

  const price = getAgentPrice(agent);
  if (parseFloat(price) > parseFloat(budgetUsdt)) {
    return {
      error: `Agent price (${price} USDT) exceeds budget (${budgetUsdt} USDT)`,
    };
  }

  // Pay via x402 (caller pays if key provided, else orchestrator)
  const payment = await payAgent(agent.merchantId, price, callerPrivateKey);

  // Call agent endpoint (local or external)
  const result = await callAgentEndpoint(
    agent,
    endpoint,
    task,
    input,
    targetLanguage,
    payment
  );

  return {
    job_id: `job_${Date.now()}`,
    agent: agent.name,
    tx_hash: payment.txHash,
    order_id: payment.orderId,
    result,
    explorer_url: payment.explorerUrl,
    paid_by: callerAddress ?? payment.callerAddress,
    self_funded: !!callerPrivateKey,
    demo_mode: DEMO_MODE,
  };
}

async function handleGetAgent(params: Record<string, unknown>) {
  const agentId = params.agent_id as number;

  let agent: AgentInfo | null = null;
  try {
    agent = await getAgent(agentId);
  } catch {
    // Fall back to demo agents
  }
  if (!agent) {
    agent = DEMO_AGENTS.find((a) => a.id === agentId) || null;
  }
  if (!agent) {
    return { error: `Agent #${agentId} not found` };
  }

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    x402Support: agent.x402Support,
    active: agent.active,
    merchantId: agent.merchantId,
    price: getAgentPrice(agent) + " USDT",
    endpoint: getAgentEndpoint(agent) || null,
  };
}

// Route handler

export async function POST(req: NextRequest) {
  // Optional auth for MCP calls
  const token = req.headers.get("x-agent-token");
  const validToken = process.env.AGENT_API_TOKEN;
  if (validToken && token && token !== validToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return jsonrpcError(null, -32700, "Parse error");
  }

  if (body.jsonrpc !== "2.0" || !body.method) {
    return jsonrpcError(body.id ?? null, -32600, "Invalid Request");
  }

  switch (body.method) {
    case "initialize":
      return jsonrpc(body.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "agent-marketplace",
          version: "1.0.0",
        },
      });

    case "notifications/initialized":
      return jsonrpc(body.id, {});

    case "tools/list":
      return jsonrpc(body.id, { tools: TOOLS });

    case "tools/call": {
      const params = body.params as {
        name: string;
        arguments?: Record<string, unknown>;
      };
      if (!params?.name) {
        return jsonrpcError(body.id, -32602, "Missing tool name");
      }

      const args = params.arguments || {};

      try {
        let result: unknown;
        switch (params.name) {
          case "discover_agents":
            result = await handleDiscoverAgents(args);
            break;
          case "hire_agent":
            result = await handleHireAgent(args);
            break;
          case "get_agent":
            result = await handleGetAgent(args);
            break;
          default:
            return jsonrpcError(
              body.id,
              -32602,
              `Unknown tool: ${params.name}`
            );
        }

        return jsonrpc(body.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return jsonrpc(body.id, {
          content: [{ type: "text", text: `Error: ${String(err)}` }],
          isError: true,
        });
      }
    }

    default:
      return jsonrpcError(body.id, -32601, `Method not found: ${body.method}`);
  }
}

// Support GET for server discovery / health check
export async function GET() {
  return NextResponse.json({
    name: "agent-marketplace",
    version: "1.0.0",
    protocol: "MCP",
    protocolVersion: "2024-11-05",
    tools: TOOLS.map((t) => t.name),
    description:
      "Agent Economy Marketplace — discover and hire AI agents on GOAT Network via ERC-8004 + x402",
  });
}
