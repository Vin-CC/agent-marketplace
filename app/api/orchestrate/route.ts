import { NextRequest, NextResponse } from "next/server";
import { payAgent } from "@/lib/x402";
import { DEMO_AGENTS } from "@/lib/registry";

// Orchestrator: reads available agents, pays them, collects results
export async function POST(req: NextRequest) {
  const { task, text, targetLanguage } = await req.json();

  const results: Record<string, unknown> = {
    task,
    timestamp: new Date().toISOString(),
    transactions: [] as unknown[],
    outputs: {} as Record<string, string>,
  };

  const transactions = results.transactions as unknown[];
  const outputs = results.outputs as Record<string, string>;

  // Determine which agents to hire based on task
  const agentsToHire = DEMO_AGENTS.filter((a) => {
    if (task === "full-pipeline") return true;
    if (task === "summarize") return a.name === "Summarizer";
    if (task === "translate") return a.name === "Translator";
    if (task === "explain-code") return a.name === "Code Explainer";
    return false;
  });

  // Hire each agent: pay → call → collect
  for (const agent of agentsToHire) {
    try {
      console.log(`[Orchestrator] Hiring ${agent.name} for ${agent.priceUsdt} USDT...`);

      // 1. Pay the agent
      const txHash = await payAgent(agent.endpoint, agent.priceUsdt);
      console.log(`[Orchestrator] Paid ${agent.name}: ${txHash}`);

      transactions.push({
        agent: agent.name,
        txHash,
        amount: agent.priceUsdt,
        currency: "USDT",
        chainId: 48816,
        explorer: `https://explorer.testnet3.goat.network/tx/${txHash}`,
      });

      // 2. Call the agent API with proof of payment
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const body: Record<string, string> = { text };
      if (agent.name === "Translator" && targetLanguage) {
        body.targetLanguage = targetLanguage;
      }
      if (agent.name === "Code Explainer") {
        body.code = text;
      }

      const response = await fetch(`${baseUrl}${agent.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payment": txHash,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      outputs[agent.name] = data.result;
    } catch (err) {
      console.error(`[Orchestrator] Failed to hire ${agent.name}:`, err);
      outputs[agent.name] = `Error: ${String(err)}`;
    }
  }

  return NextResponse.json(results);
}
