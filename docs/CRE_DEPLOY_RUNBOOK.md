# CRE End-to-End Deployment Runbook

Complete sequence to deploy a fresh TrendeOracle, register the CRE workflow, and lock all on-chain metadata for a verified end-to-end transaction.

---

## Prerequisites

```bash
# Required env vars — set these before starting
export PRIVATE_KEY=0x...
export CHAINLINK_SUBSCRIPTION_ID=<your_sub_id>
export ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Known constants (Arbitrum Sepolia)
export CHAINLINK_CRE_FORWARDER=0x76c9cf548b4179F8901cda1f8623568b58215E62
export CHAINLINK_CRE_EXPECTED_WORKFLOW_NAME="trende-cre-workflow-staging"
```

---

## Step 1 — Deploy TrendeOracle

Deploy with all CRE metadata in one shot (avoids 4 separate `cast send` calls later if you already have the workflow ID and author):

```bash
cd /Users/udingethe/Dev/trende/contracts

# Option A: Deploy now, set CRE metadata after cre deploy (recommended for first run)
forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# Option B: Deploy with all CRE metadata at once (use after you have WORKFLOW_ID + WORKFLOW_AUTHOR)
export CHAINLINK_CRE_EXPECTED_WORKFLOW_AUTHOR=<WORKFLOW_AUTHOR>
export CHAINLINK_CRE_EXPECTED_WORKFLOW_ID=<WORKFLOW_ID>

forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

### Capture from deploy output

```
CHAINLINK_ORACLE_ADDRESS=<new oracle address>   ← save this
CHAINLINK_CONSUMER_ADDRESS=<consumer address>   ← save this
```

---

## Step 2 — Update config.json

Replace `oracleAddress` with the newly deployed oracle:

```bash
ORACLE_ADDRESS=<CHAINLINK_ORACLE_ADDRESS from Step 1>

cat > /Users/udingethe/Dev/trende/backend/chainlink/cre/workflow/config.json <<EOF
{
  "evms": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia-arbitrum-1",
      "oracleAddress": "$ORACLE_ADDRESS",
      "gasLimit": "500000"
    }
  ],
  "trendeApiUrl": "https://api.trende.famile.xyz",
  "consensusThreshold": 0.5
}
EOF
```

---

## Step 3 — Simulate Workflow

> ✅ **Already verified passing** — score=40, agreement=1.00 on live Arbitrum Sepolia `MarketCreated` tx `0xcbcf881bd9cc0615a201e7db5ddc12e07423ea57617e362b063e066b0a43b364`

```bash
cd /Users/udingethe/Dev/trende/backend/chainlink/cre/workflow

# ARM64 Mac: ensure native bun is on PATH
export PATH="$HOME/.bun/bin:$PATH"

# Source env vars (Venice + OpenRouter keys required)
set -a && source /Users/udingethe/Dev/trende/.env && set +a

# Simulate against a real MarketCreated tx
cre workflow simulate . \
  -T staging-settings \
  -R . \
  --non-interactive \
  --trigger-index 0 \
  --evm-tx-hash 0xcbcf881bd9cc0615a201e7db5ddc12e07423ea57617e362b063e066b0a43b364 \
  --evm-event-index 0
```

Expected output: `Settled market 0x... | score=40 | providers=1 | agreement=1.00 | tx=0x000...`

---

## Step 4 — Deploy CRE Workflow

> ⏳ **Blocked** — waiting on Chainlink deploy access approval (request submitted; email to `papaandthejimjams@gmail.com`)

```bash
cd /Users/udingethe/Dev/trende/backend/chainlink/cre/workflow

# ARM64 Mac: ensure native bun is on PATH
export PATH="$HOME/.bun/bin:$PATH"

cre workflow deploy . -T staging-settings -R .
```

### Capture from cre deploy output — save all four values

| Field | Where to find it | Variable |
|---|---|---|
| Workflow ID | printed as `workflowId` or `id` | `WORKFLOW_ID` |
| Workflow Author / Owner | printed as `owner` or `author` | `WORKFLOW_AUTHOR` |
| Workflow Name | confirmed as `trende-cre-workflow-staging` | `CHAINLINK_CRE_EXPECTED_WORKFLOW_NAME` |
| Deploy tx hash | printed as `txHash` | `DEPLOY_TX` |

```bash
# Set these from cre deploy output
export WORKFLOW_ID=0x...       # bytes32
export WORKFLOW_AUTHOR=0x...   # address
```

---

## Step 5 — Set On-Chain CRE Metadata

Run all four `cast send` calls in order:

```bash
ORACLE_ADDRESS=<CHAINLINK_ORACLE_ADDRESS from Step 1>
RPC=https://sepolia-rollup.arbitrum.io/rpc

