import {expect} from './chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';

import {parseEther} from 'ethers/lib/utils';

import {BondingCurvePhaseOne, RugToken} from '../typechain';
import {setupUser, setupUsers, calcGas} from './utils';

import {
  TOKEN_NAME,
  BCPO_TAG,
  RUG_TARGET,
  WEI_TARGET,
} from '../scripts/utils/constants';

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

const ETH_PURCHASE = parseEther('2'); // 2 ETH
const RUG_AMOUNT = ETH_PURCHASE.mul(RUG_TARGET.div(WEI_TARGET));

// parseEther('30000'); // 30,000

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

describe('BondingCurvePhaseOne starting and pausing sale', function () {
  it('BondingCurvePhaseOne should revert start no balance', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup();

    await expect(
      tokenOwner.BondingCurvePhaseOne.startSale()
    ).to.be.revertedWith('Cannot start phase one with no balance.');

    expect(await BondingCurvePhaseOne.isActive()).to.be.false;

    await tokenOwner.RugToken.transfer(
      BondingCurvePhaseOne.address,
      RUG_TARGET
    );

    await tokenOwner.BondingCurvePhaseOne.startSale();

    expect(await BondingCurvePhaseOne.isActive()).to.be.true;
  });

  it('BondingCurvePhaseOne should start sale', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.startSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    // start the sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.true;

    // check revert
    await expect(
      tokenOwner.BondingCurvePhaseOne.startSale()
    ).to.be.revertedWith('Phase One already started!');
  });

  it('BondingCurvePhaseOne should pause sale', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();

    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check onlyOwner function
    await expect(users[0].BondingCurvePhaseOne.pauseSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    // pause the sale
    await tokenOwner.BondingCurvePhaseOne.pauseSale();

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('BondingCurvePhaseOne should revert pause sale not started', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();

    // check onlyOwner function
    await expect(
      tokenOwner.BondingCurvePhaseOne.pauseSale()
    ).to.be.revertedWith('Phase One not started!');

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });

  it('BondingCurvePhaseOne should revert pause sale ended', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start sale & end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    // check onlyOwner function
    await expect(
      tokenOwner.BondingCurvePhaseOne.pauseSale()
    ).to.be.revertedWith('Cannot pause ended sale!');

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;
  });
});

describe('Buy from BondingCurvePhaseOne', function () {
  it('BondingCurvePhaseOne should revert buy when not started', async function () {
    const {users} = await setup_phase_one();
    // check cannot buy before start of sale
    await expect(users[0].BondingCurvePhaseOne.buy()).to.be.revertedWith(
      'Phase One has not yet started!'
    );
  });

  it('should buy from phase one [ @skip-on-coverage ]', async function () {
    const {users, RugToken, BondingCurvePhaseOne, tokenOwner} =
      await setup_phase_one();

    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // get eth balance of buyer before buying from contract
    const beforeBalance = await ethers.provider.getBalance(users[0].address);

    // users[0] makes a purchase
    const receipt = await users[0].BondingCurvePhaseOne.buy({
      value: ETH_PURCHASE,
    });

    const gasCost = await calcGas(receipt);

    const afterBalance = await ethers.provider.getBalance(users[0].address);

    // check the correct amount of ETH has been spent
    expect(beforeBalance.sub(afterBalance).sub(gasCost)).to.be.equal(
      ETH_PURCHASE
    );

    // check user recieved correct amount of RUG
    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(RUG_AMOUNT);

    // check BondingCurvePhaseOne contract was paid correct amount
    expect(
      await ethers.provider.getBalance(BondingCurvePhaseOne.address)
    ).to.be.equal(ETH_PURCHASE);
  });

  it('should revert if purchase too large', async function () {
    const {users, tokenOwner} = await setup_phase_one();

    // pre-req: start sale & have less than initial RUG balance
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});

    const userThreeSigner = await ethers.provider.getSigner(users[3].address);
    await userThreeSigner.sendTransaction({
      to: users[1].address,
      value: parseEther('3000'),
    });
    // tries to buy 30,000,000 after 30,000 already purchased
    await expect(
      users[1].BondingCurvePhaseOne.buy({value: WEI_TARGET})
    ).to.be.revertedWith('Exceeds amount available!');
  });
});

