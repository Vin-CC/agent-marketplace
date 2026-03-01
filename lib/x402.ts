import { ethers } from "ethers";

const DEMO_MODE =
  !process.env.GOATX402_API_KEY || !process.env.AGENT_PRIVATE_KEY;
export { DEMO_MODE };

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export interface PaymentResult {
  txHash: string;
  orderId: string;
  explorerUrl: string;
}

interface CreateOrderResponse {
  order_id: string;
  pay_to_address: string;
  amount: string;
}

interface OrderStatusResponse {
  status: "PENDING" | "PAID" | "CONFIRMED";
}

function getApiBase(): string {
  return (
    process.env.GOATX402_API_URL ||
    "https://x402-api-lx58aabp0r.testnet3.goat.network"
  );
}

function getApiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.GOATX402_API_KEY}`,
  };
}

/**
 * Create an x402 order for paying an agent.
 */
async function createOrder(
  hiredAgent: string,
  amountWei: string
): Promise<CreateOrderResponse> {
  const res = await fetch(`${getApiBase()}/orders`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify({
      merchant_id:
        process.env.GOATX402_MERCHANT_ID || "agents_marketplace",
      chain_id: Number(process.env.ERC8004_CHAIN_ID) || 48816,
      token: process.env.USDT_ADDRESS!,
      amount: amountWei,
      metadata: { hired_agent: hiredAgent },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`x402 createOrder failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Transfer USDT (ERC-20) to the given address using the orchestrator wallet.
 */
async function transferUsdt(
  toAddress: string,
  amountWei: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);
  const erc20 = new ethers.Contract(
    process.env.USDT_ADDRESS!,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    wallet
  );

  const tx = await erc20.transfer(toAddress, amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Poll the x402 order status until CONFIRMED or timeout.
 */
async function pollOrderStatus(orderId: string): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(`${getApiBase()}/orders/${orderId}`, {
      headers: getApiHeaders(),
    });

    if (!res.ok) {
      throw new Error(`x402 poll failed (${res.status}): ${await res.text()}`);
    }

    const data: OrderStatusResponse = await res.json();

    if (data.status === "CONFIRMED") return;

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`x402 order ${orderId} not confirmed within ${POLL_TIMEOUT_MS / 1000}s`);
}

/**
 * Pay an agent via the x402 order flow:
 * 1. POST /orders → get order_id + pay_to_address
 * 2. ERC-20 transfer to pay_to_address
 * 3. GET /orders/{order_id} poll until CONFIRMED
 */
export async function payAgent(
  agentMerchantId: string,
  amountUsdt: string
): Promise<PaymentResult> {
  if (DEMO_MODE) {
    const fakeTx =
      "0x" +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
    console.log(
      `[DEMO] Simulated payment of ${amountUsdt} USDT for agent ${agentMerchantId}: ${fakeTx}`
    );
    return {
      txHash: fakeTx,
      orderId: `demo_order_${Date.now()}`,
      explorerUrl: `https://explorer.testnet3.goat.network/tx/${fakeTx}`,
    };
  }

  const amountWei = ethers.parseUnits(amountUsdt, 6).toString();

  // 1. Create x402 order
  const order = await createOrder(agentMerchantId, amountWei);

  // 2. Transfer USDT to order's pay_to_address
  const txHash = await transferUsdt(order.pay_to_address, order.amount);

  // 3. Poll until confirmed
  await pollOrderStatus(order.order_id);

  return {
    txHash,
    orderId: order.order_id,
    explorerUrl: `https://explorer.testnet3.goat.network/tx/${txHash}`,
  };
}

/**
 * Verify a payment on-chain by checking ERC-20 Transfer event logs.
 */
export async function verifyPayment(
  txHash: string,
  expectedTo: string,
  expectedAmount: string
): Promise<boolean> {
  if (DEMO_MODE) return true;

  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return false;

  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;
      if (
        parsed.args[1].toLowerCase() === expectedTo.toLowerCase() &&
        parsed.args[2] >= ethers.parseUnits(expectedAmount, 6)
      )
        return true;
    } catch {
      // Not a matching log, continue
    }
  }
  return false;
}
