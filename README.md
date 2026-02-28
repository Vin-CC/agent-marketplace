# 🤖 Agent Economy Marketplace

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
- `OPENAI_API_KEY`

### 3. Run locally
```bash
npm run dev
```

### 4. Deploy to Vercel
```bash
npx vercel --prod
```
Add all `.env` vars in Vercel dashboard → Settings → Environment Variables.

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
