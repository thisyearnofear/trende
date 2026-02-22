/**
 * Trende CRE Workflow — Entry Point
 *
 * Decentralized multi-model AI consensus for on-chain trend oracle resolution.
 *
 * Trigger: EVM log — listens for MarketCreated events on TrendeOracle
 * Pipeline: Fetch data → Query AI providers → Compute consensus → Settle on-chain
 *
 * Contract: TrendeOracle @ 0xe968d89E47c4e4Cd111dcde8d2E984703E7FeA8b (Arbitrum Sepolia)
 */

import cre, { type Runtime, type EVMLog } from "@chainlink/cre-sdk";
import { Runner } from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  bytesToHex,
  keccak256,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { configSchema, marketCreatedEventAbi, type Config } from "./types.js";
import { fetchGDELT, fetchCoinGecko, askVenice, askOpenRouter, askTrendeAPI } from "./providers.js";
import { computeConsensus } from "./consensus.js";
import type { AIProviderResponse } from "./types.js";

// ─── Oracle Settlement (inline, single call site) ──────────────────────

function hexToBase64(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(
    clean.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  return Buffer.from(bytes).toString("base64");
}

function settleOracle(
  runtime: Runtime<Config>,
  marketId: `0x${string}`,
  consensus: ConsensusResult
): string {
  const evmCfg = runtime.config.evms[0];
  const network = cre.getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmCfg.chainSelectorName,
    isTestnet: true,
  });
  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  // ABI-encode: (bytes32 marketId, uint256 score, string summary)
  const reportData = encodeAbiParameters(
    parseAbiParameters("bytes32 marketId, uint256 score, string summary"),
    [
      marketId,
      BigInt(consensus.score),
      consensus.summary.slice(0, 256),
    ]
  );

  // CRE DON signs the payload via BFT consensus
  const signed = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const result = evmClient
    .writeReport(runtime, {
      receiver: evmCfg.oracleAddress,
      report: signed,
      gasConfig: { gasLimit: evmCfg.gasLimit },
    })
    .result();

  return bytesToHex(result.txHash ?? new Uint8Array(32));
}

// ─── Handler ────────────────────────────────────────────────────────────

const EVENT_SIGNATURE = "MarketCreated(bytes32,string,uint256)";

function onMarketCreated(
  runtime: Runtime<Config>,
  log: EVMLog
): string {
  // 1. Decode the MarketCreated event
  const topics = log.topics.map((t) => bytesToHex(t)) as [
    `0x${string}`,
    ...`0x${string}`[],
  ];
  const decoded = decodeEventLog({
    abi: marketCreatedEventAbi,
    data: bytesToHex(log.data),
    topics,
  });
  const marketId = decoded.args.marketId as `0x${string}`;
  const topic = decoded.args.topic as string;

  // 2. Fetch verifiable data context (GDELT + CoinGecko)
  const gdelt = fetchGDELT(runtime, topic);
  const coinData = fetchCoinGecko(runtime, topic.toLowerCase().replace(/\s+/g, "-"));

  let context = "";
  if (gdelt) {
    context += `[GDELT] "${gdelt.title}" — ${gdelt.source} (${gdelt.timestamp})\n`;
  }
  if (coinData) {
    context += `[CoinGecko] ${coinData.name} ($${coinData.price_usd}) 24h: ${coinData.price_change_24h}%\n`;
  }
  if (!context) {
    context = "No external data sources returned results.";
  }

  // 3. Query AI providers in parallel (Venice primary, OpenRouter secondary, Trende API tertiary)
  const responses: AIProviderResponse[] = [];

  const venice = askVenice(runtime, topic, context);
  responses.push(venice);

  const openrouter = askOpenRouter(runtime, topic, context);
  responses.push(openrouter);

  const trendeApi = askTrendeAPI(runtime, topic);
  responses.push(trendeApi);

  // 4. Compute multi-model consensus
  const consensus = computeConsensus(responses);

  // 5. Settle on-chain
  const txHash = settleOracle(runtime, marketId, consensus);

  return `Settled market ${marketId} | score=${consensus.score} | providers=${consensus.providerCount} | agreement=${consensus.agreementScore.toFixed(2)} | tx=${txHash}`;
}

// ─── Workflow Registration ──────────────────────────────────────────────

function initWorkflow(config: Config) {
  const evmCfg = config.evms[0];
  const network = cre.getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmCfg.chainSelectorName,
    isTestnet: true,
  });
  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  const eventHash = keccak256(toHex(EVENT_SIGNATURE));

  return [
    cre.handler(
      evmClient.logTrigger({
        addresses: [evmCfg.oracleAddress],
        topics: [{ values: [eventHash] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onMarketCreated
    ),
  ];
}

// ─── Bootstrap ──────────────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
