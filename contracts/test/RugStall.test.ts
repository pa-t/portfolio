import {expect} from './chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';

import {parseEther} from 'ethers/lib/utils';

import {RugToken, RugStall} from '../typechain';
import {setupUser, setupUsers} from './utils';

import {TOKEN_NAME, STAKING_TAG} from '../scripts/utils/constants';

const setup = deployments.createFixture(async () => {
  await deployments.fixture([TOKEN_NAME, STAKING_TAG]);
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    RugStall: <RugStall>await ethers.getContract(STAKING_TAG),
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

describe('RugStall initialized with correct defaults', function () {
  it('Has starting Rug of 0', async function () {
    const {RugStall, RugToken} = await setup();

    const stallAddr = await RugStall.address;
    expect(await RugToken.balanceOf(stallAddr)).to.be.equal(0);
  });

  it('Has starting xRug of 0', async function () {
    const {RugStall} = await setup();
    expect(await RugStall.totalSupply()).to.be.equal(0);
  });

  it('uses same RugToken', async function () {
    const {RugToken, RugStall} = await setup();
    const tokenAddr = await RugToken.address;
    const stallAddr = await RugStall.rugToken();
    expect(tokenAddr).to.be.equal(stallAddr);
  });
});

describe('Staking works properly', async function () {
  it('can stake', async function () {
    const {RugToken, RugStall, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const ownerBalance = await RugToken.balanceOf(tokenOwner.address);
    const deposit = ownerBalance.div(100000);

    // must approve first
    await tokenOwner.RugToken.approve(RugStall.address, deposit);
    // send deposit
    await tokenOwner.RugStall.enter(deposit);

    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(deposit);
    expect(await RugStall.balanceOf(tokenOwner.address)).to.be.equal(deposit);
  });

  it('can unstake staked', async function () {
    const {RugToken, RugStall, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const initialOwnerBal = await RugToken.balanceOf(tokenOwner.address);
    const deposit = initialOwnerBal.div(100000);

    // must approve then deposit
    await tokenOwner.RugToken.approve(RugStall.address, deposit);
    await tokenOwner.RugStall.enter(deposit);

    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(deposit);
    expect(await RugStall.balanceOf(tokenOwner.address)).to.be.equal(deposit);

    // unstake should be same amount since no change in ratio as only participant
    await tokenOwner.RugStall.leave(deposit);

    expect(await RugToken.balanceOf(tokenOwner.address)).to.be.equal(
      initialOwnerBal
    );
  });

  it('cant unstake more than staked', async function () {
    const {RugToken, RugStall, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const initialOwnerBal = await RugToken.balanceOf(tokenOwner.address);
    const deposit = initialOwnerBal.div(100000);

    // must approve then deposit
    await tokenOwner.RugToken.approve(RugStall.address, deposit);
    await tokenOwner.RugStall.enter(deposit);

    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(deposit);
    expect(await RugStall.balanceOf(tokenOwner.address)).to.be.equal(deposit);

    // unstake should be same amount since no change in ratio as only participant
    await expect(tokenOwner.RugStall.leave(deposit.mul(2))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance'
    );
    // unchanged
    expect(await RugStall.balanceOf(tokenOwner.address)).to.be.equal(deposit);
  });

  it('fails if staking more than approved amount', async function () {
    const {RugToken, RugStall, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const ownerBalance = await RugToken.balanceOf(tokenOwner.address);
    // set deposit to more than approved
    const approved = ownerBalance.div(100000);
    const deposit = approved.mul(10);

    // must approve first
    await tokenOwner.RugToken.approve(RugStall.address, approved);
    // send deposit
    await expect(tokenOwner.RugStall.enter(deposit)).to.be.revertedWith(
      'ERC20: transfer amount exceeds allowance'
    );
  });

  it('can approve then desposit increments', async function () {
    const {RugToken, RugStall, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const ownerBalance = await RugToken.balanceOf(tokenOwner.address);
    // set deposit to more than approved
    const approved = ownerBalance.div(100000);
    const deposit = approved.div(4);

    // must approve first
    await tokenOwner.RugToken.approve(RugStall.address, approved);
    // send deposit

    await tokenOwner.RugStall.enter(deposit);
    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(deposit);

    await tokenOwner.RugStall.enter(deposit);
    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(
      deposit.mul(2)
    );

    await tokenOwner.RugStall.enter(deposit);
    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(
      deposit.mul(3)
    );

    await tokenOwner.RugStall.enter(deposit);
    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(
      deposit.mul(4)
    );
  });
});

describe('Multi-user staking works properly', async function () {
  it('can approve then desposit increments', async function () {
    const {RugToken, RugStall, users, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const ownerBalance = await RugToken.balanceOf(tokenOwner.address);

    // alotments
    const ownerAlotment = parseEther('20000');
    const alotment0 = parseEther('10000');
    const alotment1 = parseEther('5000');
    const alotment2 = parseEther('2000');

    // transfer user0, user1, user2 RUG
    await tokenOwner.RugToken.transfer(users[0].address, alotment0);
    await tokenOwner.RugToken.transfer(users[1].address, alotment1);
    await tokenOwner.RugToken.transfer(users[2].address, alotment2);

    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(alotment0);
    expect(await RugToken.balanceOf(users[1].address)).to.be.equal(alotment1);
    expect(await RugToken.balanceOf(users[2].address)).to.be.equal(alotment2);

    const postOwnerBalance = await RugToken.balanceOf(tokenOwner.address);

    // approve
    await tokenOwner.RugToken.approve(RugStall.address, ownerBalance);
    await users[0].RugToken.approve(RugStall.address, alotment0);
    await users[1].RugToken.approve(RugStall.address, alotment1);
    await users[2].RugToken.approve(RugStall.address, alotment2);

    // can enter xRug
    await tokenOwner.RugStall.enter(ownerAlotment);
    await users[0].RugStall.enter(alotment0);
    await users[1].RugStall.enter(alotment1);
    await users[2].RugStall.enter(alotment2);

    // xRug bal correct
    expect(await RugStall.balanceOf(tokenOwner.address)).to.be.equal(
      ownerAlotment
    );
    expect(await RugStall.balanceOf(users[0].address)).to.be.equal(alotment0);
    expect(await RugStall.balanceOf(users[1].address)).to.be.equal(alotment1);
    expect(await RugStall.balanceOf(users[2].address)).to.be.equal(alotment2);

    expect(await RugToken.balanceOf(tokenOwner.address)).to.be.equal(
      postOwnerBalance.sub(ownerAlotment)
    );
    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(0);
    expect(await RugToken.balanceOf(users[1].address)).to.be.equal(0);
    expect(await RugToken.balanceOf(users[2].address)).to.be.equal(0);

    // exiting returns same amount
    await users[0].RugStall.leave(alotment0);
    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(alotment0);

    await users[1].RugStall.leave(alotment1);
    expect(await RugToken.balanceOf(users[1].address)).to.be.equal(alotment1);

    const expectedRemaining = ownerAlotment.add(alotment2);
    expect(await RugStall.totalSupply()).to.be.equal(expectedRemaining);
  });
});

describe('Added fees properly reward holders', async function () {
  it('can approve then desposit increments', async function () {
    const {RugToken, RugStall, users, tokenOwner} = await setup();
    // owner starts with 300 mil Rug
    const ownerBalance = await RugToken.balanceOf(tokenOwner.address);

    // alotments
    const ownerAlotment = parseEther('20000');
    const alotment0 = parseEther('10000');
    const alotment1 = parseEther('5000');
    const alotment2 = parseEther('2000');

    const totalAlottedRug = ownerAlotment
      .add(alotment0)
      .add(alotment1)
      .add(alotment2);
    console.log(totalAlottedRug);

    // transfer user0, user1, user2 RUG
    await tokenOwner.RugToken.transfer(users[0].address, alotment0);
    await tokenOwner.RugToken.transfer(users[1].address, alotment1);
    await tokenOwner.RugToken.transfer(users[2].address, alotment2);

    // approve
    await tokenOwner.RugToken.approve(RugStall.address, ownerBalance);
    await users[0].RugToken.approve(RugStall.address, alotment0);
    await users[1].RugToken.approve(RugStall.address, alotment1);
    await users[2].RugToken.approve(RugStall.address, alotment2);

    // enter Stall
    await tokenOwner.RugStall.enter(ownerAlotment);
    await users[0].RugStall.enter(alotment0);
    await users[1].RugStall.enter(alotment1);
    await users[2].RugStall.enter(alotment2);

    expect(await RugStall.totalSupply()).to.be.equal(totalAlottedRug);

    // Simulate auctionhouse fees sent as Rug to Stall
    const rugInStall = await RugToken.balanceOf(RugStall.address);
    // double the amount (auction will buy rug from bonding curve)
    await tokenOwner.RugToken.transfer(RugStall.address, rugInStall);

    // user[0] redeems, starting with 0 since fully staked
    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(0);
    await users[0].RugStall.leave(alotment0);
    expect(await RugStall.totalSupply()).to.be.equal(
      totalAlottedRug.sub(alotment0)
    );
    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(
      alotment0.mul(2)
    );

    // user[1] redeems
    expect(await RugToken.balanceOf(users[1].address)).to.be.equal(0);
    await users[1].RugStall.leave(alotment1);
    expect(await RugStall.totalSupply()).to.be.equal(
      totalAlottedRug.sub(alotment0).sub(alotment1)
    );
    expect(await RugToken.balanceOf(users[1].address)).to.be.equal(
      alotment1.mul(2)
    );
  });
});
