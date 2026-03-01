import { ethers } from "ethers";

// Minimal ERC-721 ABI for ERC-8004 IdentityRegistry
const ERC721_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export interface AgentMetadata {
  type: string;
  name: string;
  description: string;
  x402Support: boolean;
  active: boolean;
  merchantId: string;
  endpoint?: string;
  priceUsdt?: string;
}

export interface AgentInfo {
  id: number;
  name: string;
  description: string;
  x402Support: boolean;
  active: boolean;
  merchantId: string;
  endpoint?: string;
  priceUsdt?: string;
}

// Map known agent names to local API endpoints
const AGENT_ENDPOINTS: Record<string, string> = {
  Summarizer: "/api/agents/summarize",
  Translator: "/api/agents/translate",
  "Code Explainer": "/api/agents/explain-code",
};

const DEFAULT_PRICE_USDT = "0.10";

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.GOAT_RPC_URL);
}

function getRegistry() {
  const address = process.env.ERC8004_REGISTRY_ADDRESS;
  if (!address) return null;
  return new ethers.Contract(address, ERC721_ABI, getProvider());
}

/**
 * Decode a data:application/json;base64,... tokenURI into AgentMetadata.
 */
function decodeTokenURI(uri: string): AgentMetadata {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) {
    throw new Error(`Invalid tokenURI format: expected base64 JSON data URI`);
  }
  const json = Buffer.from(uri.slice(prefix.length), "base64").toString("utf-8");
  return JSON.parse(json);
}

/**
 * Fetch all registered agents from the ERC-8004 on-chain registry.
 * Enumerates Transfer events from address(0) (mints) to discover token IDs,
 * then reads tokenURI for each and filters by x402Support + active.
 */
export async function getRegisteredAgents(): Promise<AgentInfo[]> {
  const registry = getRegistry();
  if (!registry) return [];

  try {
    // Query all mint events (Transfer from 0x0 = mints)
    const mintFilter = registry.filters.Transfer(ethers.ZeroAddress);
    const events = await registry.queryFilter(mintFilter, 0, "latest");

    const agents: AgentInfo[] = [];

    for (const event of events) {
      const log = event as ethers.EventLog;
      const tokenId = log.args[2];

      try {
        const uri: string = await registry.tokenURI(tokenId);
        const metadata = decodeTokenURI(uri);

        if (metadata.x402Support && metadata.active) {
          agents.push({
            id: Number(tokenId),
            name: metadata.name,
            description: metadata.description,
            x402Support: metadata.x402Support,
            active: metadata.active,
            merchantId: metadata.merchantId,
            endpoint: metadata.endpoint,
            priceUsdt: metadata.priceUsdt,
          });
        }
      } catch (err) {
        console.warn(`[registry] Failed to read token ${tokenId}:`, err);
      }
    }

    return agents;
  } catch (err) {
    console.error("[registry] Failed to query registry:", err);
    return [];
  }
}

/**
 * Get a single agent by ERC-8004 token ID.
 */
export async function getAgent(id: number): Promise<AgentInfo | null> {
  const registry = getRegistry();
  if (!registry) return null;

  try {
    const uri: string = await registry.tokenURI(id);
    const metadata = decodeTokenURI(uri);
    return {
      id,
      name: metadata.name,
      description: metadata.description,
      x402Support: metadata.x402Support,
      active: metadata.active,
      merchantId: metadata.merchantId,
      endpoint: metadata.endpoint,
      priceUsdt: metadata.priceUsdt,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve an agent's callable endpoint.
 * Prefers the on-chain endpoint from metadata, falls back to known local routes.
 */
export function getAgentEndpoint(agent: AgentInfo): string | undefined {
  return agent.endpoint || AGENT_ENDPOINTS[agent.name];
}

/**
 * Get the price for an agent.
 * Prefers on-chain priceUsdt from metadata, falls back to default.
 */
export function getAgentPrice(agent: AgentInfo): string {
  return agent.priceUsdt ?? DEFAULT_PRICE_USDT;
}

// Fallback: hardcoded agents for demo when registry is unreachable or empty
export const DEMO_AGENTS: AgentInfo[] = [
  {
    id: 0,
    name: "Summarizer",
    description: "Summarizes long text into key points",
    x402Support: true,
    active: true,
    merchantId: "agents_marketplace",
    priceUsdt: "0.10",
  },
  {
    id: 1,
    name: "Translator",
    description: "Translates text to any language",
    x402Support: true,
    active: true,
    merchantId: "translator_agent",
    priceUsdt: "0.10",
  },
  {
    id: 2,
    name: "Code Explainer",
    description: "Explains code in plain English",
    x402Support: true,
    active: true,
    merchantId: "agents_marketplace",
    priceUsdt: "0.10",
  },
];
