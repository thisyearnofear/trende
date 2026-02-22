# Chainlink Deployment & Configuration Guide

Trende deploys on **two L2 testnets** to prove chain-agnostic capability:

| Network | Chain ID | Router | DON ID | Status |
|---------|----------|--------|--------|--------|
| Base Sepolia | 84532 | `0xf9B8fc078197181C841c296C876945aaa425B278` | `fun-base-sepolia-1` | 🟡 Pending |
| Arbitrum Sepolia | 421614 | `0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C` | `fun-arbitrum-sepolia-1` | ✅ **Live** |

### 🟢 Active Deployment: Arbitrum Sepolia
- **TrendeFunctionsConsumer**: `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21`
- **TrendeOracle**: `0xe968d89E47c4e4Cd111dcde8d2E984703E7FeA8b`
- **Subscription ID**: `558` (Funded)

## 1. Environment Setup

Ensure your `.env` file (based on `.env.example`) has the following:

```bash
PRIVATE_KEY=0x...                     # Foundry deploy key
CHAINLINK_SUBSCRIPTION_ID=...         # Chainlink Functions subscription ID
CHAINLINK_RPC_URL=https://sepolia.base.org
CHAINLINK_WALLET_PRIVATE_KEY=0x...    # Runtime sender key
CHAINLINK_ACTIVE_CHAIN=base-sepolia   # or "arbitrum-sepolia"

# Foundry RPC endpoints
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## 2. Create Chainlink Subscriptions

You need a **separate subscription per network**.

### Base Sepolia
1. Go to [functions.chain.link/base-sepolia](https://functions.chain.link/base-sepolia).
2. Connect your wallet (Base Sepolia).
3. Click "Create Subscription" → Fund with 2-3 LINK.
4. Copy the **Subscription ID**.

### Arbitrum Sepolia
1. Go to [functions.chain.link/arbitrum-sepolia](https://functions.chain.link/arbitrum-sepolia).
2. Connect your wallet (Arbitrum Sepolia).
3. Click "Create Subscription" → Fund with 2-3 LINK.
4. Copy the **Subscription ID**.

Get testnet LINK from [faucets.chain.link](https://faucets.chain.link).

## 3. Deploy Contracts

The deploy script auto-detects the network from the RPC chain ID.

### Deploy to Base Sepolia

```bash
cd contracts
source ../.env
forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url base-sepolia \
  --broadcast \
  --verify --etherscan-api-key $BASESCAN_API_KEY
```

### Deploy to Arbitrum Sepolia

```bash
cd contracts
source ../.env
CHAINLINK_SUBSCRIPTION_ID=<arb-sub-id> \
forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url arbitrum-sepolia \
  --broadcast \
  --verify --etherscan-api-key $ARBISCAN_API_KEY
```

*(Remove `--verify` if you don't have an explorer API key)*

## 4. Add Consumer to Subscription

**CRITICAL**: After each deployment, authorize the `TrendeFunctionsConsumer` contract address on the corresponding network's subscription:

1. Go to [functions.chain.link](https://functions.chain.link) and select the correct network.
2. Select your subscription.
3. Click "Add Consumer" → paste the deployed `TrendeFunctionsConsumer` address.
4. Confirm the transaction.

## 5. Backend Configuration

Update your `.env` with the deployed addresses for your **active chain**:

```bash
CHAINLINK_ACTIVE_CHAIN=base-sepolia   # Switch to "arbitrum-sepolia" as needed
CHAINLINK_RPC_URL=https://sepolia.base.org
CHAINLINK_CONSUMER_ADDRESS=0x...
CHAINLINK_ORACLE_ADDRESS=0x...
CHAINLINK_SUBSCRIPTION_ID=...
```

To switch chains at runtime, change `CHAINLINK_ACTIVE_CHAIN` and the corresponding `CHAINLINK_RPC_URL` / addresses.

## 6. Market Resolution Logic

Trende uses a specialized `TrendeOracle` contract and a JavaScript resolution script to settle prediction markets:

1. **Market Creation**: `ChainlinkService.create_market(topic, duration)` deploys a `Market` struct on-chain.
2. **Resolution Request**: Triggered via `ChainlinkService.resolve_market(marketId, js_source)`.
3. **Automated AI Consensus**: The `oracle-resolution.js` script fetches the consensus from the Trende API, verifies the agreement score, and returns it to the oracle.
4. **On-Chain Settlement**: `TrendeOracle.fulfillRequest` decodes the result and updates the market status to `resolved=true`.

## Troubleshooting

- **Missing Results**: Ensure your connector returns valid `TrendItem` objects with **string IDs**. The backend drops items with `null` IDs.
- **Gas Failures**: Ensure your subscription is funded with LINK (at least 2-3 LINK per network).
- **Unauthorized Consumer**: Double-check that you added the consumer contract address to your subscription in the Chainlink Functions UI.
- **Wrong DON ID**: The deploy script auto-selects based on chain ID. If deploying manually, verify the DON ID matches the network.
