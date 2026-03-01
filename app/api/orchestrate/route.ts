import { NextRequest, NextResponse } from "next/server";
import { payAgent, DEMO_MODE } from "@/lib/x402";
import { DEMO_AGENTS } from "@/lib/registry";

export async function POST(req: NextRequest) {
  const { task, text, targetLanguage } = await req.json();

  const transactions: object[] = [];
  const outputs: Record<string, string> = {};

  const agentsToHire = DEMO_AGENTS.filter((a) => {
    if (task === "full-pipeline") return true;
    if (task === "summarize") return a.name === "Summarizer";
    if (task === "translate") return a.name === "Translator";
    if (task === "explain-code") return a.name === "Code Explainer";
    return false;
  });

  for (const agent of agentsToHire) {
    try {
      const txHash = await payAgent(agent.endpoint, agent.priceUsdt);

      transactions.push({
        agent: agent.name,
        txHash,
        amount: agent.priceUsdt,
        currency: "USDT",
        chainId: 48816,
        explorer: `https://explorer.testnet3.goat.network/tx/${txHash}`,
      });

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const body: Record<string, string> = { text };
      if (agent.name === "Translator" && targetLanguage) body.targetLanguage = targetLanguage;
      if (agent.name === "Code Explainer") body.code = text;

      const response = await fetch(`${baseUrl}${agent.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payment": txHash,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      outputs[agent.name] = data.result || data.error || "No output";
    } catch (err) {
      outputs[agent.name] = `Error: ${String(err)}`;
    }
  }

  return NextResponse.json({
    task,
    timestamp: new Date().toISOString(),
    demoMode: DEMO_MODE,
    transactions,
    outputs,
  });
}
