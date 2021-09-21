// contracts/auction/Auction.sol
// SPDX-License-Identifier: MIT
// adapted by pa-t

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../ERC20Rug.sol";
import "../PBDA.sol";

contract Auction is IERC721Receiver, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20Rug;

    ERC20Rug public rugToken;
    address public feeRecipient;
    uint256 public feePercent;
    uint256 public constant feeBase = 100;
    bool public canCreate = true;

    event AuctionCreated(address seller, address nft, uint256 tokenId, uint256 duration, uint128 price);
    event Bid(address bidder, address nft, uint256 tokenId, uint256 bidAmount);
    event SaleExecuted(address seller, address bidder, address nft, uint256 tokenId, uint256 bidAmount);
    event AuctionCanceled(address seller, address nft, uint256 tokenId);

    struct tokenDetails {
        PBDA nft;
        address seller;
        uint128 price;
        uint256 duration;
        uint256 maxBid;
        address maxBidUser;
        bool isActive;
        uint256[] bidAmounts;
        address[] users;
    }

    mapping(address => mapping(uint256 => tokenDetails)) public tokenToAuction;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public bids;

    constructor(
        ERC20Rug _token,
        address _feeRecipient,
        uint256 _feePercent,
        address newOwner
    ) {
        transferOwnership(newOwner);
        require(owner() == newOwner, "Ownership not transferred");
        rugToken = _token;
        feeRecipient = _feeRecipient;
        feePercent = _feePercent;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    /**
       Seller puts the item on auction
    */
    function createTokenAuction(
        PBDA _nft,
        uint256 _tokenId,
        uint128 _price,
        uint256 _duration
    ) external {
        require(msg.sender != address(0), "Invalid Address");
        require(address(_nft) != address(0), "Invalid Account");
        require(_price > 0, "Price should be more than 0");
        require(_duration > 0, "Invalid duration value");
        require(canCreate, "Auction creation disabled");
        tokenDetails memory _auction =
            tokenDetails({
                nft: _nft,
                seller: msg.sender,
                price: uint128(_price),
                duration: block.timestamp + _duration,
                maxBid: 0,
                maxBidUser: address(0),
                isActive: true,
                bidAmounts: new uint256[](0),
                users: new address[](0)
            });
        address owner = msg.sender;
        require(
            _nft.getStatus(_tokenId) == PBDA.ItemStatus.CUSTODIED,
            "PBDA not in custodial ownership, cannot create auction."
        );
        ERC721(_nft).safeTransferFrom(owner, address(this), _tokenId);
        tokenToAuction[address(_nft)][_tokenId] = _auction;
        emit AuctionCreated(owner, address(_nft), _tokenId, _duration, uint128(_price));
    }

    /**
       Users bid for a particular nft, the max bid is compared and set if the current bid id highest
    */
    function bid(address _nft, uint256 _tokenId) external payable {
        tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
        require(msg.value >= auction.price, "Bid price is less than current price");
        require(auction.isActive, "Auction not active");
        require(auction.duration > block.timestamp, "Deadline already passed");
        if (bids[_nft][_tokenId][msg.sender] > 0) {
            (bool success, ) = msg.sender.call{value: bids[_nft][_tokenId][msg.sender]}("");
            require(success, "Bid not successful.");
        }
        bids[_nft][_tokenId][msg.sender] = msg.value;
        if (auction.bidAmounts.length == 0) {
            auction.maxBid = msg.value;
            auction.maxBidUser = msg.sender;
        } else {
            uint256 lastIndex = auction.bidAmounts.length - 1;
            require(auction.bidAmounts[lastIndex] < msg.value, "Current max bid is higher than your bid");
            auction.maxBid = msg.value;
            auction.maxBidUser = msg.sender;
        }
        auction.users.push(msg.sender);
        auction.bidAmounts.push(msg.value);
        emit Bid(msg.sender, _nft, _tokenId, uint256(msg.value));
    }

    /**
       Called by the seller when the auction duration is over the hightest bid user get's the nft and other bidders get eth back
    */
    function executeSale(address _nft, uint256 _tokenId) external {
        tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
        require(auction.duration <= block.timestamp, "Deadline did not pass yet");
        require(auction.seller == msg.sender, "Not seller");
        require(auction.isActive, "Auction not active");
        auction.isActive = false;
        if (auction.bidAmounts.length == 0) {
            ERC721(_nft).safeTransferFrom(address(this), auction.seller, _tokenId);
            emit SaleExecuted(auction.seller, auction.seller, _nft, _tokenId, auction.maxBid);
        } else {
            uint256 feeAmountToSend = (auction.maxBid * feePercent) / feeBase;
            uint256 sellerAmount = auction.maxBid - feeAmountToSend;
            (bool feeSuccess, ) = feeRecipient.call{value: feeAmountToSend}("");
            require(feeSuccess, "Fee not sent to fee address.");
            (bool success, ) = auction.seller.call{value: sellerAmount}("");
            require(success, "Winnings not sent to seller.");
            for (uint256 i = 0; i < auction.users.length; i++) {
                if (auction.users[i] != auction.maxBidUser) {
                    (success, ) = auction.users[i].call{value: bids[_nft][_tokenId][auction.users[i]]}("");
                    require(success, "Refunds not sent to participants.");
                }
            }
            ERC721(_nft).safeTransferFrom(address(this), auction.maxBidUser, _tokenId);
            emit SaleExecuted(auction.seller, auction.maxBidUser, _nft, _tokenId, auction.maxBid);
            for (uint256 i = 0; i < auction.users.length; i++) {
                delete bids[_nft][_tokenId][auction.users[i]];
            }
            delete tokenToAuction[_nft][_tokenId];
        }
    }

    /**
       Called by the seller if they want to cancel the auction for their nft so the bidders get back the locked eth and the seller get's back the nft
    */
    function cancelAuction(address _nft, uint256 _tokenId) external {
        tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
        require(auction.seller == msg.sender, "Not seller");
        require(auction.isActive, "Auction not active");
        auction.isActive = false;
        bool success;
        for (uint256 i = 0; i < auction.users.length; i++) {
            (success, ) = auction.users[i].call{value: bids[_nft][_tokenId][auction.users[i]]}("");
            require(success, "Auction cancel not successful");
        }
        ERC721(_nft).safeTransferFrom(address(this), auction.seller, _tokenId);
        emit AuctionCanceled(auction.seller, _nft, _tokenId);
        for (uint256 i = 0; i < auction.users.length; i++) {
            delete bids[_nft][_tokenId][auction.users[i]];
        }
        delete tokenToAuction[_nft][_tokenId];
    }

    /**
        Retrieves token auction details
     */
    function getTokenAuctionDetails(address _nft, uint256 _tokenId)
        public
        view
        returns (
            address seller,
            uint128 price,
            uint256 duration,
            address maxBidUser,
            uint256 maxBid,
            bool isActive
        )
    {
        // add check if index exists
        tokenDetails memory auction = tokenToAuction[_nft][_tokenId];
        return (auction.seller, auction.price, auction.duration, auction.maxBidUser, auction.maxBid, auction.isActive);
    }

    function setAuctionCreationToggle(bool status) external onlyOwner {
        canCreate = status;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    receive() external payable {}
}
