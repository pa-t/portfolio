import {expect} from './chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';

import {parseEther} from 'ethers/lib/utils';

import {Auction, RugToken, PBDA} from '../typechain';
import {setupUser, setupUsers, calcGas, calcRugFee} from './utils';

import {
  TOKEN_NAME,
  PBDA_TAG,
  AUCTION_TAG,
  AUCTION_FEE,
} from '../scripts/utils/constants';
import {BigNumber, BigNumberish} from '@ethersproject/bignumber';

const enum ItemStatus {
  CUSTODIED,
  UNDER_REDEMPTION,
  REDEEMED,
  UNDER_REINTEGRATION,
}

const setup = deployments.createFixture(async () => {
  await deployments.fixture([TOKEN_NAME, AUCTION_TAG, PBDA_TAG]);
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    Auction: <Auction>await ethers.getContract(AUCTION_TAG),
    PBDA: <PBDA>await ethers.getContract(PBDA_TAG),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  const {deployer, tokenOwner} = await getNamedAccounts();
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
    tokenOwner: await setupUser(tokenOwner, contracts),
  };
});

async function setup_auction(amount: BigNumber, duration: BigNumberish) {
  const {RugToken, Auction, PBDA, users, deployer, tokenOwner} = await setup();

  // mint PBDA to specified user address
  await tokenOwner.PBDA.mintDeed(users[0].address);

  // hacky work around until PBDA contract fixed
  // only one pbda will exist at this point, grab the 0th one
  const newPBDAID = await PBDA.tokenByIndex(0);

  // approve transfer of PBDA from users[0] to Auction contract
  await users[0].PBDA.approve(Auction.address, newPBDAID);

  // create the auction of the PBDA
  await users[0].Auction.createTokenAuction(
    PBDA.address,
    newPBDAID,
    amount,
    duration
  );

  return {
    RugToken,
    Auction,
    PBDA,
    users,
    deployer,
    tokenOwner,
    newPBDAID,
  };
}

describe('Auction initialized', function () {
  it('Auction should be created with correct values', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // check feeRecipient set correctly
    expect(await Auction.feeRecipient()).to.be.equal(tokenOwner.address);

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);

    // hacky work around until PBDA contract fixed
    // only one pbda will exist at this point, grab the 0th one
    const newPBDAID = await PBDA.tokenByIndex(0);

    // check users[0] has one and only one PBDA
    expect(await PBDA.balanceOf(users[0].address)).to.be.equal(
      BigNumber.from(1)
    );

    // approve transfer of PBDA from users[0] to Auction contract
    await users[0].PBDA.approve(Auction.address, newPBDAID);

    // create the auction of the PBDA
    await users[0].Auction.createTokenAuction(
      PBDA.address,
      newPBDAID,
      parseEther('0.1'),
      20
    );
    const auctionTimestamp = (await ethers.provider.getBlock('latest'))
      .timestamp;

    // retrieve auction details for newly created auction
    const auctionDetails = await Auction.getTokenAuctionDetails(
      PBDA.address,
      newPBDAID
    );

    // check auction details
    expect(auctionDetails['seller']).to.be.equal(users[0].address);
    expect(auctionDetails['price']).to.be.equal(parseEther('0.1'));
    expect(auctionDetails['duration']).to.be.equal(auctionTimestamp + 20);
    expect(auctionDetails['maxBid']).to.be.equal(0);
    expect(auctionDetails['isActive']).to.be.true;
  });

  it('Check require statements in createTokenAuction', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);

    // approve transfer of PBDA from users[0] to Auction contract
    await users[0].PBDA.approve(Auction.address, 1);

    await expect(
      users[0].Auction.createTokenAuction(
        '0x0000000000000000000000000000000000000000',
        2,
        parseEther('0'),
        0
      )
    ).to.be.revertedWith('Invalid Account');

    await expect(
      users[0].Auction.createTokenAuction(PBDA.address, 2, parseEther('0'), 0)
    ).to.be.revertedWith('Price should be more than 0');

    await expect(
      users[0].Auction.createTokenAuction(PBDA.address, 2, parseEther('1'), 0)
    ).to.be.revertedWith('Invalid duration value');

    await expect(
      users[0].Auction.createTokenAuction(PBDA.address, 2, parseEther('1'), 100)
    ).to.be.revertedWith('revert tokenId does not exist');

    // set status of PBDA
    await tokenOwner.PBDA.setStatus(1, ItemStatus.REDEEMED);

    await expect(
      users[0].Auction.createTokenAuction(PBDA.address, 1, parseEther('1'), 100)
    ).to.be.revertedWith(
      'PBDA not in custodial ownership, cannot create auction.'
    );
  });

  it('Auction should be created with correct values', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);

    // hacky work around until PBDA contract fixed
    // only one pbda will exist at this point, grab the 0th one
    const newPBDAID = await PBDA.tokenByIndex(0);

    // approve transfer of PBDA from users[0] to Auction contract
    await users[0].PBDA.approve(Auction.address, newPBDAID);

    await tokenOwner.Auction.setAuctionCreationToggle(false);

    // create the auction of the PBDA
    await expect(
      users[0].Auction.createTokenAuction(PBDA.address, newPBDAID, parseEther('1'), 100)
    ).to.be.revertedWith(
      'Auction creation disabled'
    );

    await tokenOwner.Auction.setAuctionCreationToggle(true);

    await users[0].Auction.createTokenAuction(
      PBDA.address,
      newPBDAID,
      parseEther('1'),
      100
    );
  });
});