describe('End BondingCurvePhaseOne', function () {
  it('should revert not owner', async function () {
    const {users, tokenOwner} = await setup_phase_one();
    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.endSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('BondingCurvePhaseOne should revert withdraw when not ended', async function () {
    const {tokenOwner} = await setup_phase_one();
    // check end logic, cant withdraw eth if still active
    await expect(
      tokenOwner.BondingCurvePhaseOne.withdrawETH()
    ).to.be.revertedWith('Sale not ended!');
  });

  it('BondingCurvePhaseOne should revert burn when not ended', async function () {
    const {tokenOwner} = await setup_phase_one();
    // check end logic, cant burn if still active
    await expect(tokenOwner.BondingCurvePhaseOne.rugBurn()).to.be.revertedWith(
      'Sale not ended!'
    );
  });

  it('BondingCurvePhaseOne should revert burn when not ended', async function () {
    const {tokenOwner} = await setup_phase_one();
    // check end logic, cant burn if still active
    await expect(tokenOwner.BondingCurvePhaseOne.endSale()).to.be.revertedWith(
      'Phase One not started!'
    );
  });

  it('BondingCurvePhaseOne should end', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.endSale()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    // end the sale
    tokenOwner.BondingCurvePhaseOne.endSale();

    // check to make sure bool set correct
    expect(await BondingCurvePhaseOne.isActive()).to.be.false;

    // check revert
    await expect(tokenOwner.BondingCurvePhaseOne.endSale()).to.be.revertedWith(
      'Sale already ended!'
    );

    // check restart revert
    await expect(
      tokenOwner.BondingCurvePhaseOne.startSale()
    ).to.be.revertedWith('Cannot restart sale!');

    // check cant buy after ending
    await expect(
      users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE})
    ).to.be.revertedWith('Phase One has not yet started!');
  });
});

