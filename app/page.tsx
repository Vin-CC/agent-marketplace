"use client";

import { useState } from "react";

const AGENTS = [
  { name: "Summarizer", emoji: "📄", desc: "Summarizes long text into bullet points", price: "0.10 USDT" },
  { name: "Translator", emoji: "🌍", desc: "Translates text to any language", price: "0.10 USDT" },
  { name: "Code Explainer", emoji: "🧑‍💻", desc: "Explains code in plain English", price: "0.10 USDT" },
];

const ORCHESTRATOR_WALLET = "0x516D0DbF39F86D0D47460408b50D15F0A9824aCa";

interface Transaction {
  agent: string;
  txHash: string;
  amount: string;
  currency: string;
  explorer: string;
}

interface OrchestrateResult {
  transactions: Transaction[];
  outputs: Record<string, string>;
  demoMode?: boolean;
}

export default function Home() {
  const [text, setText] = useState("");
  const [task, setTask] = useState("full-pipeline");
  const [targetLanguage, setTargetLanguage] = useState("French");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runOrchestrator() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, text, targetLanguage }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
            Agent Economy
          </h1>
          <p className="text-gray-400 text-lg mb-4">
            AI agents hire other AI agents · Powered by GOAT Network x402 + ERC-8004
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <span className="bg-orange-900/40 text-orange-400 px-3 py-1 rounded-full text-sm border border-orange-800">
              🔗 GOAT Testnet3 · Chain 48816
            </span>
            <span className="bg-yellow-900/40 text-yellow-400 px-3 py-1 rounded-full text-sm border border-yellow-800">
              💳 x402 payments
            </span>
            <span className="bg-purple-900/40 text-purple-400 px-3 py-1 rounded-full text-sm border border-purple-800">
              🪪 ERC-8004 identity
            </span>
            <a
              href={`https://explorer.testnet3.goat.network/address/${ORCHESTRATOR_WALLET}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-900/40 text-blue-400 px-3 py-1 rounded-full text-sm border border-blue-800 hover:bg-blue-900/70 transition-colors"
            >
              🔍 Orchestrator on-chain ↗
            </a>
          </div>
        </div>

        {/* Agent Registry */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">🤖 Registered Agents</h2>
          <div className="grid grid-cols-3 gap-4">
            {AGENTS.map((a) => (
              <div key={a.name} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div className="text-3xl mb-2">{a.emoji}</div>
                <div className="font-semibold">{a.name}</div>
                <div className="text-gray-400 text-sm mt-1">{a.desc}</div>
                <div className="mt-3 text-orange-400 font-mono text-sm">{a.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Orchestrator */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">⚡ Orchestrator</h2>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Task</label>
            <select
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="full-pipeline">Full Pipeline (all agents)</option>
              <option value="summarize">Summarize only</option>
              <option value="translate">Translate only</option>
              <option value="explain-code">Explain Code only</option>
            </select>
          </div>

          {(task === "translate" || task === "full-pipeline") && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Target Language</label>
              <input
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white"
                placeholder="French, Spanish, Japanese..."
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Input Text / Code</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none"
              placeholder="Paste your text or code here..."
            />
          </div>

          <button
            onClick={runOrchestrator}
            disabled={loading || !text}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? "🔄 Orchestrating... (paying agents on-chain)" : "🚀 Run Orchestrator"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {result.demoMode && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-3 text-yellow-300 text-sm">
                ⚠️ Demo mode — transactions simulated. Connect @goathackbot credentials for live on-chain payments.
              </div>
            )}

            {/* Transactions */}
            <div className="bg-gray-900 border border-green-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-green-400 mb-4">
                ✅ Transactions ({result.transactions.length})
              </h3>
              <div className="space-y-2">
                {result.transactions.map((tx) => (
                  <div key={tx.txHash} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                    <div>
                      <span className="font-semibold">{tx.agent}</span>
                      <span className="text-gray-400 text-sm ml-3">{tx.amount} {tx.currency}</span>
                    </div>
                    <a
                      href={tx.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 text-sm font-mono hover:underline"
                    >
                      {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs */}
            {Object.entries(result.outputs).map(([agent, output]) => (
              <div key={agent} className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <h3 className="font-semibold text-gray-300 mb-3">📤 {agent} Output</h3>
                <p className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{output}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