# 1. Set CRE forwarder
cast send $ORACLE_ADDRESS \
  "setCREForwarder(address)" $CHAINLINK_CRE_FORWARDER \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC

# 2. Set expected workflow author
cast send $ORACLE_ADDRESS \
  "setExpectedWorkflowAuthor(address)" $WORKFLOW_AUTHOR \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC

# 3. Set expected workflow name (contract hashes it internally via sha256)
cast send $ORACLE_ADDRESS \
  "setExpectedWorkflowName(string)" "$CHAINLINK_CRE_EXPECTED_WORKFLOW_NAME" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC

# 4. Set expected workflow ID
cast send $ORACLE_ADDRESS \
  "setExpectedWorkflowId(bytes32)" $WORKFLOW_ID \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

---

## Step 6 — Verify On-Chain State

```bash
ORACLE_ADDRESS=<your oracle>
RPC=https://sepolia-rollup.arbitrum.io/rpc

cast call $ORACLE_ADDRESS "creForwarder()(address)" --rpc-url $RPC
cast call $ORACLE_ADDRESS "expectedWorkflowAuthor()(address)" --rpc-url $RPC
cast call $ORACLE_ADDRESS "expectedWorkflowName()(bytes10)" --rpc-url $RPC
cast call $ORACLE_ADDRESS "expectedWorkflowId()(bytes32)" --rpc-url $RPC
```

All four must return non-zero values before proceeding.

---

## Step 7 — Create a Test Market (End-to-End Trigger)

```bash
# Creates a market that fires MarketCreated event → triggers CRE workflow
cast send $ORACLE_ADDRESS \
  "createMarket(string,uint256)" "Will Bitcoin exceed 100k by end of March 2026?" 86400 \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

Watch for the full chain:
1. `MarketCreated` event emitted on-chain
2. CRE workflow triggered by log
3. Forwarder delivers report to `TrendeOracle.onReport(...)`
4. `MarketResolved` event emitted on-chain

---

## Step 8 — Confirm Resolution

```bash
# Get the marketId from the MarketCreated tx receipt logs (topics[1])
MARKET_ID=0x...

cast call $ORACLE_ADDRESS \
  "markets(bytes32)(bytes32,string,uint256,bool,uint256,string)" $MARKET_ID \
  --rpc-url $RPC
```

`resolved` field (4th value) must be `true`.

---

## Hackathon Artifacts to Save

```
Oracle Address:      0xBd5c0e7f8d5F4295a0633a5f3b411ee458Bc985C
Consumer Address:    0x983b3a94C8266310192135d60D77B871549B9CfF
Workflow ID:         <WORKFLOW_ID — set after cre deploy>
Workflow Author:     <WORKFLOW_AUTHOR — set after cre deploy>
Workflow Name:       trende-cre-workflow-staging
CRE Forwarder:       0x76c9cf548b4179F8901cda1f8623568b58215E62
Deploy Tx Hash:      <DEPLOY_TX — set after cre deploy>
Network:             Arbitrum Sepolia (chainId 421614)
Chain Selector:      ethereum-testnet-sepolia-arbitrum-1
Simulation Tx:       0xcbcf881bd9cc0615a201e7db5ddc12e07423ea57617e362b063e066b0a43b364 ✅
MarketCreated Tx:    <tx hash from Step 7>
MarketResolved Tx:   <tx hash from onReport callback>
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `onReport` reverts with `OnlyCREForwarder` | `creForwarder` not set or wrong address | Re-run Step 5 cast #1 |
| `onReport` reverts with `InvalidWorkflowAuthor` | `expectedWorkflowAuthor` mismatch | Re-run Step 5 cast #2 with correct address from cre deploy |
| `onReport` reverts with `InvalidWorkflowName` | Name hash mismatch | Ensure exact string `"trende-cre-workflow-staging"` passed to cast #3 |
| `onReport` reverts with `InvalidWorkflowId` | Wrong workflow ID bytes32 | Re-run Step 5 cast #4 with correct ID from cre deploy |
| Market not resolving | CRE not triggered | Check `config.json` oracle address matches deployed oracle |
| `wasm trap: unreachable` on simulate | x86 bun binary used on ARM64 Mac | Run `export PATH="$HOME/.bun/bin:$PATH"` to use native ARM64 bun |
| Simulate fails with missing secrets | API keys not in env | Run `set -a && source /path/to/.env && set +a` before simulate |