describe('BondingCurvePhaseOne Burn', function () {
  it('should revert not owner', async function () {
    const {users} = await setup_phase_one();
    // check onlyOwner modifier
    await expect(users[0].BondingCurvePhaseOne.rugBurn()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('BondingCurvePhaseOne should burn', async function () {
    const {users, RugToken, BondingCurvePhaseOne, tokenOwner} =
      await setup_phase_one();
    // pre-req: start sale, buy some, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});
    await tokenOwner.BondingCurvePhaseOne.endSale();

    const beforeSupply = await RugToken.totalSupply();
    const beforeBalance = await RugToken.balanceOf(
      BondingCurvePhaseOne.address
    );
    await tokenOwner.BondingCurvePhaseOne.rugBurn();
    const afterSupply = await RugToken.totalSupply();
    const afterBalance = await RugToken.balanceOf(BondingCurvePhaseOne.address);

    // balance of the phase one contract should be zero after burning unsold supply
    expect(afterBalance).to.be.equal(0);

    // check supply is only missing remaining balance of phase one
    expect(beforeSupply.sub(afterSupply)).to.be.equal(beforeBalance);

    // check user balance not affected by burn
    expect(await RugToken.balanceOf(users[0].address)).to.be.equal(RUG_AMOUNT);
  });
});

describe('BondingCurvePhaseOne withdraw eth', function () {
  it('BondingCurvePhaseOne should revert not owner', async function () {
    const {users, tokenOwner} = await setup_phase_one();
    // pre-req: start sale, buy some, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});
    await tokenOwner.BondingCurvePhaseOne.endSale();

    // check onlyOwner modifier
    await expect(
      users[0].BondingCurvePhaseOne.withdrawETH()
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('BondingCurvePhaseOne should revert withdraw not ended', async function () {
    const {users, tokenOwner} = await setup_phase_one();
    // pre-req: start sale, buy some, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});

    await expect(
      tokenOwner.BondingCurvePhaseOne.withdrawETH()
    ).to.be.revertedWith('Sale not ended');
  });

  it('BondingCurvePhaseOne should revert withdraw not ended', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start sale, buy some, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});
    await tokenOwner.BondingCurvePhaseOne.endSale();

    const beforeBalancePhaseOne = await ethers.provider.getBalance(
      BondingCurvePhaseOne.address
    );
    await tokenOwner.BondingCurvePhaseOne.withdrawETH();
    const afterBalancePhaseOne = await ethers.provider.getBalance(
      BondingCurvePhaseOne.address
    );

    expect(beforeBalancePhaseOne.add(afterBalancePhaseOne)).to.be.equal(
      ETH_PURCHASE
    );
  });

  it('BondingCurvePhaseOne should be able to withdraw earned eth [ @skip-on-coverage ]', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();
    // pre-req: start sale, buy some, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});
    await tokenOwner.BondingCurvePhaseOne.endSale();

    const beforeBalanceOwner = await ethers.provider.getBalance(
      tokenOwner.address
    );
    const beforeBalancePhaseOne = await ethers.provider.getBalance(
      BondingCurvePhaseOne.address
    );
    const receipt = await tokenOwner.BondingCurvePhaseOne.withdrawETH();
    const afterBalanceOwner = await ethers.provider.getBalance(
      tokenOwner.address
    );
    const afterBalancePhaseOne = await ethers.provider.getBalance(
      BondingCurvePhaseOne.address
    );

    const gasCost = await calcGas(receipt);

    // balance of the phase one contract should be zero after burning unsold supply
    expect(afterBalancePhaseOne).to.be.equal(0);

    // check owner got balance of phase one
    expect(
      beforeBalancePhaseOne.add(beforeBalanceOwner).sub(gasCost)
    ).to.be.equal(afterBalanceOwner);
  });
});

describe('BondingCurvePhaseOne events', function () {
  it('should emit event on start sale', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();

    // check to make sure event is emitted
    await expect(tokenOwner.BondingCurvePhaseOne.startSale())
      .to.emit(BondingCurvePhaseOne, 'Start')
      .withArgs(tokenOwner.address);
  });
  it('should emit event on pause sale', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();

    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check to make sure event is emitted
    await expect(tokenOwner.BondingCurvePhaseOne.pauseSale())
      .to.emit(BondingCurvePhaseOne, 'Pause')
      .withArgs(tokenOwner.address);
  });
  it('should emit event on end sale', async function () {
    const {BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();

    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check to make sure event is emitted
    await expect(tokenOwner.BondingCurvePhaseOne.endSale())
      .to.emit(BondingCurvePhaseOne, 'End')
      .withArgs(tokenOwner.address);
  });
  it('should emit event on buy', async function () {
    const {RugToken, users, BondingCurvePhaseOne, tokenOwner} =
      await setup_phase_one();

    // pre-req: start sale
    await tokenOwner.BondingCurvePhaseOne.startSale();

    // check to make sure event is emitted
    await expect(users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE}))
      .to.emit(BondingCurvePhaseOne, 'Bought')
      .withArgs(users[0].address, await RugToken.balanceOf(users[0].address));
  });
  it('should emit event on withdraw', async function () {
    const {users, BondingCurvePhaseOne, tokenOwner} = await setup_phase_one();

    // pre-req: start sale, buy some, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await users[0].BondingCurvePhaseOne.buy({value: ETH_PURCHASE});
    await tokenOwner.BondingCurvePhaseOne.endSale();

    // get eth balance of contract
    const ethBalance = await ethers.provider.getBalance(
      BondingCurvePhaseOne.address
    );

    // check to make sure event is emitted
    await expect(tokenOwner.BondingCurvePhaseOne.withdrawETH())
      .to.emit(BondingCurvePhaseOne, 'Withdraw')
      .withArgs(tokenOwner.address, ethBalance);
  });
  it('should emit event on burn', async function () {
    const {RugToken, BondingCurvePhaseOne, tokenOwner} =
      await setup_phase_one();

    // pre-req: start sale, end sale
    await tokenOwner.BondingCurvePhaseOne.startSale();
    await tokenOwner.BondingCurvePhaseOne.endSale();

    // get token balance of phase one contract
    const tokenBalance = await RugToken.balanceOf(BondingCurvePhaseOne.address);

    // check to make sure event is emitted
    await expect(tokenOwner.BondingCurvePhaseOne.rugBurn())
      .to.emit(BondingCurvePhaseOne, 'Burn')
      .withArgs(tokenOwner.address, tokenBalance);
  });
});
