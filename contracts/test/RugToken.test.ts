import {parseEther} from 'ethers/lib/utils';
import {expect} from './chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {RugToken} from '../typechain';
import {setupUser, setupUsers} from './utils';

import {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_SUPPLY,
} from '../scripts/utils/constants';

const setup = deployments.createFixture(async () => {
  await deployments.fixture(TOKEN_NAME);
  const {tokenOwner} = await getNamedAccounts();
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    tokenOwner: await setupUser(tokenOwner, contracts),
  };
});

describe('RugToken Spec', function () {
  // 1. test name
  it('has correct name', async function () {
    const {RugToken} = await setup();
    expect(await RugToken.name()).to.equal(TOKEN_NAME);
  });

  // 2. test symbol
  it('has correct symbol', async function () {
    const {RugToken} = await setup();
    expect(await RugToken.symbol()).to.equal(TOKEN_SYMBOL);
  });

  // 3. test supply
  it('total supply is equal to initial supply', async function () {
    const {RugToken} = await setup();
    expect(await RugToken.totalSupply()).to.equal(TOKEN_SUPPLY);
  });

  // 4. test decimals
  it('decimal is assumed value of 18', async function () {
    const {RugToken} = await setup();
    expect(await RugToken.decimals()).to.equal(18);
  });
});

describe('RugToken transfers', function () {
  // 1. Cannot transfer if don't have the balance
  it('transfer fails when not enough balance', async function () {
    const {users} = await setup();
    await expect(
      users[0].RugToken.transfer(users[1].address, 1)
    ).to.be.revertedWith('transfer amount exceeds balance');
  });

  // 2. test transfer works in 'correct' usage
  it('should work in typical use case', async function () {
    // inital state: owner: 300 million, alice 0
    const {RugToken, users, tokenOwner} = await setup();

    // before state
    const ALICE = users[0];
    const aliceBeforeBalance = await RugToken.balanceOf(ALICE.address);
    expect(aliceBeforeBalance).to.equal('0');

    const ownerBeforeBalance = await RugToken.balanceOf(tokenOwner.address);
    expect(ownerBeforeBalance).to.equal(TOKEN_SUPPLY);

    // action: transfer 300 RUG from owner to Alice
    const TRANSFER_AMOUNT = parseEther('300');
    await tokenOwner.RugToken.transfer(ALICE.address, TRANSFER_AMOUNT);

    // expected state: owner == 300 mil - 300 RUG
    // //                       => 299,999,700
    // //                 alice == 300 RUG
    const aliceAfterBalance = await RugToken.balanceOf(ALICE.address);
    const ownerAfterBalance = await RugToken.balanceOf(tokenOwner.address);

    expect(aliceAfterBalance).to.equal(aliceBeforeBalance.add(TRANSFER_AMOUNT));
    expect(ownerAfterBalance).to.equal(ownerBeforeBalance.sub(TRANSFER_AMOUNT));
  });

  // Ensure total supply never altered
  it('should not alter token supply', async function () {
    const {RugToken, users, tokenOwner} = await setup();

    const ALICE = users[0];
    const TRANSFER_AMOUNT = parseEther('300');

    await tokenOwner.RugToken.transfer(ALICE.address, TRANSFER_AMOUNT);

    expect(await RugToken.totalSupply()).to.equal(TOKEN_SUPPLY);
  });
});

describe('RugToken burn', function () {
  it('burn reduces total supply', async function () {
    const {RugToken, users, tokenOwner} = await setup();

    const ALICE = users[0];
    const BOB = users[1];

    expect(await RugToken.totalSupply()).to.equal(TOKEN_SUPPLY);

    // Alice and Bob start with 300 rug each
    const INIT_BAL = parseEther('300');
    await tokenOwner.RugToken.transfer(ALICE.address, INIT_BAL);
    await tokenOwner.RugToken.transfer(BOB.address, INIT_BAL);

    expect(await RugToken.balanceOf(ALICE.address)).to.equal(INIT_BAL);
    expect(await RugToken.balanceOf(BOB.address)).to.equal(INIT_BAL);

    // Alice burns 100 rug
    const ALICE_BURN = parseEther('100');
    await ALICE.RugToken.burn(ALICE_BURN);
    expect(await RugToken.balanceOf(ALICE.address)).to.equal(
      INIT_BAL.sub(ALICE_BURN)
    );

    // Bob burns 200 rug
    const BOB_BURN = parseEther('200');
    await BOB.RugToken.burn(BOB_BURN);
    expect(await RugToken.balanceOf(BOB.address)).to.equal(
      INIT_BAL.sub(BOB_BURN)
    );

    // Supply = init supply - 300 rug
    const TOTAL_BURN = ALICE_BURN.add(BOB_BURN);
    expect(await RugToken.totalSupply()).to.equal(TOKEN_SUPPLY.sub(TOTAL_BURN));
  });
});

describe('RugToken events', function () {
  it('should emit an event on transfer', async function () {
    const {RugToken, users, tokenOwner} = await setup();
    await expect(
      tokenOwner.RugToken.transfer(users[0].address, parseEther('1'))
    )
      .to.emit(RugToken, 'Transfer')
      .withArgs(tokenOwner.address, users[0].address, parseEther('1'));
  });

  it('should emit an event on burn', async function () {
    const {RugToken, tokenOwner} = await setup();
    await expect(tokenOwner.RugToken.burn(parseEther('1')))
      .to.emit(RugToken, 'Transfer')
      .withArgs(
        tokenOwner.address,
        '0x0000000000000000000000000000000000000000',
        parseEther('1')
      );
    await expect(tokenOwner.RugToken.burn(parseEther('1')))
      .to.emit(RugToken, 'Burn')
      .withArgs(
        tokenOwner.address,
        '0x0000000000000000000000000000000000000000',
        parseEther('1')
      );
  });
});