describe('Auction sets new feeRecipient', function () {
  it('Reverts setting new fee recipient if not owner', async function () {
    const {users} = await setup();

    await expect(
      users[0].Auction.setFeeRecipient(users[0].address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Set new fee recipient', async function () {
    const {Auction, users, tokenOwner} = await setup();

    expect(await Auction.feeRecipient()).to.be.equal(tokenOwner.address);

    await tokenOwner.Auction.setFeeRecipient(users[0].address);

    expect(await Auction.feeRecipient()).to.be.equal(users[0].address);
  });
});

describe('Auction bid works as expected', function () {
  it('Check require statements in bid', async function () {
    const {Auction, PBDA, users, newPBDAID} = await setup_auction(
      parseEther('0.1'),
      20
    );

    await expect(
      users[1].Auction.bid(PBDA.address, newPBDAID, {
        value: parseEther('0.09'),
      })
    ).to.be.revertedWith('Bid price is less than current price');

    // cancel auction
    await users[0].Auction.cancelAuction(PBDA.address, newPBDAID);

    await expect(
      users[1].Auction.bid(PBDA.address, newPBDAID, {
        value: parseEther('0.11'),
      })
    ).to.be.revertedWith('Auction not active');

    // reapprove and recreate the auction of the PBDA
    await users[0].PBDA.approve(Auction.address, newPBDAID);
    await users[0].Auction.createTokenAuction(
      PBDA.address,
      newPBDAID,
      parseEther('0.1'),
      1
    );

    await expect(
      users[1].Auction.bid(PBDA.address, newPBDAID, {
        value: parseEther('0.11'),
      })
    ).to.be.revertedWith('Deadline already passed');
  });

  it('Check two bids from the same user', async function () {
    const {PBDA, users, newPBDAID} = await setup_auction(
      parseEther('0.1'),
      100
    );

    await users[1].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.2'),
    });

    await expect(
      users[1].Auction.bid(PBDA.address, newPBDAID, {
        value: parseEther('0.2'),
      })
    ).to.be.revertedWith('Current max bid is higher than your bid');

    await users[2].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.3'),
    });
  });
});

describe('Auction executeSale works as expected', function () {
  it('Check require statements in executeSale', async function () {
    const {PBDA, users, newPBDAID} = await setup_auction(parseEther('0.1'), 3);

    await users[1].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.2'),
    });

    await expect(
      users[0].Auction.executeSale(PBDA.address, newPBDAID)
    ).to.be.revertedWith('Deadline did not pass yet');

    await expect(
      users[1].Auction.executeSale(PBDA.address, newPBDAID)
    ).to.be.revertedWith('Not seller');

    // cancel auction to set isActive to false
    await users[0].Auction.cancelAuction(PBDA.address, newPBDAID);

    await expect(
      users[0].Auction.executeSale(PBDA.address, newPBDAID)
    ).to.be.revertedWith('Not seller');
  });

  it('Check executeSale returns PBDA when no bids', async function () {
    const {PBDA, users, newPBDAID} = await setup_auction(parseEther('0.1'), 1);

    expect(await PBDA.balanceOf(users[0].address)).to.be.equal(
      BigNumber.from(0)
    );

    await users[0].Auction.executeSale(PBDA.address, newPBDAID);

    expect(await PBDA.balanceOf(users[0].address)).to.be.equal(
      BigNumber.from(1)
    );
  });

  it('Check executeSale sends PBDA to victor', async function () {
    const {PBDA, users, newPBDAID} = await setup_auction(parseEther('0.1'), 3);

    // check starting balance of PBDAs
    expect(await PBDA.balanceOf(users[1].address)).to.be.equal(
      BigNumber.from(0)
    );

    expect(await PBDA.balanceOf(users[2].address)).to.be.equal(
      BigNumber.from(0)
    );

    // make bids
    await users[1].Auction.bid(PBDA.address, 1, {
      value: parseEther('0.2'),
    });

    await users[2].Auction.bid(PBDA.address, 1, {
      value: parseEther('0.3'),
    });

    // execute sale
    await users[0].Auction.executeSale(PBDA.address, newPBDAID);

    // check PBDA went to correct user
    expect(await PBDA.balanceOf(users[1].address)).to.be.equal(
      BigNumber.from(0)
    );

    expect(await PBDA.balanceOf(users[2].address)).to.be.equal(
      BigNumber.from(1)
    );
  });
});

