import {expect} from '../chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';

import {parseEther} from 'ethers/lib/utils';

import {BondingCurvePhaseOne, RugToken} from '../../typechain';
import {setupUser, setupUsers, calcGas} from '../utils';

import {
  TOKEN_NAME,
  BCPO_TAG,
  RUG_TARGET,
  WEI_TARGET,
} from '../../scripts/utils/constants';

const setup = deployments.createFixture(async () => {
  await deployments.fixture([TOKEN_NAME, BCPO_TAG]);
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    BondingCurvePhaseOne: <BondingCurvePhaseOne>(
      await ethers.getContract(BCPO_TAG)
    ),
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

const setup_phase_one = deployments.createFixture(async () => {
  const {users, RugToken, BondingCurvePhaseOne, deployer, tokenOwner} =
    await setup();

  await tokenOwner.RugToken.transfer(BondingCurvePhaseOne.address, RUG_TARGET);

  return {
    RugToken,
    BondingCurvePhaseOne,
    users,
    deployer,
    tokenOwner,
  };
});

// check intialization was correct
describe('BondingCurvePhaseOne initialized', function () {
  it('BondingCurvePhaseOne should be funded correct amount', async function () {
    const {RugToken, BondingCurvePhaseOne} = await setup_phase_one();

    // check balance of phase one contract
    expect(await RugToken.balanceOf(BondingCurvePhaseOne.address)).to.equal(
      RUG_TARGET
    );
  });

  it('Proper Rug and Wei targets', async function () {
    const {BondingCurvePhaseOne} = await setup_phase_one();

    // check rug token target
    expect(await BondingCurvePhaseOne.rugTarget()).to.equal(RUG_TARGET);

    // check eth target
    expect(await BondingCurvePhaseOne.weiTarget()).to.equal(WEI_TARGET);
  });

  it('Multiplier is correct', async function () {
    const {BondingCurvePhaseOne} = await setup_phase_one();

    // check multiplier
    expect(await BondingCurvePhaseOne.multiplier()).to.equal(
      RUG_TARGET.div(WEI_TARGET)
    );
  });

  it('BondingCurvePhaseOne intial state correct', async function () {
    const {BondingCurvePhaseOne} = await setup_phase_one();

    // sale should initialize as inactive
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });
});

describe('BondingCurvePhaseOne Start', function () {
  it('BondingCurvePhaseOne should start', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // start the sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.true;
  });

  // checks three users buying from phase one
  it('Users can purchase RUG for ETH [ @skip-on-coverage ]', async function () {
    const {users, RugToken, tokenOwner} = await setup_phase_one();
    await tokenOwner.BondingCurvePhaseOne.startSale();

    const ETH_PURCHASE = parseEther('3');

    // get eth balance of buyer before buying from contract
    const beforeBalance0 = await ethers.provider.getBalance(users[0].address);
    // users[0] makes a purchase of 3 ETH for rug/wei RUG
    const receipt0 = await users[0].BondingCurvePhaseOne.buy({
      value: ETH_PURCHASE,
    });
    const gasCost0 = await calcGas(receipt0);
    const afterBalance0 = await ethers.provider.getBalance(users[0].address);
    // check the correct amount of ETH has been spent
    expect(beforeBalance0.sub(afterBalance0).sub(gasCost0)).to.be.equal(
      ETH_PURCHASE
    );
    expect(await RugToken.balanceOf(users[0].address)).to.equal(
      ETH_PURCHASE.mul(RUG_TARGET.div(WEI_TARGET))
    );

    const ETH_PURCHASE_2 = parseEther('20');

    // get eth balance of buyer before buying from contract
    const beforeBalance1 = await ethers.provider.getBalance(users[1].address);
    // users[1] makes a purchase of 20 ETH for 300,000 RUG
    const receipt1 = await users[1].BondingCurvePhaseOne.buy({
      value: ETH_PURCHASE_2,
    });
    const gasCost1 = await calcGas(receipt1);
    const afterBalance1 = await ethers.provider.getBalance(users[1].address);
    // check the correct amount of ETH has been spent
    expect(beforeBalance1.sub(afterBalance1).sub(gasCost1)).to.be.equal(
      ETH_PURCHASE_2
    );
    expect(await RugToken.balanceOf(users[1].address)).to.equal(
      ETH_PURCHASE_2.mul(RUG_TARGET.div(WEI_TARGET))
    );

    const ETH_PURCHASE_3 = parseEther('90');
    // get eth balance of buyer before buying from contract
    const beforeBalance2 = await ethers.provider.getBalance(users[2].address);
    // users[2] makes a purchase of 90 ETH for 1,350,000 RUG
    const receipt2 = await users[2].BondingCurvePhaseOne.buy({
      value: ETH_PURCHASE_3,
    });
    const gasCost2 = await calcGas(receipt2);
    const afterBalance2 = await ethers.provider.getBalance(users[2].address);
    // check the correct amount of ETH has been spent
    expect(beforeBalance2.sub(afterBalance2).sub(gasCost2)).to.be.equal(
      ETH_PURCHASE_3
    );
    expect(await RugToken.balanceOf(users[2].address)).to.equal(
      ETH_PURCHASE_3.mul(RUG_TARGET.div(WEI_TARGET))
    );
  });
});

describe('BondingCurvePhaseOne pause and test ERC20 tx', function () {
  it('BondingCurvePhaseOne should revert non owner pause', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.pauseSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.true;
  });

  it('BondingCurvePhaseOne should pause', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    await tokenOwner.BondingCurvePhaseOne.pauseSale();
    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('Pausing phase one should not effect ERC20', async function () {
    const {users, BondingCurvePhaseOne, RugToken, tokenOwner} =
      await setup_phase_one();
    // pre-req: phase one should be started and users should have tokens
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: parseEther('3')});
    await users[1].BondingCurvePhaseOne.buy({value: parseEther('20')});
    await users[2].BondingCurvePhaseOne.buy({value: parseEther('90')});

    // pause sale
    await tokenOwner.BondingCurvePhaseOne.pauseSale();
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;

    // user 2 transfers tokens to user 3

    // check starting balance of user 3 is 0
    expect(await RugToken.balanceOf(users[3].address)).to.equal(0);

    // transfer
    const user2StartBalance = await RugToken.balanceOf(users[2].address);
    await users[2].RugToken.transfer(users[3].address, parseEther('100'));

    // check right amount sent
    expect(await RugToken.balanceOf(users[3].address)).to.equal(
      parseEther('100')
    );
    expect(await RugToken.balanceOf(users[2].address)).to.equal(
      user2StartBalance.sub(parseEther('100'))
    );
  });

  it('BondingCurvePhaseOne should revert non owner unpause', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale & pause it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.pauseSale();

    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.startSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('BondingCurvePhaseOne should restart after unpause', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale & pause it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.pauseSale();

    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.true;
  });
});

