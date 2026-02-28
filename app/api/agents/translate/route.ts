import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/x402";
import { callClaude } from "@/lib/llm";

const AGENT_WALLET = process.env.AGENT_PRIVATE_KEY!;
const PRICE = "0.10";

export async function POST(req: NextRequest) {
  const paymentHeader = req.headers.get("x-payment");
  if (!paymentHeader) {
    return NextResponse.json(
      { error: "Payment required", amount: PRICE, currency: "USDT", address: AGENT_WALLET, chainId: 48816 },
      { status: 402 }
    );
  }
  const [txHash, fromAddress] = paymentHeader.split(":");
  const valid = await verifyPayment(txHash, AGENT_WALLET, PRICE);
  if (!valid) return NextResponse.json({ error: "Invalid payment" }, { status: 402 });

  const { text, targetLanguage = "French" } = await req.json();
  const result = await callClaude(
    `You are a translation agent. Translate the given text to ${targetLanguage}. Return only the translation.`,
    text
  );
  return NextResponse.json({ result, agent: "Translator", targetLanguage, proofOfPayment: { txHash, fromAddress, toAddress: AGENT_WALLET, chainId: 48816 } });
}
