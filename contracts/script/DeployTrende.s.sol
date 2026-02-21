// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console2} from "forge-std/Script.sol";
import {TrendeOracle} from "../src/TrendeOracle.sol";
import {TrendeFunctionsConsumer} from "../src/TrendeFunctionsConsumer.sol";

contract DeployTrende is Script {
    // Base Sepolia Router Address
    address constant ROUTER_BASE_SEPOLIA = 0xf9B8fc0781971Add66D333609193051785cc4A38;
    
    // DON ID for Base Sepolia (fun-base-sepolia-1)
    bytes32 constant DON_ID = 0x66756e2d626173652d7365706f6c69612d310000000000000000000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy TrendeFunctionsConsumer (Data Fetcher)
        TrendeFunctionsConsumer consumer = new TrendeFunctionsConsumer(ROUTER_BASE_SEPOLIA);
        console2.log("TrendeFunctionsConsumer deployed at:", address(consumer));

        // 2. Deploy TrendeOracle (Market Logic)
        // Note: Subscription ID needs to be set after deployment or passed via env if pre-created
        uint64 subId = uint64(vm.envOr("CHAINLINK_SUBSCRIPTION_ID", uint256(0)));
        TrendeOracle oracle = new TrendeOracle(ROUTER_BASE_SEPOLIA, subId, DON_ID);
        console2.log("TrendeOracle deployed at:", address(oracle));

        vm.stopBroadcast();
        
        // Output for .env update
        console2.log("--- UPDATE .ENV ---");
        console2.log("NEXT_PUBLIC_TRENDE_ORACLE_ADDRESS=");
        console2.log(address(oracle));
        console2.log("NEXT_PUBLIC_TRENDE_CONSUMER_ADDRESS=");
        console2.log(address(consumer));
    }
}