describe('BondingCurvePhaseOne Burn', function () {
  it('BondingCurvePhaseOne should revert burn when sale not ended', async function () {
    const {tokenOwner} = await setup_phase_one();
    // pre-req: start the sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    await expect(tokenOwner.BondingCurvePhaseOne.rugBurn()).to.be.revertedWith(
      'Sale not ended!'
    );
  });

  it('BondingCurvePhaseOne should revert non owner burn rug', async function () {
    const {users, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale & end it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.rugBurn()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('BondingCurvePhaseOne should burn rug', async function () {
    const {BondingCurvePhaseOne, RugToken, tokenOwner} =
      await setup_phase_one();
    // pre-req: start the sale & end it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    const beforeSupply = await RugToken.totalSupply();
    const beforeBalance = await RugToken.balanceOf(
      BondingCurvePhaseOne.address
    );
    await tokenOwner.BondingCurvePhaseOne.rugBurn();
    const afterSupply = await RugToken.totalSupply();
    const afterBalance = await RugToken.balanceOf(BondingCurvePhaseOne.address);

    // check phase one RUG balance Zero after burning
    expect(afterBalance).to.equal(0);

    // check correct amount of supply was burned
    expect(beforeSupply.sub(afterSupply)).to.equal(beforeBalance);
  });
});

describe('End BondingCurvePhaseOne', function () {
  it('BondingCurvePhaseOne contract should have an ETH balance of 113', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: phase one should be started and users should have tokens
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: parseEther('3')});
    await users[1].BondingCurvePhaseOne.buy({value: parseEther('20')});
    await users[2].BondingCurvePhaseOne.buy({value: parseEther('90')});

    expect(
      await ethers.provider.getBalance(BondingCurvePhaseOne.address)
    ).to.be.equal(parseEther('113'));
  });

  it('BondingCurvePhaseOne should revert non owner end sale', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.endSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.true;
  });

  it('BondingCurvePhaseOne should end', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale & end it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('BondingCurvePhaseOne should not restart after ending', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale & end it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    await expect(
      tokenOwner.BondingCurvePhaseOne.startSale()
    ).to.be.revertedWith('Cannot restart sale!');

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('BondingCurvePhaseOne should revert buy after ending', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start the sale & end it
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    await expect(
      users[0].BondingCurvePhaseOne.buy({value: parseEther('3')})
    ).to.be.revertedWith('Phase One has not yet started!');

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('Owner can burn RUG token and withdraw from phase one after ending [ @skip-on-coverage ]', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: phase one should be started and users should have tokens
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: parseEther('3')});
    await users[1].BondingCurvePhaseOne.buy({value: parseEther('20')});
    await users[2].BondingCurvePhaseOne.buy({value: parseEther('90')});
    await tokenOwner.BondingCurvePhaseOne.endSale();

    expect(await BondingCurvePhaseOne.isActive()).to.be.false;

    await tokenOwner.BondingCurvePhaseOne.rugBurn();

    const beforeBalancePhaseOne = await ethers.provider.getBalance(
      BondingCurvePhaseOne.address
    );
    const tokenOwnerBeforeBalance = await ethers.provider.getBalance(
      tokenOwner.address
    );
    const receipt = await tokenOwner.BondingCurvePhaseOne.withdrawETH();
    const tokenOwnerAfterBalance = await ethers.provider.getBalance(
      tokenOwner.address
    );

    const gasCost = await calcGas(receipt);

    // check owner got balance of phase one
    expect(
      beforeBalancePhaseOne.add(tokenOwnerBeforeBalance).sub(gasCost)
    ).to.be.equal(tokenOwnerAfterBalance);
  });
});
