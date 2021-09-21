import {expect} from './chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {PBDA} from '../typechain';
import {setupUser, setupUsers} from './utils';

import {PBDA_TAG, PDBA_METADATA_URI} from '../scripts/utils/constants';

const setup = deployments.createFixture(async () => {
  await deployments.fixture([PBDA_TAG]);
  const {deployer, tokenOwner} = await getNamedAccounts();
  const contracts = {
    PBDA: <PBDA>await ethers.getContract(PBDA_TAG),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
    tokenOwner: await setupUser(tokenOwner, contracts),
  };
});

describe('PBDA Spec', function () {
  // 1. test name
  it('has correct name', async function () {
    const {PBDA} = await setup();
    expect(await PBDA.name()).to.equal('PhysicallyBackedDigitalAsset');
  });

  // 2. test symbol
  it('has correct symbol', async function () {
    const {PBDA} = await setup();
    expect(await PBDA.symbol()).to.equal('PBDA');
  });

  // 3. test supply
  it('total supply is equal to initial supply', async function () {
    const {PBDA} = await setup();
    expect(await PBDA.totalSupply()).to.equal(0);
  });

  // 4. Base URI in constructor
  it('base uri is default ', async function () {
    const {PBDA} = await setup();
    expect(await PBDA.baseURI()).to.equal('localhost:3001/metadata/');
  });
});

describe('PDBA Contract Ownership', function () {
  // test minting
  it('has correct owner', async function () {
    const {PBDA, tokenOwner} = await setup();
    expect(await PBDA.owner()).to.equal(tokenOwner.address);
  });

  it('does not set deployer to owner', async function () {
    const {PBDA, deployer} = await setup();
    expect(await PBDA.owner()).to.not.equal(deployer.address);
  });
});

describe('PDBA Basics', function () {
  // test minting
  it('can mint NFT, increases supply', async function () {
    const {tokenOwner, PBDA} = await setup();
    await tokenOwner.PBDA.mintDeed(tokenOwner.address);
    expect(await PBDA.totalSupply()).to.equal(1);
  });

  it('shows owner balance after mint', async function () {
    const {tokenOwner} = await setup();
    await tokenOwner.PBDA.mintDeed(tokenOwner.address);
    expect(await tokenOwner.PBDA.balanceOf(tokenOwner.address)).to.equal(1);
  });

  it('creates usable nft token', async function () {
    const {tokenOwner, PBDA} = await setup();

    const mintToAddress = tokenOwner.address;

    expect(await PBDA.balanceOf(mintToAddress)).to.be.equal(0); // owner has correct init bal

    // mint returns a full transaction
    const mintTransaction = await tokenOwner.PBDA.mintDeed(mintToAddress);
    const transactionReceipt = await mintTransaction.wait();
    const txnEvents = await transactionReceipt.events;

    let tokenTo, tokenId;
    if (txnEvents) {
      // could be undefined
      const eventArgs = txnEvents[0].args;
      if (eventArgs) {
        // could be undefined
        tokenTo = eventArgs.to;
        tokenId = eventArgs.tokenId;
      }
    }
    // with 'caught' event, check validity
    // 1. correct address
    // 2. owner balance is correct
    // 3. owner of tokenId address is correct
    // 4. token Uri is provided mint URI
    expect(tokenTo).to.be.equal(mintToAddress);
    expect(await PBDA.balanceOf(mintToAddress)).to.be.equal(1);
    expect(await PBDA.ownerOf(tokenId)).to.be.equal(mintToAddress);
    const baseURI = await PBDA.baseURI();
    expect(await PBDA.tokenURI(tokenId)).to.be.equal(baseURI + tokenId);
  });

  it('can be transfered', async function () {
    const {tokenOwner, PBDA, users} = await setup();

    const mintToAddress = tokenOwner.address;

    expect(await PBDA.balanceOf(mintToAddress)).to.be.equal(0); // owner has correct init bal

    // mint returns a full transaction
    const mintTransaction = await tokenOwner.PBDA.mintDeed(mintToAddress);
    const transactionReceipt = await mintTransaction.wait();
    const txnEvents = await transactionReceipt.events;

    let tokenId;
    if (txnEvents) {
      // could be undefined
      const eventArgs = txnEvents[0].args;
      if (eventArgs) {
        // could be undefined
        tokenId = eventArgs.tokenId;
      }
    }

    // transfer from original minter to user[0]
    expect(await PBDA.balanceOf(mintToAddress)).to.be.equal(1);
    expect(await PBDA.balanceOf(users[0].address)).to.be.equal(0);
    expect(await PBDA.ownerOf(tokenId)).to.be.equal(mintToAddress);
    // await tokenOwner.PBDA.approve(users[0].address, tokenId)
    await tokenOwner.PBDA['safeTransferFrom(address,address,uint256)'](
      mintToAddress,
      users[0].address,
      tokenId
    );

    // verify transfer
    expect(await PBDA.balanceOf(mintToAddress)).to.be.equal(0);
    expect(await PBDA.balanceOf(users[0].address)).to.be.equal(1);
    expect(await PBDA.ownerOf(tokenId)).to.be.equal(users[0].address);

    // transfer again from user[0] to user[1]
    await users[0].PBDA['safeTransferFrom(address,address,uint256)'](
      users[0].address,
      users[1].address,
      tokenId
    );
    expect(await PBDA.balanceOf(users[0].address)).to.be.equal(0);
    expect(await PBDA.balanceOf(users[1].address)).to.be.equal(1);
    expect(await PBDA.ownerOf(tokenId)).to.be.equal(users[1].address);
  });
});

