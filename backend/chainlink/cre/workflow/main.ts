/**
 * Trende CRE Workflow — Entry Point
 *
 * Decentralized multi-model AI consensus for on-chain trend oracle resolution.
 *
 * Trigger: EVM log — listens for MarketCreated events on TrendeOracle
 * Pipeline: Fetch data → Query AI providers → Compute consensus → Settle on-chain
 *
 * Contract: TrendeOracle @ 0xe968d89E47c4e4Cd111dcde8d2E984703E7FeA8b (Arbitrum Sepolia)
 * Delivery: evmClient.writeReport() -> Chainlink forwarder -> TrendeOracle.onReport(...)
 */

import {
  EVMClient,
  type EVMLog,
  type Runtime,
  Runner,
  handler,
  hexToBytes,
  bytesToHex,
  hexToBase64,
} from "@chainlink/cre-sdk";
import type { Config, ConsensusResult } from "./types.js";
import { fetchGDELT, fetchCoinGecko, askVenice, askOpenRouter, askTrendeAPI } from "./providers.js";
import { computeConsensus } from "./consensus.js";
import type { AIProviderResponse } from "./types.js";

// Pre-computed keccak256("MarketCreated(bytes32,string,uint256)")
const MARKET_CREATED_TOPIC =
  "0x978ff0c9cb36151d8adf2a6c6204dbebfc2053171bb0ad00daafbfb5e6343c7d";

// ─── Helpers ────────────────────────────────────────────────────────────

/** ABI-decode a MarketCreated event from raw log data (manual, no viem dependency) */
function decodeMarketCreated(log: EVMLog): { marketId: string; topic: string } {
  // topics[0] = event signature, topics[1] = indexed bytes32 marketId
  const marketId = bytesToHex(log.topics[1]);
  // data = abi.encode(string topic, uint256 endTime)
  // string is dynamic: first 32 bytes = offset, then length, then content
  const dataHex = bytesToHex(log.data).slice(2); // remove 0x
  // offset to string data (first 32 bytes, skip)
  // uint256 endTime is at bytes 32-63 (skip)
  // string offset points to byte 64: length at 64-95, content at 96+
  const stringLenHex = dataHex.slice(128, 192);
  const stringLen = parseInt(stringLenHex, 16);
  const topicHex = dataHex.slice(192, 192 + stringLen * 2);
  let topic = "";
  for (let i = 0; i < topicHex.length; i += 2) {
    topic += String.fromCharCode(parseInt(topicHex.slice(i, i + 2), 16));
  }
  return { marketId, topic };
}

/** Simple ABI-encode for (bytes32, uint256, string) — produces raw hex without 0x */
function encodeSettlementData(marketId: string, score: number, summary: string): string {
  const cleanId = marketId.startsWith("0x") ? marketId.slice(2) : marketId;
  const scoreHex = BigInt(score).toString(16).padStart(64, "0");
  const summaryBytes = new TextEncoder().encode(summary.slice(0, 256));
  // offset to string (3 * 32 = 96 = 0x60)
  const offset = "0000000000000000000000000000000000000000000000000000000000000060";
  const len = summaryBytes.length.toString(16).padStart(64, "0");
  let content = "";
  for (const b of summaryBytes) content += b.toString(16).padStart(2, "0");
  // pad content to 32-byte boundary
  const padded = content.padEnd(Math.ceil(content.length / 64) * 64, "0");
  return cleanId + scoreHex + offset + len + padded;
}

// ─── Oracle Settlement ─────────────────────────────────────────────────

function settleOracle(
  runtime: Runtime<Config>,
  marketId: string,
  consensus: ConsensusResult
): string {
  const evmCfg = runtime.config.evms[0];
  const chainSelector =
    EVMClient.SUPPORTED_CHAIN_SELECTORS[
      evmCfg.chainSelectorName as keyof typeof EVMClient.SUPPORTED_CHAIN_SELECTORS
    ];
  const evmClient = new EVMClient(chainSelector);

  const reportData = "0x" + encodeSettlementData(marketId, consensus.score, consensus.summary);

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
      receiver: hexToBytes(evmCfg.oracleAddress),
      report: signed,
      gasConfig: { gasLimit: evmCfg.gasLimit },
      $report: true,
    })
    .result();

  return bytesToHex(result.txHash ?? new Uint8Array(32));
}

// ─── Handler ────────────────────────────────────────────────────────────

function onMarketCreated(
  runtime: Runtime<Config>,
  log: EVMLog
): string {
  // 1. Decode the MarketCreated event
  const { marketId, topic } = decodeMarketCreated(log);

  runtime.log(`Processing market ${marketId} for topic: ${topic}`);

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
  const chainSelector =
    EVMClient.SUPPORTED_CHAIN_SELECTORS[
      evmCfg.chainSelectorName as keyof typeof EVMClient.SUPPORTED_CHAIN_SELECTORS
    ];
  const evmClient = new EVMClient(chainSelector);

  return [
    handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(evmCfg.oracleAddress)],
        topics: [{ values: [hexToBase64(MARKET_CREATED_TOPIC)] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onMarketCreated
    ),
  ];
}

// ─── Bootstrap ──────────────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
