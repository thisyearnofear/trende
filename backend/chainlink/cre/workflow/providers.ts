/**
 * AI Provider & Data Source HTTP fetchers for the CRE workflow.
 *
 * Each function uses the CRE HTTPClient capability so that every node in the
 * DON independently fetches the data and reaches BFT consensus on the result.
 *
 * Provider priority: Venice (primary) → OpenRouter variants → OpenAI (fallback)
 */

import {
  HTTPClient,
  type HTTPSendRequester,
  type Runtime,
  consensusIdenticalAggregation,
} from "@chainlink/cre-sdk";
import type {
  Config,
  AIProviderResponse,
  GDELTArticle,
  CoinGeckoData,
} from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────

function ok(resp: { statusCode: number }): boolean {
  return resp.statusCode >= 200 && resp.statusCode < 300;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function uint8ToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64_CHARS[(b0 >> 2) & 0x3f];
    result += BASE64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f];
    result += i + 1 < bytes.length ? BASE64_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f] : "=";
    result += i + 2 < bytes.length ? BASE64_CHARS[b2 & 0x3f] : "=";
  }
  return result;
}

function encodeBody(data: unknown): string {
  const json = JSON.stringify(data);
  const bytes = new Uint8Array(json.length);
  for (let i = 0; i < json.length; i++) bytes[i] = json.charCodeAt(i);
  return uint8ToBase64(bytes);
}

function decodeBody(body: Uint8Array): string {
  let s = "";
  for (let i = 0; i < body.length; i++) s += String.fromCharCode(body[i]);
  return s;
}

// ─── System prompt shared by all AI providers ───────────────────────────

const SYSTEM_PROMPT =
  "You are an expert trend analyst. Analyze the topic using the provided data. " +
  "Return a concise analysis covering: sentiment (bullish/bearish/neutral), " +
  "key narratives, social momentum, and a confidence score from 0 to 100. " +
  "Be specific and data-driven. Output valid JSON: " +
  '{"score":0-100,"narrative":"...","pillars":["..."],"summary":"..."}';

// ─── Data Sources ───────────────────────────────────────────────────────

/**
 * Fetch the top GDELT article for a topic.
 * Provides verifiable news context for AI analysis.
 */
export function fetchGDELT(
  runtime: Runtime<Config>,
  topic: string
): GDELTArticle {
  const httpClient = new HTTPClient();

  const fetcher = (sendRequester: HTTPSendRequester, _config: Config) => {
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc` +
      `?query=${encodeURIComponent(topic)}&mode=ArtList&format=json&maxrecords=1&sort=DateDesc`;

    const resp = sendRequester
      .sendRequest({ url, method: "GET" as const, headers: {} })
      .result();

    if (!ok(resp)) return { title: "", url: "", source: "", timestamp: "" };

    try {
      const data = JSON.parse(decodeBody(resp.body));
      if (!data?.articles?.length) return { title: "", url: "", source: "", timestamp: "" };
      const article = data.articles[0];
      return {
        title: article.title ?? "",
        url: article.url ?? "",
        source: article.domain ?? "",
        timestamp: article.seendate ?? "",
      } as GDELTArticle;
    } catch (_) {
      return { title: "", url: "", source: "", timestamp: "" };
    }
  };

  return httpClient
    .sendRequest(runtime, fetcher, consensusIdenticalAggregation<GDELTArticle>())
    (runtime.config)
    .result();
}

/**
 * Fetch market data from CoinGecko for a coin ID.
 * Provides verifiable on-chain market context.
 */
export function fetchCoinGecko(
  runtime: Runtime<Config>,
  coinId: string
): CoinGeckoData {
  const httpClient = new HTTPClient();

  const fetcher = (sendRequester: HTTPSendRequester, _config: Config) => {
    const url =
      `https://api.coingecko.com/api/v3/coins/markets` +
      `?vs_currency=usd&ids=${encodeURIComponent(coinId)}&order=market_cap_desc&per_page=1&page=1&sparkline=false`;

    const resp = sendRequester
      .sendRequest({ url, method: "GET" as const, headers: {} })
      .result();

    if (!ok(resp)) return { name: "", symbol: "", price_usd: 0, market_cap: 0, price_change_24h: 0 };

    try {
      const data = JSON.parse(decodeBody(resp.body));
      if (!data?.length) return { name: "", symbol: "", price_usd: 0, market_cap: 0, price_change_24h: 0 };
      const coin = data[0];
      return {
        name: coin.name ?? "",
        symbol: coin.symbol ?? "",
        price_usd: coin.current_price ?? 0,
        market_cap: coin.market_cap ?? 0,
        price_change_24h: coin.price_change_percentage_24h ?? 0,
      } as CoinGeckoData;
    } catch (_) {
      return { name: "", symbol: "", price_usd: 0, market_cap: 0, price_change_24h: 0 };
    }
  };

  return httpClient
    .sendRequest(runtime, fetcher, consensusIdenticalAggregation<CoinGeckoData>())
    (runtime.config)
    .result();
}

