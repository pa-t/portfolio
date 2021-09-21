import {ethers, deployments} from 'hardhat';
import {
  Auction,
  BondingCurvePhaseOne,
  PBDA,
  RugStall,
  RugToken,
  SwapBuyer,
} from '../typechain';
import {
  AUCTION_TAG,
  BCPO_TAG,
  PBDA_TAG,
  STAKING_TAG,
  TOKEN_NAME,
  SWAPBUYER_TAG,
} from './utils/constants';

async function main() {
  await deployments.all();
  const contracts = {
    Auction: <Auction>await ethers.getContract(AUCTION_TAG),
    BondingCurvePhaseOne: <BondingCurvePhaseOne>await ethers.getContract(BCPO_TAG),
    PBDA: <PBDA>await ethers.getContract(PBDA_TAG),
    RugStall: <RugStall>await ethers.getContract(STAKING_TAG),
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    SwapBuyer: <SwapBuyer>await ethers.getContract(SWAPBUYER_TAG),
  };


  // **************
  //    Auction
  // **************
  contracts.Auction.on("AuctionCreated", async (seller, nft, tokenId, duration, price) => {
    console.log(`AUCTION CONTRACT -> AuctionCreated: ${seller} listed tokenID ${tokenId} for ${ethers.utils.formatEther(price)} ETH for ${duration} seconds`);
  });

  contracts.Auction.on("Bid", async (bidder, nft, tokenId, bidAmount) => {
    console.log(`AUCTION CONTRACT -> Bid: ${bidder} placed bid on tokenID ${tokenId} for ${ethers.utils.formatEther(bidAmount)} ETH`);
  });

  contracts.Auction.on("SaleExecuted", async (seller, bidder, nft, tokenId, bidAmount) => {
    console.log(`AUCTION CONTRACT -> SaleExecuted: ${bidder} won tokenID ${tokenId} for ${ethers.utils.formatEther(bidAmount)} ETH from ${seller}`);
  });

  contracts.Auction.on("AuctionCanceled", async (seller, nft, tokenId) => {
    console.log(`AUCTION CONTRACT -> AuctionCanceled: ${seller} canceled auction for tokenID ${tokenId}`);
  });


  // **************
  //    BCPO
  // **************
  contracts.BondingCurvePhaseOne.on("Start", async (account) => {
    console.log(`BCPO -> Start: ${account}`);
  });

  contracts.BondingCurvePhaseOne.on("Pause", async (account) => {
    console.log(`BCPO -> Pause: ${account}`);
  });

  contracts.BondingCurvePhaseOne.on("End", async (account) => {
    console.log(`BCPO -> End: ${account}`);
  });

  contracts.BondingCurvePhaseOne.on("Bought", async (account, amount) => {
    console.log(`BCPO -> Bought: ${account} bought ${ethers.utils.formatEther(amount)}`);
  });

  contracts.BondingCurvePhaseOne.on("Withdraw", async (account, amount) => {
    console.log(`BCPO -> Withdraw: ${account} withdrew ${ethers.utils.formatEther(amount)}`);
  });

  contracts.BondingCurvePhaseOne.on("Burn", async (account, amount) => {
    console.log(`BCPO -> Burn: ${account} burned ${ethers.utils.formatEther(amount)}`);
  });


  // **************
  //    PBDA
  // **************
  contracts.PBDA.on("ItemStatusChanged", async (tokenId, status) => {
    console.log(`PBDA -> ItemStatusChanged: ${tokenId} status updated to ${status}`);
  });

  contracts.PBDA.on("MetadataURIChanged", async (newURI) => {
    console.log(`PBDA -> MetadataURIChanged: ${newURI}`);
  });


  // **************
  //    RUG
  // **************
  contracts.RugToken.on("Burn", async (accountFrom, accountTo, amount) => {
    console.log(`RugToken -> Burn: ${accountFrom} burned ${ethers.utils.formatEther(amount)} RUG to ${accountTo}`);
  });


  // **************
  //    RugStall
  // **************
  contracts.RugStall.on("EnterRugStall", async (user, amount) => {
    console.log(`RugStall -> EnterRugStall: ${user} entered RugStall with ${ethers.utils.formatEther(amount)} RUG`);
  });

  contracts.RugStall.on("ExitRugStall", async (user, amount) => {
    console.log(`RugStall -> ExitRugStall: ${user} exited RugStall with ${ethers.utils.formatEther(amount)} xRUG`);
  });


  // **************
  //   SwapBuyer
  // **************
  contracts.SwapBuyer.on("BoughtFromSwap", async (amount) => {
    console.log(`SwapBuyer -> BoughtFromSwap: ${ethers.utils.formatEther(amount)} ETH`);
  });

  contracts.SwapBuyer.on("SentToRugStall", async (amount) => {
    console.log(`SwapBuyer -> SentToRugStall: ${ethers.utils.formatEther(amount)} RUG`);
  });
};


main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
