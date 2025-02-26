// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SafeTxDataBuilder} from "./SafeTxDataBuilder.sol";
import "forge-std/Script.sol";

contract GetSafeDetails is SafeTxDataBuilder {
    function run() public {
        // Get Safe owners and threshold
        address[] memory owners = SAFE.getOwners();
        uint256 threshold = SAFE.getThreshold();

        // Create JSON object with Safe details
        string memory jsonOutput = "{";
        jsonOutput = string.concat(
            jsonOutput,
            '"threshold":',
            vm.toString(threshold),
            ","
        );
        jsonOutput = string.concat(jsonOutput, '"owners":[');

        for (uint256 i = 0; i < owners.length; i++) {
            jsonOutput = string.concat(
                jsonOutput,
                '"',
                vm.toString(owners[i]),
                '"'
            );
            if (i < owners.length - 1) {
                jsonOutput = string.concat(jsonOutput, ",");
            }
        }

        jsonOutput = string.concat(jsonOutput, "]}");

        // Write to file
        vm.writeFile(
            string.concat(SIGNATURES_DIR, "safeDetails.json"),
            jsonOutput
        );
    }
}
