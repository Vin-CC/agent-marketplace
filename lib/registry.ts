import { ethers } from "ethers";

// Minimal ABI for ERC-8004 registry reads
const ERC8004_ABI = [
  "function getAgent(uint256 agentId) view returns (string name, string endpoint, string description, uint256 priceWei, bool x402Support)",
  "function totalAgents() view returns (uint256)",
];

export interface AgentInfo {
  id: number;
  name: string;
  endpoint: string;
  description: string;
  priceUsdt: string;
  x402Support: boolean;
}

export async function getRegisteredAgents(): Promise<AgentInfo[]> {
  const provider = new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
  const registry = new ethers.Contract(
    process.env.ERC8004_REGISTRY_ADDRESS!,
    ERC8004_ABI,
    provider
  );

  const total = await registry.totalAgents();
  const agents: AgentInfo[] = [];

  for (let i = 0; i < Number(total); i++) {
    const agent = await registry.getAgent(i);
    agents.push({
      id: i,
      name: agent.name,
      endpoint: agent.endpoint,
      description: agent.description,
      priceUsdt: ethers.formatUnits(agent.priceWei, 6), // USDT = 6 decimals
      x402Support: agent.x402Support,
    });
  }

  return agents;
}

// Fallback: hardcoded agents for demo if registry not yet set up
export const DEMO_AGENTS: AgentInfo[] = [
  {
    id: 0,
    name: "Summarizer",
    endpoint: "/api/agents/summarize",
    description: "Summarizes long text into key points",
    priceUsdt: "0.10",
    x402Support: true,
  },
  {
    id: 1,
    name: "Translator",
    endpoint: "/api/agents/translate",
    description: "Translates text to any language",
    priceUsdt: "0.10",
    x402Support: true,
  },
  {
    id: 2,
    name: "Code Explainer",
    endpoint: "/api/agents/explain-code",
    description: "Explains code in plain English",
    priceUsdt: "0.10",
    x402Support: true,
  },
];
