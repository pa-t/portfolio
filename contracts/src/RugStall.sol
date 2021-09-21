// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ERC20Rug.sol";

// Blatant fork of Sushiswap's Sushibar contract!
// This contract handles swapping to and from xRUG, The Bazaar's staking token.
contract RugStall is ERC20("RugStall", "xRUG") {
    using SafeMath for uint256;
    using SafeERC20 for ERC20Rug;

    ERC20Rug public rugToken;

    event EnterRugStall(address user, uint256 amount);
    event ExitRugStall(address user, uint256 amount);

    // Define the Rug token contract
    constructor(ERC20Rug _rugToken) public {
        rugToken = _rugToken;
    }

    // Enter the bar. Pay some RUG.
    // Locks RUG and mints xRUG
    function enter(uint256 _amount) public {
        // Gets the amount of Rug locked in the contract
        uint256 totalRugToken = rugToken.balanceOf(address(this));
        // Gets the amount of xRug in existence
        uint256 totalStaked = totalSupply();
        // If no xRug exists, mint it 1:1 to the amount put in
        if (totalStaked == 0 || totalRugToken == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xRug the Rug is worth. The ratio will change overtime, as xRug is burned/minted and Rug deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalStaked).div(totalRugToken);
            _mint(msg.sender, what);
        }
        // Lock the Rug in the contract
        rugToken.transferFrom(msg.sender, address(this), _amount);
        emit EnterRugStall(msg.sender, _amount);
    }

    // Leave the stall. Claim back your RUG.
    // Unlocks the staked + gained RUG and burns xRUG
    function leave(uint256 _staked) public {
        // Gets the amount of xRUG in existence
        uint256 totalStaked = totalSupply();
        // Calculates the amount of RUG the xRUG is worth
        uint256 what = _staked.mul(rugToken.balanceOf(address(this))).div(totalStaked);
        _burn(msg.sender, _staked);
        rugToken.transfer(msg.sender, what);
        emit ExitRugStall(msg.sender, _staked);
    }

    receive() external payable {}
}