const mintSampleDeed = async () => {
  const {tokenOwner, users, PBDA} = await setup();

  const mintToAddress = tokenOwner.address;

  // mint returns a full transaction
  const mintTransaction = await tokenOwner.PBDA.mintDeed(mintToAddress);
  const transactionReceipt = await mintTransaction.wait();
  const txnEvents = await transactionReceipt.events;

  let tokenId;
  if (txnEvents) {
    // could be undefined
    const eventArgs = txnEvents[0].args;
    if (eventArgs) {
      // could be undefined
      tokenId = eventArgs.tokenId;
    }
  }
  return {
    tokenOwner,
    users,
    PBDA,
    tokenId,
  };
};

describe('PBDA Status', async function () {
  enum ItemStatus {
    CUSTODIED,
    UNDER_REDEMPTION,
    REDEEMED,
    UNDER_REINTEGRATION,
  }

  it('starts with Custodied status', async function () {
    const {PBDA, tokenId} = await mintSampleDeed();
    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
  });

  it('can change to UNDER_REDEMPTION', async function () {
    const {tokenOwner, PBDA, tokenId} = await mintSampleDeed();

    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
    await tokenOwner.PBDA.setStatus(tokenId, ItemStatus.UNDER_REDEMPTION);
    expect(await PBDA.getStatus(tokenId)).to.be.equal(
      ItemStatus.UNDER_REDEMPTION
    );
  });

  it('can change to REDEEMED', async function () {
    const {tokenOwner, PBDA, tokenId} = await mintSampleDeed();

    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
    await tokenOwner.PBDA.setStatus(tokenId, ItemStatus.REDEEMED);
    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.REDEEMED);
  });

  it('can change to UNDER_REINTEGRATION', async function () {
    const {tokenOwner, PBDA, tokenId} = await mintSampleDeed();

    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
    await tokenOwner.PBDA.setStatus(tokenId, ItemStatus.UNDER_REINTEGRATION);
    expect(await PBDA.getStatus(tokenId)).to.be.equal(
      ItemStatus.UNDER_REINTEGRATION
    );
  });

  it('cant be changed by non-owner', async function () {
    const {users, PBDA, tokenId} = await mintSampleDeed();

    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
    await expect(
      users[0].PBDA.setStatus(tokenId, ItemStatus.UNDER_REINTEGRATION)
    ).to.be.revertedWith('Ownable: caller is not the owner');

    // remains unchanged
    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
  });

  it('emits properly', async function () {
    const {tokenOwner, PBDA, tokenId} = await mintSampleDeed();

    expect(await PBDA.getStatus(tokenId)).to.be.equal(ItemStatus.CUSTODIED);
    await expect(
      tokenOwner.PBDA.setStatus(tokenId, ItemStatus.UNDER_REDEMPTION)
    )
      .to.emit(PBDA, 'ItemStatusChanged')
      .withArgs(tokenId, ItemStatus.UNDER_REDEMPTION);

    await expect(tokenOwner.PBDA.setStatus(tokenId, ItemStatus.REDEEMED))
      .to.emit(PBDA, 'ItemStatusChanged')
      .withArgs(tokenId, ItemStatus.REDEEMED);

    await expect(
      tokenOwner.PBDA.setStatus(tokenId, ItemStatus.UNDER_REINTEGRATION)
    )
      .to.emit(PBDA, 'ItemStatusChanged')
      .withArgs(tokenId, ItemStatus.UNDER_REINTEGRATION);

    await expect(tokenOwner.PBDA.setStatus(tokenId, ItemStatus.CUSTODIED))
      .to.emit(PBDA, 'ItemStatusChanged')
      .withArgs(tokenId, ItemStatus.CUSTODIED);
  });
});

describe('Metadata baseURI', async function () {
  it('base URI can be changed', async function () {
    const {PBDA, tokenOwner} = await setup();
    expect(await PBDA.baseURI()).to.equal(PDBA_METADATA_URI);

    await tokenOwner.PBDA.setMetadataURI('https://mywebsite.com/');
    expect(await PBDA.baseURI()).to.equal('https://mywebsite.com/');
  });

  it('base URI cant be changed by non-owner', async function () {
    const {PBDA, users} = await setup();
    expect(await PBDA.baseURI()).to.equal(PDBA_METADATA_URI);

    await expect(
      users[0].PBDA.setMetadataURI('https://mywebsite.com/')
    ).to.be.revertedWith('Ownable: caller is not the owner');

    expect(await PBDA.baseURI()).to.equal(PDBA_METADATA_URI);
  });

  it('base URI updates full token endpoint', async function () {
    const {tokenOwner, PBDA, tokenId} = await mintSampleDeed();

    const newURI = 'https://mywebsite.com/';
    expect(await PBDA.baseURI()).to.equal(PDBA_METADATA_URI);

    await tokenOwner.PBDA.setMetadataURI(newURI);
    expect(await PBDA.baseURI()).to.equal('https://mywebsite.com/');
    expect(await PBDA.tokenURI(tokenId)).to.be.equal(newURI + tokenId);
  });

  it('URI change emits event', async function () {
    const {PBDA, tokenOwner} = await setup();
    const newURI = 'https://mywebsite.com/';

    await expect(tokenOwner.PBDA.setMetadataURI('https://mywebsite.com/'))
      .to.emit(PBDA, 'MetadataURIChanged')
      .withArgs(newURI);
    expect(await PBDA.baseURI()).to.equal('https://mywebsite.com/');
  });
});
