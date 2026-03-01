import { ethers } from "ethers";
import { GoatX402Client } from "goatx402-sdk-server";

const DEMO_MODE = !process.env.GOATX402_API_KEY || !process.env.AGENT_PRIVATE_KEY;
export { DEMO_MODE };

export interface PaymentResult {
  callerAddress?: string;
  txHash: string;
  orderId: string;
  explorerUrl: string;
}

// Per-merchant credentials — falls back to default
function getClient(merchantId?: string) {
  const suffix = merchantId === "translator_agent" ? "_TRANSLATOR" : "";
  return new GoatX402Client({
    baseUrl: process.env.GOATX402_API_URL || "https://x402-api-lx58aabp0r.testnet3.goat.network",
    apiKey: process.env[`GOATX402_API_KEY${suffix}`] || process.env.GOATX402_API_KEY!,
    apiSecret: process.env[`GOATX402_API_SECRET${suffix}`] || process.env.GOATX402_API_SECRET!,
  });
}

function getPayerWallet(callerPrivateKey?: string) {
  const key = callerPrivateKey || process.env.AGENT_PRIVATE_KEY!;
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  return new ethers.Wallet(key, provider);
}

export async function payAgent(
  merchantId: string,
  amountUsdt: string,
  callerPrivateKey?: string
): Promise<PaymentResult> {
  if (DEMO_MODE && !callerPrivateKey) {
    const fakeTx = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return { txHash: fakeTx, orderId: `demo_${Date.now()}`, explorerUrl: `https://explorer.testnet3.goat.network/tx/${fakeTx}` };
  }

  const wallet = getPayerWallet(callerPrivateKey);
  const client = getClient(merchantId);
  const amountWei = ethers.parseUnits(amountUsdt, 6).toString();

  const order = await client.createOrder({
    dappOrderId: `hire-${merchantId}-${Date.now()}`,
    chainId: 48816,
    tokenSymbol: "USDT",
    tokenContract: process.env.USDT_ADDRESS!,
    fromAddress: wallet.address,
    amountWei,
  });

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
    callerAddress: wallet.address,
  };
}

export async function verifyPayment(txHash: string, _: string, __: string): Promise<boolean> {
  if (DEMO_MODE) return true;
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  return !!receipt && receipt.status === 1;
}
