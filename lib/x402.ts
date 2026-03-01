import { ethers } from "ethers";
import { GoatX402Client } from "goatx402-sdk-server";

const DEMO_MODE = !process.env.GOATX402_API_KEY || !process.env.GOATX402_API_SECRET;
export { DEMO_MODE };

function getServerClient() {
  return new GoatX402Client({
    baseUrl: process.env.GOATX402_API_URL || "https://x402-api-lx58aabp0r.testnet3.goat.network",
    apiKey: process.env.GOATX402_API_KEY!,
    apiSecret: process.env.GOATX402_API_SECRET!,
  });
}

export async function payAgent(toAddress: string, amountUsdt: string): Promise<string> {
  if (DEMO_MODE) {
    const fakeTx = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
    console.log(`[DEMO] Simulated payment of ${amountUsdt} USDT → ${toAddress}: ${fakeTx}`);
    return fakeTx;
  }

  const client = getServerClient();
  const amountWei = ethers.parseUnits(amountUsdt, 6).toString();

  // Create order via GOAT x402 SDK
  const order = await client.createOrder({
    dappOrderId: `agent-pay-${Date.now()}`,
    chainId: 48816,
    tokenSymbol: "USDT",
    tokenContract: process.env.USDT_ADDRESS!,
    fromAddress: process.env.AGENT_PUBLIC_ADDRESS || toAddress,
    amountWei,
  });

  // Pay with orchestrator wallet using ethers directly
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);
  const erc20 = new ethers.Contract(
    process.env.USDT_ADDRESS!,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    wallet
  );

  const payTo = order.payToAddress || toAddress;
  const tx = await erc20.transfer(payTo, amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function verifyPayment(txHash: string, expectedTo: string, expectedAmount: string): Promise<boolean> {
  if (DEMO_MODE) return true;

  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return false;

  const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;
      if (
        parsed.args[1].toLowerCase() === expectedTo.toLowerCase() &&
        parsed.args[2] >= ethers.parseUnits(expectedAmount, 6)
      ) return true;
    } catch {}
  }
  return false;
}
