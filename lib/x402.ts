import { ethers } from "ethers";
import { GoatX402Client } from "goatx402-sdk-server";

const DEMO_MODE = !process.env.GOATX402_API_KEY || !process.env.AGENT_PRIVATE_KEY;
export { DEMO_MODE };

export interface PaymentResult {
  txHash: string;
  orderId: string;
  explorerUrl: string;
  callerAddress: string;
}

function getClient() {
  return new GoatX402Client({
    baseUrl: process.env.GOATX402_API_URL || "https://x402-api-lx58aabp0r.testnet3.goat.network",
    apiKey: process.env.GOATX402_API_KEY!,
    apiSecret: process.env.GOATX402_API_SECRET!,
  });
}

/**
 * Pay an agent via x402 order flow.
 * If callerPrivateKey is provided, that wallet pays (true M2M).
 * Otherwise falls back to the orchestrator wallet (demo/UI mode).
 */
export async function payAgent(
  merchantId: string,
  amountUsdt: string,
  callerPrivateKey?: string
): Promise<PaymentResult> {
  const privateKey = callerPrivateKey ?? process.env.AGENT_PRIVATE_KEY!;

  if (DEMO_MODE && !callerPrivateKey) {
    const fakeTx = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const demoAddress = process.env.AGENT_PUBLIC_ADDRESS || "0x0000000000000000000000000000000000000000";
    console.log(`[DEMO] Simulated payment of ${amountUsdt} USDT to ${merchantId}: ${fakeTx}`);
    return {
      txHash: fakeTx,
      orderId: `demo_${Date.now()}`,
      explorerUrl: `https://explorer.testnet3.goat.network/tx/${fakeTx}`,
      callerAddress: demoAddress,
    };
  }

  // Derive caller address from private key (never log the key itself)
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const callerAddress = wallet.address;

  const client = getClient();
  const amountWei = ethers.parseUnits(amountUsdt, 6).toString();

  // Create order via official SDK
  const order = await client.createOrder({
    dappOrderId: `hire-${merchantId}-${Date.now()}`,
    chainId: 48816,
    tokenSymbol: "USDT",
    tokenContract: process.env.USDT_ADDRESS!,
    fromAddress: callerAddress,
    amountWei,
  });

  // ERC-20 transfer from caller wallet to pay_to_address
  const erc20 = new ethers.Contract(
    process.env.USDT_ADDRESS!,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    wallet
  );

  const tx = await erc20.transfer(order.payToAddress, amountWei);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    orderId: order.orderId,
    explorerUrl: `https://explorer.testnet3.goat.network/tx/${receipt.hash}`,
    callerAddress,
  };
}

export async function verifyPayment(txHash: string, _expectedTo: string, _expectedAmount: string): Promise<boolean> {
  if (DEMO_MODE) return true;
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  return !!receipt && receipt.status === 1;
}
