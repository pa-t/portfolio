import {deployments, getNamedAccounts, ethers} from 'hardhat';
import {parseEther} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';
import {ArgumentConfig, parse} from 'ts-command-line-args';

import {Auction, PBDA, RugToken, SwapBuyer} from '../typechain';

import {addr, setupUser} from './utils';

import {TOKEN_NAME, AUCTION_TAG, PBDA_TAG, SWAPBUYER_TAG} from './utils/constants';

// parse command line arg to determine what method to call
interface ICommandLineArgs {
  functionName: string;
  address: string;
  tokenID?: number;
  auctionPrice?: string;
  bidAmount?: string;
  duration?: number;
}

const CommandLineArgsConfig: ArgumentConfig<ICommandLineArgs> = {
  functionName: String,
  address: String,
  tokenID: {type: Number, optional: true, defaultValue: 1},
  auctionPrice: {type: String, optional: true, defaultValue: '1'},
  bidAmount: {type: String, optional: true, defaultValue: '1'},
  duration: {type: Number, optional: true},
};

const args: ICommandLineArgs = parse<ICommandLineArgs>(CommandLineArgsConfig);

async function main() {
  await deployments.all();

  const account = await addr(args['address']);
  const {tokenOwner} = await getNamedAccounts();

  // get contracts and set up with signers
  const contracts = {
    Auction: <Auction>await ethers.getContract(AUCTION_TAG),
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    PBDA: <PBDA>await ethers.getContract(PBDA_TAG),
    SwapBuyer: <SwapBuyer>await ethers.getContract(SWAPBUYER_TAG),
  };
  const connectedAccount = await setupUser(account, contracts);
  const connectedOwner = await setupUser(tokenOwner, contracts);

  switch (args['functionName']) {
    case 'mintPBDA': {
      console.log('minting PBDA...');
      await connectedOwner.PBDA.mintDeed(connectedAccount.address);
      const numTokens = await connectedOwner.PBDA.balanceOf(account);
      const newTokenID = await connectedOwner.PBDA.tokenOfOwnerByIndex(
        account,
        numTokens.sub(1)
      );
      console.log(
        'PBDA minted to',
        account,
        'with tokenID:',
        newTokenID.toString()
      );
      break;
    }
    case 'getPBDAs': {
      console.log('getting PBDAs...');
      const numTokens = await connectedAccount.PBDA.balanceOf(account);
      console.log('account has', numTokens.toNumber(), 'PBDAs');
      const tokenIDs = [];
      for (
        let tokenIndex = BigNumber.from(0);
        tokenIndex < numTokens;
        tokenIndex = tokenIndex.add(1)
      ) {
        const tokenID = await connectedAccount.PBDA.tokenOfOwnerByIndex(
          account,
          tokenIndex
        );
        tokenIDs.push(tokenID.toNumber());
      }
      console.log('tokenIDs', tokenIDs);
      const tokenURIs = [];
      for (let tokenIndex = 0; tokenIndex < tokenIDs.length; tokenIndex++) {
        tokenURIs.push(
          await connectedAccount.PBDA.tokenURI(tokenIDs[tokenIndex])
        );
      }
      console.log('tokenURIs', tokenURIs);
      break;
    }
    case 'createTokenAuction': {
      if (
        args.tokenID !== undefined &&
        args.auctionPrice !== undefined &&
        args.duration !== undefined
      ) {
        console.log('approving PBDA...');
        await connectedAccount.PBDA.approve(
          contracts.Auction.address,
          args.tokenID
        );
        console.log('creating auction...');
        const createAuctionReceipt =
          await connectedAccount.Auction.createTokenAuction(
            contracts.PBDA.address,
            args.tokenID,
            parseEther(args.auctionPrice),
            args.duration
          );
        await createAuctionReceipt.wait(1);
        console.log(createAuctionReceipt);
      } else {
        console.error(
          "missing required arg for this function: \n[ 'tokenID', 'auctionPrice', 'duration' ]"
        );
      }
      break;
    }
    case 'bid': {
      if (args.tokenID !== undefined && args.bidAmount !== undefined) {
        console.log('bidding on auction...');
        const bidReceipt = await connectedAccount.Auction.bid(
          contracts.PBDA.address,
          args.tokenID,
          {
            value: parseEther(args.bidAmount),
          }
        );
        console.log(bidReceipt);
      } else {
        console.error(
          "missing required arg for this function: \n[ 'tokenID', 'bidAmount' ]"
        );
      }
      break;
    }
    case 'executeSale': {
      if (args.tokenID !== undefined) {
        console.log('executing sale...');
        const executeSaleReceipt = await connectedAccount.Auction.executeSale(
          contracts.PBDA.address,
          args.tokenID
        );
        await executeSaleReceipt.wait(1);
        console.log('sale executed!');
      }
      break;
    }
    case 'cancelAuction': {
      if (args.tokenID !== undefined) {
        console.log('canceling sale...');
        const cancelingReceipt = await connectedAccount.Auction.cancelAuction(
          contracts.PBDA.address,
          args.tokenID
        );
        await cancelingReceipt.wait(1);
        console.log('auction canceled!');
      } else {
        console.error(
          "missing required arg for this function: \n[ 'tokenID' ]"
        );
      }
      break;
    }
    case 'getTokenAuctionDetails': {
      if (args.tokenID !== undefined) {
        console.log('getting Auction details...');
        const endReceipt =
          await connectedAccount.Auction.getTokenAuctionDetails(
            contracts.PBDA.address,
            args['tokenID']
          );
        console.log(endReceipt);
      } else {
        console.error(
          "missing required arg for this function: \n[ 'tokenID' ]"
        );
      }
      break;
    }
    case 'setFeeAddress': {
      console.log('setting fee address...');
      const setFeeReceipt = await connectedOwner.Auction.setFeeRecipient(
        contracts.SwapBuyer.address
      );
      console.log(setFeeReceipt);
      break;
    }
    default: {
      console.log('Skipped, please pass in one of:');
      console.log(
        ' [ createTokenAuction, bid, executeSale, cancelAuction, getTokenAuctionDetails, setFeeAddress ]'
      );
      break;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
