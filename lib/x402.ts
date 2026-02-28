import { ethers } from "ethers";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

export async function payAgent(
  toAddress: string,
  amountUsdt: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);
  const usdt = new ethers.Contract(process.env.USDT_ADDRESS!, ERC20_ABI, wallet);

  const amount = ethers.parseUnits(amountUsdt, 6);
  const tx = await usdt.transfer(toAddress, amount);
  const receipt = await tx.wait();

  return receipt.hash;
}

export async function verifyPayment(
  txHash: string,
  expectedTo: string,
  expectedAmount: string
): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return false;

  // Parse USDT Transfer event
  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;
      const to = parsed.args[1].toLowerCase();
      const value = parsed.args[2];
      const expected = ethers.parseUnits(expectedAmount, 6);
      if (to === expectedTo.toLowerCase() && value >= expected) {
        return true;
      }
    } catch {}
  }

  return false;
}

export function proofOfPayment(txHash: string, from: string, to: string) {
  return {
    proofOfPayment: {
      fromAddress: from,
      toAddress: to,
      chainId: 48816,
      txHash,
    },
  };
}