describe('Auction cancelAuction works as expected', function () {
  it('Check require statements in cancelAuction', async function () {
    const {PBDA, users, newPBDAID} = await setup_auction(parseEther('0.1'), 3);

    await expect(
      users[1].Auction.cancelAuction(PBDA.address, newPBDAID)
    ).to.be.revertedWith('Not seller');

    await users[0].Auction.cancelAuction(PBDA.address, newPBDAID);

    await expect(
      users[0].Auction.cancelAuction(PBDA.address, newPBDAID)
    ).to.be.revertedWith('Not seller');
  });
});

describe('Auction multiple PBDAs', function () {
  it('Auctions created for multiple PBDAs', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);
    await tokenOwner.PBDA.mintDeed(users[1].address);
    await tokenOwner.PBDA.mintDeed(users[2].address);

    // approve transfer of PBDA from users to Auction contract
    await users[0].PBDA.approve(Auction.address, 1);
    await users[1].PBDA.approve(Auction.address, 2);
    await users[2].PBDA.approve(Auction.address, 3);

    // create the auctions of the PBDAs
    await users[0].Auction.createTokenAuction(
      PBDA.address,
      1,
      parseEther('0.1'),
      20
    );
    const auctionOneTimestamp = (await ethers.provider.getBlock('latest'))
      .timestamp;

    await users[1].Auction.createTokenAuction(
      PBDA.address,
      2,
      parseEther('0.5'),
      60
    );
    const auctionTwoTimestamp = (await ethers.provider.getBlock('latest'))
      .timestamp;

    await users[2].Auction.createTokenAuction(
      PBDA.address,
      3,
      parseEther('1'),
      100
    );
    const auctionThreeTimestamp = (await ethers.provider.getBlock('latest'))
      .timestamp;

    // retrieve auction details for newly created auctions
    const auctionDetailsOne = await Auction.getTokenAuctionDetails(
      PBDA.address,
      1
    );
    const auctionDetailsTwo = await Auction.getTokenAuctionDetails(
      PBDA.address,
      2
    );
    const auctionDetailsThree = await Auction.getTokenAuctionDetails(
      PBDA.address,
      3
    );

    // check auctionOne details
    expect(auctionDetailsOne['seller']).to.be.equal(users[0].address);
    expect(auctionDetailsOne['price']).to.be.equal(parseEther('0.1'));
    expect(auctionDetailsOne['duration']).to.be.equal(auctionOneTimestamp + 20);
    expect(auctionDetailsOne['maxBid']).to.be.equal(0);
    expect(auctionDetailsOne['isActive']).to.be.true;

    // check auctionTwo details
    expect(auctionDetailsTwo['seller']).to.be.equal(users[1].address);
    expect(auctionDetailsTwo['price']).to.be.equal(parseEther('0.5'));
    expect(auctionDetailsTwo['duration']).to.be.equal(auctionTwoTimestamp + 60);
    expect(auctionDetailsTwo['maxBid']).to.be.equal(0);
    expect(auctionDetailsTwo['isActive']).to.be.true;

    // check auctionThree details
    expect(auctionDetailsThree['seller']).to.be.equal(users[2].address);
    expect(auctionDetailsThree['price']).to.be.equal(parseEther('1'));
    expect(auctionDetailsThree['duration']).to.be.equal(
      auctionThreeTimestamp + 100
    );
    expect(auctionDetailsThree['maxBid']).to.be.equal(0);
    expect(auctionDetailsThree['isActive']).to.be.true;
  });

  it('Auctions for multiple PBDAs handle bids separately', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);
    await tokenOwner.PBDA.mintDeed(users[1].address);
    await tokenOwner.PBDA.mintDeed(users[2].address);

    // approve transfer of PBDA from users to Auction contract
    await users[0].PBDA.approve(Auction.address, 1);
    await users[1].PBDA.approve(Auction.address, 2);
    await users[2].PBDA.approve(Auction.address, 3);

    // create the auctions of the PBDAs
    await users[0].Auction.createTokenAuction(
      PBDA.address,
      1,
      parseEther('0.1'),
      100
    );

    await users[1].Auction.createTokenAuction(
      PBDA.address,
      2,
      parseEther('0.5'),
      150
    );

    await users[2].Auction.createTokenAuction(
      PBDA.address,
      3,
      parseEther('1'),
      200
    );

    await users[3].Auction.bid(PBDA.address, 1, {
      value: parseEther('0.2'),
    });

    await users[4].Auction.bid(PBDA.address, 2, {
      value: parseEther('0.6'),
    });

    await users[5].Auction.bid(PBDA.address, 3, {
      value: parseEther('1.1'),
    });

    // check each auction has their max bid
    const auctionDetailsOne = await Auction.getTokenAuctionDetails(
      PBDA.address,
      1
    );
    expect(auctionDetailsOne['maxBid']).to.be.equal(parseEther('0.2'));
    const auctionDetailsTwo = await Auction.getTokenAuctionDetails(
      PBDA.address,
      2
    );
    expect(auctionDetailsTwo['maxBid']).to.be.equal(parseEther('0.6'));
    const auctionDetailsThree = await Auction.getTokenAuctionDetails(
      PBDA.address,
      3
    );
    expect(auctionDetailsThree['maxBid']).to.be.equal(parseEther('1.1'));
  });

  it('Auctions sends correct PBDA to correct user', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);
    await tokenOwner.PBDA.mintDeed(users[1].address);
    await tokenOwner.PBDA.mintDeed(users[2].address);

    // approve transfer of PBDA from users to Auction contract
    await users[0].PBDA.approve(Auction.address, 1);
    await users[1].PBDA.approve(Auction.address, 2);
    await users[2].PBDA.approve(Auction.address, 3);

    // create auction and bid
    await users[0].Auction.createTokenAuction(
      PBDA.address,
      1,
      parseEther('0.1'),
      4
    );

    await users[3].Auction.bid(PBDA.address, 1, {
      value: parseEther('0.2'),
    });

    // create auction and bid
    await users[1].Auction.createTokenAuction(
      PBDA.address,
      2,
      parseEther('0.5'),
      4
    );

    await users[4].Auction.bid(PBDA.address, 2, {
      value: parseEther('0.6'),
    });

    // create auction and bid
    await users[2].Auction.createTokenAuction(
      PBDA.address,
      3,
      parseEther('1'),
      4
    );

    await users[5].Auction.bid(PBDA.address, 3, {
      value: parseEther('1.1'),
    });

    // execute auctions
    await users[0].Auction.executeSale(PBDA.address, 1);
    await users[1].Auction.executeSale(PBDA.address, 2);
    await users[2].Auction.executeSale(PBDA.address, 3);

    // check ownership of PBDAs
    expect(await PBDA.ownerOf(1)).to.be.equal(users[3].address);
    expect(await PBDA.ownerOf(2)).to.be.equal(users[4].address);
    expect(await PBDA.ownerOf(3)).to.be.equal(users[5].address);
  });
});

