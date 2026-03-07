// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console2} from "forge-std/Test.sol";
import {TrendeOracle} from "../src/TrendeOracle.sol";

/// @notice Minimal mock router that implements sendRequest and routes fulfillment back.
contract MockFunctionsRouter {
    bytes32 private _nextRequestId;
    uint256 private _nonce;

    function sendRequest(
        uint64, /* subscriptionId */
        bytes calldata, /* data */
        uint16, /* dataVersion */
        uint32, /* callbackGasLimit */
        bytes32 /* donId */
    ) external returns (bytes32) {
        _nonce++;
        _nextRequestId = keccak256(abi.encodePacked(_nonce, msg.sender));
        return _nextRequestId;
    }

    function lastRequestId() external view returns (bytes32) {
        return _nextRequestId;
    }

    /// @dev Simulate DON callback — calls handleOracleFulfillment on the client.
    function fulfill(address client, bytes32 requestId, bytes memory response, bytes memory err) external {
        (bool ok,) = client.call(
            abi.encodeWithSignature(
                "handleOracleFulfillment(bytes32,bytes,bytes)",
                requestId, response, err
            )
        );
        require(ok, "fulfill call failed");
    }
}

contract TrendeOracleTest is Test {
    TrendeOracle oracle;
    MockFunctionsRouter router;
    address owner = address(this);

    function setUp() public {
        router = new MockFunctionsRouter();
        oracle = new TrendeOracle(address(router), 558, bytes32("testdon"));
    }

    // ── Market Creation ─────────────────────────────────────────────

    function test_createMarket() public {
        bytes32 marketId = oracle.createMarket("Bitcoin sentiment", 1 hours);
        assertTrue(marketId != bytes32(0), "marketId should be non-zero");

        (bytes32 id, string memory topic, uint256 endTime, bool resolved, uint256 score, string memory summary) =
            oracle.markets(marketId);
        assertEq(id, marketId);
        assertEq(topic, "Bitcoin sentiment");
        assertGt(endTime, block.timestamp);
        assertFalse(resolved);
        assertEq(score, 0);
        assertEq(bytes(summary).length, 0);
    }

    function test_createMarket_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit TrendeOracle.MarketCreated(bytes32(0), "Ethereum DeFi", block.timestamp + 2 hours);
        oracle.createMarket("Ethereum DeFi", 2 hours);
    }

    function test_createMarket_onlyOwner() public {
        vm.prank(address(0xdead));
        vm.expectRevert();
        oracle.createMarket("Should fail", 1 hours);
    }

    function test_marketIds_tracked() public {
        oracle.createMarket("Topic A", 1 hours);
        oracle.createMarket("Topic B", 2 hours);

        bytes32 idA = oracle.marketIds(0);
        bytes32 idB = oracle.marketIds(1);
        assertTrue(idA != idB, "market IDs should be unique");
    }

    // ── Market Resolution via Chainlink Functions ───────────────────

    function test_resolveMarket_sendsRequest() public {
        bytes32 marketId = oracle.createMarket("AI agents", 1 hours);
        bytes32 requestId = oracle.resolveMarket(marketId, "return '75|Bullish consensus'", "");
        assertTrue(requestId != bytes32(0));
        assertEq(oracle.s_lastRequestId(), requestId);
        assertEq(oracle.requestToMarket(requestId), marketId);
    }

    function test_resolveMarket_cannotResolveAlreadyResolved() public {
        bytes32 marketId = oracle.createMarket("Test", 1 hours);
        oracle.resolveMarket(marketId, "src", "");

        // Simulate fulfillment
        bytes32 reqId = oracle.s_lastRequestId();
        router.fulfill(address(oracle), reqId, bytes("75|Strong signal"), "");

        // Try to resolve again — should revert
        vm.expectRevert("Market already resolved");
        oracle.resolveMarket(marketId, "src", "");
    }

    function test_fulfillment_updatesMarket() public {
        bytes32 marketId = oracle.createMarket("Solana memecoins", 1 hours);
        oracle.resolveMarket(marketId, "src", "");
        bytes32 reqId = oracle.s_lastRequestId();

        router.fulfill(address(oracle), reqId, bytes("82|High social momentum"), "");

        (, , , bool resolved, uint256 score, string memory summary) = oracle.markets(marketId);
        assertTrue(resolved);
        assertEq(score, 82);
        assertEq(summary, "High social momentum");
    }

    function test_fulfillment_emitsEvent() public {
        bytes32 marketId = oracle.createMarket("Base ecosystem", 1 hours);
        oracle.resolveMarket(marketId, "src", "");
        bytes32 reqId = oracle.s_lastRequestId();

        vm.expectEmit(true, false, false, true);
        emit TrendeOracle.MarketResolved(marketId, 65, "Moderate interest");
        router.fulfill(address(oracle), reqId, bytes("65|Moderate interest"), "");
    }

    function test_fulfillment_withError_doesNotResolve() public {
        bytes32 marketId = oracle.createMarket("Error test", 1 hours);
        oracle.resolveMarket(marketId, "src", "");
        bytes32 reqId = oracle.s_lastRequestId();

        // Fulfill with an error
        router.fulfill(address(oracle), reqId, "", bytes("API timeout"));

        (, , , bool resolved, uint256 score,) = oracle.markets(marketId);
        assertFalse(resolved);
        assertEq(score, 0);
    }

    // ── splitResponse edge cases ────────────────────────────────────

    function test_fulfillment_scoreOnly() public {
        bytes32 marketId = oracle.createMarket("Score only", 1 hours);
        oracle.resolveMarket(marketId, "src", "");
        bytes32 reqId = oracle.s_lastRequestId();

        // No pipe separator — score should be 0, entire string becomes summary
        router.fulfill(address(oracle), reqId, bytes("noseparator"), "");

        (, , , bool resolved, uint256 score, string memory summary) = oracle.markets(marketId);
        assertTrue(resolved);
        assertEq(score, 0);
        assertEq(summary, "noseparator");
    }

    function test_fulfillment_zeroScore() public {
        bytes32 marketId = oracle.createMarket("Zero score", 1 hours);
        oracle.resolveMarket(marketId, "src", "");
        bytes32 reqId = oracle.s_lastRequestId();

        router.fulfill(address(oracle), reqId, bytes("0|No signal detected"), "");

        (, , , bool resolved, uint256 score, string memory summary) = oracle.markets(marketId);
        assertTrue(resolved);
        assertEq(score, 0);
        assertEq(summary, "No signal detected");
    }
}
