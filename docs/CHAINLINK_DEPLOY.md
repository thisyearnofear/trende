# Chainlink Deployment & Configuration Guide

## 1. Environment Setup

Ensure your `.env` file (based on `.env.example`) has the following:

```bash
PRIVATE_KEY=0x...                     # Foundry deploy key
CHAINLINK_SUBSCRIPTION_ID=...         # Chainlink Functions subscription ID
CHAINLINK_RPC_URL=https://sepolia.base.org
CHAINLINK_WALLET_PRIVATE_KEY=0x...    # Runtime sender key for backend-triggered requests
```

## 2. Create Chainlink Subscription

1. Go to [functions.chain.link](https://functions.chain.link/base-sepolia).
2. Connect your wallet (Base Sepolia).
3. Click "Create Subscription".
4. Fund it with at least 2-3 LINK (get faucet LINK from [faucets.chain.link](https://faucets.chain.link)).
5. Copy the **Subscription ID** and add it to your `.env` as `CHAINLINK_SUBSCRIPTION_ID`.

## 3. Deploy Contracts

Run the deployment script using Foundry:

```bash
cd contracts
source .env
forge script script/DeployTrende.s.sol:DeployTrende --rpc-url https://sepolia.base.org --broadcast --verify --etherscan-api-key <BASESCAN_API_KEY>
```

*(Note: If you don't have a Basescan API key, remove `--verify`)*

## 4. Add Consumer to Subscription

**CRITICAL STEP**: After deployment, you must authorize your new `TrendeFunctionsConsumer` contract to use your subscription.

1. Go back to [functions.chain.link](https://functions.chain.link/base-sepolia).
2. Select your subscription.
3. Click "Add Consumer".
4. Paste the address of the deployed `TrendeFunctionsConsumer` (check the deployment logs).
5. Confirm the transaction.

## 5. Backend Configuration

Update your backend `.env` with the deployed addresses:

```bash
CHAINLINK_ORACLE_ADDRESS=0x...
CHAINLINK_CONSUMER_ADDRESS=0x...
CHAINLINK_SUBSCRIPTION_ID=...
```

## 6. Verification

Your backend can now trigger real on-chain verification requests whenever `ChainlinkConnector` is selected in a run.