describe('Auction handles ETH bids as expected', function () {
  it('Auction should hold ETH from all participants', async function () {
    const {Auction, PBDA, users, newPBDAID} = await setup_auction(
      parseEther('0.1'),
      4
    );

    // user one makes a bid
    const auctionPreBalanceOne = await ethers.provider.getBalance(
      Auction.address
    );
    await users[1].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.2'),
    });
    const auctionPostBalanceOne = await ethers.provider.getBalance(
      Auction.address
    );

    // user two makes a bid
    await users[2].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.6'),
    });
    const auctionPostBalanceTwo = await ethers.provider.getBalance(
      Auction.address
    );

    // user three makes a bid
    await users[3].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('1.1'),
    });
    const auctionPostBalanceThree = await ethers.provider.getBalance(
      Auction.address
    );

    expect(auctionPostBalanceOne.sub(auctionPreBalanceOne)).to.be.equal(
      parseEther('0.2')
    );
    expect(auctionPostBalanceTwo.sub(auctionPreBalanceOne)).to.be.equal(
      parseEther('0.8')
    );
    expect(auctionPostBalanceThree.sub(auctionPreBalanceOne)).to.be.equal(
      parseEther('1.9')
    );
  });

  // skipping on coverage because of gasCalculation
  it('Auction should send ETH back to participants [ @skip-on-coverage ]', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    /**
     * Initialize one auction to test if auction
     * contract keeps ETH balances separate between
     * multiple auctions
     */
    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[6].address);

    // hacky work around until PBDA contract fixed
    // only one pbda will exist at this point, grab the 0th one
    const newPBDAIDSix = await PBDA.tokenByIndex(0);

    // approve transfer of PBDA from users[0] to Auction contract
    await users[6].PBDA.approve(Auction.address, newPBDAIDSix);

    // create the auction of the PBDA
    await users[6].Auction.createTokenAuction(
      PBDA.address,
      newPBDAIDSix,
      parseEther('0.1'),
      4
    );

    const userSixPreBalance = await ethers.provider.getBalance(
      users[6].address
    );

    await users[7].Auction.bid(PBDA.address, newPBDAIDSix, {
      value: parseEther('10'),
    });

    /**
     * Initialize other auction
     */
    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);

    // hacky work around until PBDA contract fixed
    const newPBDAID = await PBDA.tokenByIndex(1);

    // approve transfer of PBDA from users[0] to Auction contract
    await users[0].PBDA.approve(Auction.address, newPBDAID);

    // create the auction of the PBDA
    await users[0].Auction.createTokenAuction(
      PBDA.address,
      newPBDAID,
      parseEther('0.1'),
      4
    );

    const userZeroPreBalance = await ethers.provider.getBalance(
      users[0].address
    );

    // user one makes a bid
    const userOnePreBalance = await ethers.provider.getBalance(
      users[1].address
    );
    const userOneTx = await users[1].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.2'),
    });
    const userOnePostBuyBalance = await ethers.provider.getBalance(
      users[1].address
    );

    // user two makes a bid
    const userTwoPreBalance = await ethers.provider.getBalance(
      users[2].address
    );
    const userTwoTx = await users[2].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.6'),
    });
    const userTwoPostBuyBalance = await ethers.provider.getBalance(
      users[2].address
    );

    // user three makes a bid
    const userThreePreBalance = await ethers.provider.getBalance(
      users[3].address
    );
    const userThreeTx = await users[3].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('1.1'),
    });
    const userThreePostBuyBalance = await ethers.provider.getBalance(
      users[3].address
    );

    // all bidders are charged correct amount of ETH
    expect(userOnePreBalance).to.be.equal(
      userOnePostBuyBalance.add(
        (await calcGas(userOneTx)).add(parseEther('0.2'))
      )
    );

    expect(userTwoPreBalance).to.be.equal(
      userTwoPostBuyBalance.add(
        (await calcGas(userTwoTx)).add(parseEther('0.6'))
      )
    );

    expect(userThreePreBalance).to.be.equal(
      userThreePostBuyBalance.add(
        (await calcGas(userThreeTx)).add(parseEther('1.1'))
      )
    );

    // execute sale
    const saleTx = await users[0].Auction.executeSale(PBDA.address, newPBDAID);

    // get post sale balances
    const userZeroPostBalance = await ethers.provider.getBalance(
      users[0].address
    );
    const userOnePostSaleBalance = await ethers.provider.getBalance(
      users[1].address
    );
    const userTwoPostSaleBalance = await ethers.provider.getBalance(
      users[2].address
    );
    const userThreePostSaleBalance = await ethers.provider.getBalance(
      users[3].address
    );

    // two losing bidders should recieve ETH back
    expect(userOnePostSaleBalance.sub(userOnePostBuyBalance)).to.be.equal(
      parseEther('0.2')
    );
    expect(userTwoPostSaleBalance.sub(userTwoPostBuyBalance)).to.be.equal(
      parseEther('0.6')
    );
    // winning bidder does not recieve ETH back
    expect(userThreePostSaleBalance.sub(userThreePostBuyBalance)).to.be.equal(
      parseEther('0')
    );

    // seller should recieve max bid minus gas fee
    expect(
      userZeroPostBalance
        .sub(userZeroPreBalance)
        .add(await calcGas(saleTx))
        .add(await calcRugFee(parseEther('1.1'), AUCTION_FEE))
        .toString()
    ).to.be.equal(parseEther('1.1'));

    /**
     * Check correct amount of ETH is withdrawn from first Auction
     */
    const sixSaleTx = await users[6].Auction.executeSale(
      PBDA.address,
      newPBDAIDSix
    );
    const userSixPostBalance = await ethers.provider.getBalance(
      users[6].address
    );
    // seller should recieve max bid minus gas fee
    expect(
      userSixPostBalance
        .sub(userSixPreBalance)
        .add(await calcGas(sixSaleTx))
        .add(await calcRugFee(parseEther('10'), AUCTION_FEE))
        .toString()
    ).to.be.equal(parseEther('10'));
  });

  it('Auction sends correct fee amount to designated address', async function () {
    const {PBDA, tokenOwner, users, newPBDAID} = await setup_auction(
      parseEther('0.1'),
      2
    );

    // user bids on auction
    await users[1].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('1'),
    });

    // get balance of designated fee account before ending auction
    const preFeeBalance = await ethers.provider.getBalance(tokenOwner.address);

    // execute sale
    await users[0].Auction.executeSale(PBDA.address, newPBDAID);

    // get balance of designated fee account after ending auction
    const postFeeBalance = await ethers.provider.getBalance(tokenOwner.address);

    expect(postFeeBalance.sub(preFeeBalance)).to.be.equal(
      await calcRugFee(parseEther('1'), AUCTION_FEE)
    );
  });
});

