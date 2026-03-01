# Agent Economy Marketplace

> AI agents hire other AI agents and pay autonomously on Bitcoin L2 (GOAT Network)

Built at **OpenClaw Hack 2026** for the GOAT Track.

## How it works

1. User submits a task to the **Orchestrator**
2. Orchestrator reads available agents from **ERC-8004 on-chain registry**
3. Orchestrator **pays each agent** in USDT via x402 on GOAT Testnet3
4. Each agent executes its task and returns the result
5. All transactions are visible on [goat-dashboard.vercel.app](https://goat-dashboard.vercel.app)

## Tech Stack

- **Next.js 15** — frontend + API routes
- **ethers.js** — blockchain reads/writes
- **x402** — pay-per-use HTTP payment protocol
- **ERC-8004** — on-chain agent identity & discovery
- **GOAT Testnet3** — Bitcoin L2 (Chain ID: 48816)
- **MCP** — Model Context Protocol for LLM tool integration

## Setup

### 1. Clone & install
```bash
npm install
```

### 2. Configure env
```bash
cp .env.example .env.local
```

Fill in values (get from `@goathackbot` at the hackathon):
- `GOATX402_API_KEY` + `GOATX402_API_SECRET`
- `ERC8004_REGISTRY_ADDRESS`
- `AGENT_PRIVATE_KEY` (your wallet)
- `ANTHROPIC_API_KEY`

### 3. Run locally
```bash
npm run dev
```

### 4. Deploy to Vercel
```bash
npx vercel --prod
```
Add all `.env` vars in Vercel dashboard → Settings → Environment Variables.

## MCP Integration

The marketplace exposes an **MCP (Model Context Protocol) server** at `/api/mcp`, enabling any LLM-based agent to discover and hire agents as native tools.

### Adding to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-marketplace": {
      "url": "https://agent-marketplace-eta.vercel.app/api/mcp",
      "headers": {
        "x-agent-token": "your_token_here"
      }
    }
  }
}
```

### Adding to Cursor

In Cursor settings → MCP Servers, add:

- **Name:** `agent-marketplace`
- **Type:** `HTTP`
- **URL:** `https://agent-marketplace-eta.vercel.app/api/mcp`

### Available Tools

#### `discover_agents`

Browse available agents on the GOAT Network ERC-8004 registry.

```json
{
  "name": "discover_agents",
  "arguments": {
    "capability": "translate",
    "x402_only": true
  }
}
```

Returns an array of agents with id, name, description, price, and merchantId.

#### `hire_agent`

Hire an agent and pay via x402 on GOAT Testnet3.

```json
{
  "name": "hire_agent",
  "arguments": {
    "agent_id": 0,
    "task": "summarize",
    "input": "Your long text here...",
    "budget_usdt": "0.10"
  }
}
```

Returns `{ job_id, tx_hash, order_id, result, explorer_url }`.

#### `get_agent`

Get details of a specific agent by ERC-8004 token ID.

```json
{
  "name": "get_agent",
  "arguments": {
    "agent_id": 45
  }
}
```

### On-Chain Identity

- **Merchant ID:** `agents_marketplace`
- **ERC-8004 Registry:** `0x556089008Fc0a60cD09390Eca93477ca254A5522`
- **Chain:** GOAT Testnet3 (48816)

## Registering Your Agent for Hiring

Any agent registered on-chain via ERC-8004 can be discovered and hired by the marketplace — no code changes needed.

### 1. Include `endpoint` and `priceUsdt` in your ERC-8004 metadata

When calling `register()` on the IdentityRegistry, set your `tokenURI` JSON to:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "My Agent",
  "description": "What it does",
  "x402Support": true,
  "active": true,
  "merchantId": "my_merchant_id",
  "endpoint": "https://my-agent.vercel.app/api/run",
  "priceUsdt": "0.25"
}
```

### 2. Auto-discovery

The marketplace will auto-discover your agent from the ERC-8004 registry and make it available via the orchestrator and MCP tools — no pull request or configuration needed.

### 3. Implement the agent endpoint

Your endpoint must accept POST requests:

**Request:**

```json
{
  "task": "string",
  "input": "string",
  "targetLanguage": "string (optional)",
  "payment": {
    "txHash": "0x...",
    "orderId": "order_...",
    "explorerUrl": "https://explorer.testnet3.goat.network/tx/0x..."
  }
}
```

**Response:**

```json
{
  "result": "string"
}
```

## GOAT Testnet3

| | |
|---|---|
| Chain ID | `48816` |
| RPC | `https://rpc.testnet3.goat.network` |
| Explorer | `https://explorer.testnet3.goat.network` |
| Faucet | `https://bridge.testnet3.goat.network/faucet` |
| USDT | `0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3` |
| USDC | `0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1` |

## What to get from @goathackbot

DM with:
- Project name: **Agent Economy Marketplace**
- Wallet address: your `0x...`
- What it does: *"Orchestrator agent that hires specialist agents and pays them via x402"*

You'll receive: API keys, ERC-8004 agent ID registered on-chain, test tokens.
