import { NextRequest, NextResponse } from "next/server";
import { payAgent, DEMO_MODE, PaymentResult } from "@/lib/x402";
import {
  getRegisteredAgents,
  getAgentEndpoint,
  getAgentPrice,
  DEMO_AGENTS,
  AgentInfo,
} from "@/lib/registry";

const AGENT_CALL_TIMEOUT_MS = 10_000;

function isExternalUrl(endpoint: string): boolean {
  return endpoint.startsWith("http://") || endpoint.startsWith("https://");
}

async function callAgent(
  agent: AgentInfo,
  endpoint: string,
  text: string,
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
      // External agent: call directly with standardized body
      url = endpoint;
      body = {
        task: agent.name.toLowerCase().replace(/\s+/g, "-"),
        input: text,
        ...(targetLanguage && { targetLanguage }),
        payment: {
          txHash: payment.txHash,
          orderId: payment.orderId,
          explorerUrl: payment.explorerUrl,
        },
      };
    } else {
      // Local agent: prepend base URL, use legacy body format
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      url = `${baseUrl}${endpoint}`;
      body = { text };
      if (agent.name === "Translator" && targetLanguage)
        body.targetLanguage = targetLanguage;
      if (agent.name === "Code Explainer") body.code = text;
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

export async function POST(req: NextRequest) {
  // Auth: accept requests from human UI (no token) or external agents (with token)
  const agentToken = req.headers.get("x-agent-token");
  const validToken = process.env.AGENT_API_TOKEN;

  // If a token is configured, external calls must provide it
  if (validToken && agentToken && agentToken !== validToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { task, text, targetLanguage, callerAgent } = await req.json();

  const transactions: object[] = [];
  const outputs: Record<string, string> = {};

  // Try real ERC-8004 registry, fall back to demo agents
  let agents: AgentInfo[];
  let hiredFrom: string;

  try {
    const registryAgents = await getRegisteredAgents();
    if (registryAgents.length > 0) {
      agents = registryAgents;
      hiredFrom = "erc8004_registry";
    } else {
      agents = DEMO_AGENTS;
      hiredFrom = "demo_fallback";
    }
  } catch {
    agents = DEMO_AGENTS;
    hiredFrom = "demo_fallback";
  }

  // Filter agents by task
  const agentsToHire = agents.filter((a) => {
    if (task === "full-pipeline") return true;
    if (task === "summarize") return a.name === "Summarizer";
    if (task === "translate") return a.name === "Translator";
    if (task === "explain-code") return a.name === "Code Explainer";
    return false;
  });

  for (const agent of agentsToHire) {
    const endpoint = getAgentEndpoint(agent);
    if (!endpoint) {
      outputs[agent.name] =
        `Error: Agent #${agent.id} has no callable endpoint. It may be discoverable but not hirable.`;
      continue;
    }

    const price = getAgentPrice(agent);

    try {
      // Pay via x402 order flow
      const payment = await payAgent(agent.merchantId, price);

      transactions.push({
        agent: agent.name,
        txHash: payment.txHash,
        orderId: payment.orderId,
        amount: price,
        currency: "USDT",
        chainId: 48816,
        explorer: payment.explorerUrl,
        hired_from: hiredFrom,
      });

      // Call the agent endpoint (local or external)
      const result = await callAgent(
        agent,
        endpoint,
        text,
        targetLanguage,
        payment
      );
      outputs[agent.name] = result;
    } catch (err) {
      outputs[agent.name] = `Error: ${String(err)}`;
    }
  }

  return NextResponse.json({
    task,
    callerAgent: callerAgent || "human",
    timestamp: new Date().toISOString(),
    demoMode: DEMO_MODE,
    transactions,
    outputs,
  });
}