describe('Auction events', function () {
  it('Should emit event when creating an auction', async function () {
    const {Auction, PBDA, users, tokenOwner} = await setup();

    // mint PBDA to specified user address
    await tokenOwner.PBDA.mintDeed(users[0].address);

    // hacky work around until PBDA contract fixed
    // only one pbda will exist at this point, grab the 0th one
    const newPBDAID = await PBDA.tokenByIndex(0);

    // approve transfer of PBDA from users[0] to Auction contract
    await users[0].PBDA.approve(Auction.address, newPBDAID);

    // consts for auction
    const price = parseEther('0.1');
    const duration = 20;

    // check event when create the auction of the PBDA
    await expect(
      users[0].Auction.createTokenAuction(
        PBDA.address,
        newPBDAID,
        price,
        duration
      )
    )
      .to.emit(Auction, 'AuctionCreated')
      .withArgs(users[0].address, PBDA.address, newPBDAID, duration, price);
  });

  it('Should emit event when bidding on an auction', async function () {
    // consts for auction
    const price = parseEther('0.1');
    const duration = 20;

    const {Auction, PBDA, users, newPBDAID} = await setup_auction(
      price,
      duration
    );

    // check event when bidding
    await expect(
      users[1].Auction.bid(PBDA.address, newPBDAID, {
        value: parseEther('0.2'),
      })
    )
      .to.emit(Auction, 'Bid')
      .withArgs(users[1].address, PBDA.address, newPBDAID, parseEther('0.2'));
  });

  it('Should emit event when executing sale with no bids', async function () {
    // consts for auction
    const price = parseEther('0.1');
    const duration = 1;

    const {Auction, PBDA, users, newPBDAID} = await setup_auction(
      price,
      duration
    );

    // check event when executing sale
    await expect(users[0].Auction.executeSale(PBDA.address, newPBDAID))
      .to.emit(Auction, 'SaleExecuted')
      .withArgs(users[0].address, users[0].address, PBDA.address, newPBDAID, parseEther('0'));
  });

  it('Should emit event when executing sale with bids', async function () {
    const {Auction, PBDA, users, newPBDAID} = await setup_auction(
      parseEther('0.1'),
      2
    );

    // bid on auction
    await users[1].Auction.bid(PBDA.address, newPBDAID, {
      value: parseEther('0.2'),
    });

    // check event when executing sale
    await expect(users[0].Auction.executeSale(PBDA.address, newPBDAID))
      .to.emit(Auction, 'SaleExecuted')
      .withArgs(users[0].address, users[1].address, PBDA.address, newPBDAID, parseEther('0.2'));
  });

  it('Should emit event when canceling auction', async function () {
    const {Auction, PBDA, users, newPBDAID} = await setup_auction(
      parseEther('0.1'),
      20
    );

    // check event when canceling auction
    await expect(users[0].Auction.cancelAuction(PBDA.address, newPBDAID))
      .to.emit(Auction, 'AuctionCanceled')
      .withArgs(users[0].address, PBDA.address, newPBDAID);
  });
});
