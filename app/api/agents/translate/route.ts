import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/x402";

const AGENT_WALLET = process.env.AGENT_TRANSLATOR_WALLET || process.env.AGENT_PRIVATE_KEY!;
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a translation agent. Translate the given text to ${targetLanguage}. Return only the translation.` },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await response.json();
  return NextResponse.json({
    result: data.choices[0].message.content,
    agent: "Translator",
    targetLanguage,
    proofOfPayment: { txHash, fromAddress, toAddress: AGENT_WALLET, chainId: 48816 },
  });
}
