import {expect} from '../chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';

import {parseEther} from 'ethers/lib/utils';

import {RugToken, RugStall} from '../../typechain';
import {setupUser, setupUsers} from '../utils';

import {TOKEN_NAME, STAKING_TAG} from '../../scripts/utils/constants';

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

async function rugXRugRatio(RugToken: RugToken, RugStall: RugStall) {
  // get reward value
  const totalXRugs = await RugStall.totalSupply();
  const lockedRug = await RugToken.balanceOf(RugStall.address);
  if (totalXRugs.eq(parseEther('0'))) {
    return '1';
  } else {
    const ratio = lockedRug.div(totalXRugs);
    return ratio;
  }
}

async function setupAndSeedUsersRandomly() {
  const {RugToken, RugStall, users, tokenOwner} = await setup();
  // owner starts with 300 mil Rug
  const initialBalance = await RugToken.balanceOf(tokenOwner.address);

  // allocated random amount of Rug to users
  const alotments = Array.from({length: users.length}, () => {
    return parseEther((Math.random() * 10000).toString());
  });

  // get sum of random alotments
  const sumAlotments = alotments.reduce((a, b) => a.add(b), parseEther('0'));

  // loop over, transfer RUG, approve RugStall, enter with half
  for (let i = 0; i < users.length; i++) {
    await tokenOwner.RugToken.transfer(users[i].address, alotments[i]);
    await users[i].RugToken.approve(RugStall.address, alotments[i]);
  }

  return {
    RugToken,
    RugStall,
    users,
    tokenOwner,
    initialBalance,
    alotments,
    sumAlotments,
  };
}

describe('Simulate Staking', async function () {
  it('verify setup seed', async function () {
    const {
      RugToken,
      RugStall,
      users,
      tokenOwner,
      initialBalance,
      alotments,
      sumAlotments,
    } = await setupAndSeedUsersRandomly();

    // owner has total - alotments
    const expectedPostTransfer = initialBalance.sub(sumAlotments);
    expect(await RugToken.balanceOf(tokenOwner.address)).to.be.equal(
      expectedPostTransfer
    );

    // users all allocate half of their alotments
    for (let i = 0; i < users.length; i++) {
      await users[i].RugStall.enter(alotments[i].div(2));
    }

    // staked supply is half the alotments
    expect(await RugToken.balanceOf(RugStall.address)).to.be.equal(
      sumAlotments.div(2)
    );
    expect(await RugStall.totalSupply()).to.be.equal(sumAlotments.div(2));
  });

  it('works with psuedo fees', async function () {
    const {
      RugToken,
      RugStall,
      users,
      tokenOwner,
      initialBalance,
      alotments,
      sumAlotments,
    } = await setupAndSeedUsersRandomly();

    const initRatio = await rugXRugRatio(RugToken, RugStall);
    // weird but BigNum 1
    expect(initRatio).to.be.equal('1');

    // users all allocate half of their alotments to
    // staking contract w/o any fees
    for (let i = 0; i < users.length; i++) {
      await users[i].RugStall.enter(alotments[i].div(2));
    }
    const sampleBalance = await users[0].RugStall.balanceOf(users[0].address);
    console.log('sample Balance', sampleBalance);
    const allocatedRatio = await rugXRugRatio(RugToken, RugStall);
    expect(allocatedRatio).to.be.equal('1');

    // double up rug as simulated fees
    await tokenOwner.RugToken.transfer(RugStall.address, sumAlotments.div(2));
    const afterFeeRatio = await rugXRugRatio(RugToken, RugStall);
    expect(afterFeeRatio).to.be.equal('2');

    // user 0's exit
    const users0TokenBal = await RugToken.balanceOf(users[0].address);
    const users0StakedBal = await RugStall.balanceOf(users[0].address);

    await users[0].RugStall.leave(users0StakedBal);
    const expected0Prem = users0StakedBal.mul(afterFeeRatio);
    const expected0Bal = expected0Prem.add(users0TokenBal);

    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(
      expected0Bal
    );

    // user 1's exit
    const users1TokenBal = await RugToken.balanceOf(users[1].address);
    const users1StakedBal = await RugStall.balanceOf(users[1].address);

    await users[1].RugStall.leave(users1StakedBal);
    const expectedPrem = users1StakedBal.mul(afterFeeRatio);
    const expected1Bal = expectedPrem.add(users1TokenBal);

    expect(await RugToken.balanceOf(users[1].address)).to.be.equal(
      expected1Bal
    );

    // Ratio remains even with withdraw & adjustments

    // add more fees!
    await tokenOwner.RugToken.transfer(RugStall.address, sumAlotments.div(2));
    const after2ndFeeRatio = await rugXRugRatio(RugToken, RugStall);
    expect(after2ndFeeRatio).to.be.equal('3');

    // user 0 gets fomo and re-stakes, ratio still in tact
    const user0CurBal = await RugToken.balanceOf(users[0].address);
    await users[0].RugToken.approve(RugStall.address, user0CurBal);
    await users[0].RugStall.enter(user0CurBal);
    const afterReEntryFeeRatio = await rugXRugRatio(RugToken, RugStall);
    expect(afterReEntryFeeRatio).to.be.equal('3');
  });
});
