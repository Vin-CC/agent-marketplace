import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/x402";

const AGENT_WALLET = process.env.AGENT_SUMMARIZER_WALLET || process.env.AGENT_PRIVATE_KEY!;
const PRICE = "0.10";

export async function POST(req: NextRequest) {
  const paymentHeader = req.headers.get("x-payment");

  // Step 1: No payment header → return 402
  if (!paymentHeader) {
    return NextResponse.json(
      {
        error: "Payment required",
        amount: PRICE,
        currency: "USDT",
        address: AGENT_WALLET,
        chainId: 48816,
        network: "GOAT Testnet3",
      },
      { status: 402 }
    );
  }

  // Step 2: Verify payment on-chain
  const [txHash, fromAddress] = paymentHeader.split(":");
  const valid = await verifyPayment(txHash, AGENT_WALLET, PRICE);

  if (!valid) {
    return NextResponse.json({ error: "Invalid payment" }, { status: 402 });
  }

  // Step 3: Execute task
  const { text } = await req.json();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a summarization agent. Summarize the given text into 3-5 concise bullet points.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await response.json();
  const summary = data.choices[0].message.content;

  return NextResponse.json({
    result: summary,
    agent: "Summarizer",
    proofOfPayment: { txHash, fromAddress, toAddress: AGENT_WALLET, chainId: 48816 },
  });
}
