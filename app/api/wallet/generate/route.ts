import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const FAUCET_URL = "https://faucet-agent-api.testnet3.goat.network/api/faucet";

export async function POST(req: NextRequest) {
  // Optional auth
  const token = req.headers.get("x-agent-token");
  const validToken = process.env.AGENT_API_TOKEN;
  if (validToken && token && token !== validToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let agentName = "anonymous";
  try {
    const body = await req.json();
    if (body.agent_name) agentName = body.agent_name;
  } catch {
    // Empty body is fine
  }

  // Generate a fresh random wallet
  const wallet = ethers.Wallet.createRandom();

  // Try to fund with gas from testnet faucet (non-blocking)
  let faucetTx: string | null = null;
  let faucetError: string | null = null;

  try {
    const faucetRes = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: wallet.address,
        chain: "goat-testnet3",
        token: "native",
      }),
    });

    if (faucetRes.ok) {
      const faucetData = await faucetRes.json();
      faucetTx = faucetData.tx_hash || faucetData.txHash || null;
    } else {
      faucetError = `Faucet returned ${faucetRes.status}`;
    }
  } catch (err) {
    faucetError = `Faucet unreachable: ${String(err)}`;
  }

  // Log only public info — never the private key
  console.log(
    `[wallet] Generated wallet for agent "${agentName}": ${wallet.address}`
  );

  return NextResponse.json({
    address: wallet.address,
    private_key: wallet.privateKey,
    chain_id: 48816,
    rpc_url: "https://rpc.testnet3.goat.network",
    faucet_tx: faucetTx,
    ...(faucetError && { faucet_error: faucetError }),
    next_steps: [
      "1. Store your private_key securely — never share it",
      "2. Use your address to receive x402 payments",
      "3. Use your private_key in hire_agent calls to pay for services",
      "4. Get more tokens at https://bridge.testnet3.goat.network/faucet",
    ],
    warning:
      "Store your private key now. It will never be shown again. The marketplace does not store it.",
  });
}