// ─── AI Providers ───────────────────────────────────────────────────────

/**
 * Query Venice AI (Llama 3.3 70B) — Primary provider.
 * Venice routes through privacy-preserving inference.
 */
export function askVenice(
  runtime: Runtime<Config>,
  topic: string,
  context: string
): AIProviderResponse {
  const apiKey = runtime.getSecret({ id: "VENICE_API_KEY" }).result();
  const httpClient = new HTTPClient();

  const fetcher = (sendRequester: HTTPSendRequester, _config: Config): AIProviderResponse => {
    const body = encodeBody({
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Topic: ${topic}\n\nContext:\n${context}` },
      ],
    });

    const resp = sendRequester
      .sendRequest({
        url: "https://api.venice.ai/api/v1/chat/completions",
        method: "POST" as const,
        body,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.value}`,
        },
      })
      .result();

    if (!ok(resp)) {
      return { provider: "venice", analysis: "", statusCode: resp.statusCode };
    }

    let analysis = "";
    try {
      const data = JSON.parse(decodeBody(resp.body));
      analysis = data.choices?.[0]?.message?.content ?? "";
    } catch (_) {
      analysis = "";
    }
    return { provider: "venice", analysis, statusCode: resp.statusCode };
  };

  return httpClient
    .sendRequest(runtime, fetcher, consensusIdenticalAggregation<AIProviderResponse>())
    (runtime.config)
    .result();
}

/**
 * Query OpenRouter (Llama 3.3 70B free tier) — Secondary provider.
 * Provides model diversity via different inference infrastructure.
 */
export function askOpenRouter(
  runtime: Runtime<Config>,
  topic: string,
  context: string
): AIProviderResponse {
  const apiKey = runtime.getSecret({ id: "OPENROUTER_API_KEY" }).result();
  const httpClient = new HTTPClient();

  const fetcher = (sendRequester: HTTPSendRequester, _config: Config): AIProviderResponse => {
    const body = encodeBody({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Topic: ${topic}\n\nContext:\n${context}` },
      ],
    });

    const resp = sendRequester
      .sendRequest({
        url: "https://openrouter.ai/api/v1/chat/completions",
        method: "POST" as const,
        body,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.value}`,
          "HTTP-Referer": "https://trende.famile.xyz",
          "X-Title": "Trende CRE Workflow",
        },
      })
      .result();

    if (!ok(resp)) {
      return { provider: "openrouter", analysis: "", statusCode: resp.statusCode };
    }

    let analysis = "";
    try {
      const data = JSON.parse(decodeBody(resp.body));
      analysis = data.choices?.[0]?.message?.content ?? "";
    } catch (_) {
      analysis = "";
    }
    return { provider: "openrouter", analysis, statusCode: resp.statusCode };
  };

  return httpClient
    .sendRequest(runtime, fetcher, consensusIdenticalAggregation<AIProviderResponse>())
    (runtime.config)
    .result();
}

/**
 * Query the Trende API itself for a pre-computed consensus.
 * Acts as a third independent voice — the API runs its own multi-model pipeline
 * (Venice + AIsa + OpenRouter variants) with TEE attestation.
 */
export function askTrendeAPI(
  runtime: Runtime<Config>,
  topic: string
): AIProviderResponse {
  const httpClient = new HTTPClient();

  const fetcher = (sendRequester: HTTPSendRequester, config: Config): AIProviderResponse => {
    const url =
      `${config.trendeApiUrl}/api/consensus/resolve` +
      `?topic=${encodeURIComponent(topic)}`;

    const resp = sendRequester
      .sendRequest({
        url,
        method: "GET" as const,
        headers: { "Content-Type": "application/json" },
      })
      .result();

    if (!ok(resp)) {
      return { provider: "trende-api", analysis: "", statusCode: resp.statusCode };
    }

    let analysis = "";
    try {
      const data = JSON.parse(decodeBody(resp.body));
      const score = Math.round((data.agreement_score ?? 0.5) * 100);
      analysis = JSON.stringify({
        score,
        narrative: data.top_narrative ?? "",
        pillars: data.pillars ?? [],
        summary: data.consensus_report ?? data.top_narrative ?? "",
      });
    } catch (_) {
      analysis = "";
    }
    return { provider: "trende-api", analysis, statusCode: resp.statusCode };
  };

  return httpClient
    .sendRequest(runtime, fetcher, consensusIdenticalAggregation<AIProviderResponse>())
    (runtime.config)
    .result();
}
