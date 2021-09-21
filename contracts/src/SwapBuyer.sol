// contracts/auction/SwapBuyer.sol
// SPDX-License-Identifier: MIT
// written by pa-t

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./ERC20Rug.sol";
import "./BondingCurvePhaseOne.sol";
import "./RugStall.sol";

contract SwapBuyer is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20Rug;

    ERC20Rug public rugToken;
    BondingCurvePhaseOne public bc;
    RugStall public rs;

	event BoughtFromSwap(uint256 amount);
    event SentToRugStall(uint256 amount);

    constructor(
        ERC20Rug _token,
        BondingCurvePhaseOne _bc,
        RugStall _rs
    ) public {
        rugToken = _token;
        bc = _bc;
        rs = _rs;
    }

    // buy RUG from swap with available balance
    function buyFromSwap() public onlyOwner {
        // shave some off for gas
        uint256 amount = (address(this).balance * 99) / 100;

        // buy from curve
        address(bc).call{value: amount}(abi.encodeWithSignature("buy()"));
		emit BoughtFromSwap(amount);

        // send rug to rugstall
        uint256 rugBalance = rugToken.balanceOf(address(this));
        rugToken.transfer(address(rs), rugBalance);
        emit SentToRugStall(rugBalance);
    }

    receive() external payable {
        // shave some off for gas
        uint256 amount = (msg.value * 99) / 100;
        // instead of using the msg.value, could use the balance
        //
        // uint256 amount = (address(this).balance * 99) / 100;
        //
        // then check if the amount is over some threshold so small
        // amounts are eaten up by gas fees
        //
        // if(amount > 0.2 ether) {...}
        //

        // buy from curve
        address(bc).call{value: amount}(abi.encodeWithSignature("buy()"));
		emit BoughtFromSwap(amount);

        // send rug to rugstall
        uint256 rugBalance = rugToken.balanceOf(address(this));
        rugToken.transfer(address(rs), rugBalance);
        emit SentToRugStall(rugBalance);
    }
}
