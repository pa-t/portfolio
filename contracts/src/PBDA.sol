// contracts/PBDA.sol
// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract PBDA is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Item status indicating physical item's state
    enum ItemStatus {CUSTODIED, UNDER_REDEMPTION, REDEEMED, UNDER_REINTEGRATION}

    // Mapping from token ID to item status
    mapping(uint256 => ItemStatus) private _pdbaStatus;

    event ItemStatusChanged(uint256 tokenId, ItemStatus status);
    event MetadataURIChanged(string newURI);

    constructor(address newOwner, string memory baseURI) public ERC721("PhysicallyBackedDigitalAsset", "PBDA") {
        transferOwnership(newOwner);
        require(owner() == newOwner, "Ownership not transferred");
        _setBaseURI(baseURI);
    }

    /**
        Modify metadata server URI
    */
    function setMetadataURI(string memory baseURI_) external onlyOwner {
        _setBaseURI(baseURI_);
        emit MetadataURIChanged(baseURI_);
    }

    /**
        Set status of the physical item, used by custodian
     */
    function getStatus(uint256 tokenId) external view returns (ItemStatus) {
        require(_exists(tokenId), "tokenId does not exist");
        return _pdbaStatus[tokenId];
    }

    function setStatus(uint256 tokenId, ItemStatus status) external onlyOwner {
        _pdbaStatus[tokenId] = status;
        emit ItemStatusChanged(tokenId, _pdbaStatus[tokenId]);
    }

    /**
        Mint PBDA
     */
    function mintDeed(address deedOwner) external onlyOwner returns (uint256) {
        _tokenIds.increment();

        uint256 tokenId = _tokenIds.current();
        _safeMint(deedOwner, tokenId);
        _pdbaStatus[tokenId] = ItemStatus.CUSTODIED;

        return tokenId;
    }
}
