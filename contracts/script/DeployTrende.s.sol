// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console2} from "forge-std/Script.sol";
import {TrendeOracle} from "../src/TrendeOracle.sol";
import {TrendeFunctionsConsumer} from "../src/TrendeFunctionsConsumer.sol";

contract DeployTrende is Script {
    // --- Base Sepolia ---
    address constant ROUTER_BASE_SEPOLIA = 0xf9B8fc078197181C841c296C876945aaa425B278;
    bytes32 constant DON_ID_BASE_SEPOLIA = 0x66756e2d626173652d7365706f6c69612d310000000000000000000000000000;

    // --- Arbitrum Sepolia ---
    address constant ROUTER_ARB_SEPOLIA = 0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C;
    bytes32 constant DON_ID_ARB_SEPOLIA = 0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 chainId = block.chainid;

        address router;
        bytes32 donId;
        string memory networkName;

        if (chainId == 84532) {
            // Base Sepolia
            router = ROUTER_BASE_SEPOLIA;
            donId = DON_ID_BASE_SEPOLIA;
            networkName = "Base Sepolia";
        } else if (chainId == 421614) {
            // Arbitrum Sepolia
            router = ROUTER_ARB_SEPOLIA;
            donId = DON_ID_ARB_SEPOLIA;
            networkName = "Arbitrum Sepolia";
        } else {
            revert("Unsupported chain. Use Base Sepolia (84532) or Arbitrum Sepolia (421614).");
        }

        console2.log("Deploying Trende on:", networkName);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy TrendeFunctionsConsumer (Data Fetcher)
        TrendeFunctionsConsumer consumer = new TrendeFunctionsConsumer(router);
        console2.log("TrendeFunctionsConsumer deployed at:", address(consumer));

        // 2. Deploy TrendeOracle (Market Logic)
        uint64 subId = uint64(vm.envOr("CHAINLINK_SUBSCRIPTION_ID", uint256(0)));
        TrendeOracle oracle = new TrendeOracle(router, subId, donId);
        console2.log("TrendeOracle deployed at:", address(oracle));

        address creForwarder = vm.envOr("CHAINLINK_CRE_FORWARDER", address(0));
        if (creForwarder != address(0)) {
            oracle.setCREForwarder(creForwarder);
            console2.log("CRE forwarder configured:");
            console2.log(creForwarder);
        }

        vm.stopBroadcast();

        // Output for .env update
        console2.log("--- UPDATE .ENV ---");
        console2.log("Network:", networkName);
        console2.log("CHAINLINK_CONSUMER_ADDRESS=");
        console2.log(address(consumer));
        console2.log("CHAINLINK_ORACLE_ADDRESS=");
        console2.log(address(oracle));
    }
}
