import {deployments, ethers} from 'hardhat';
import {parseEther} from 'ethers/lib/utils';

import {BondingCurvePhaseOne, RugToken} from '../typechain';

import {addr, setupUser} from './utils';

import {TOKEN_NAME, BCPO_TAG, RUG_TARGET} from './utils/constants';

// parse command line arg to determine what method to call
const args = process.argv.slice(2);
const addressArg = args[0];
const functionToCall = args[1];
const buyAmountArg = args[2];

async function main() {
  await deployments.all();

  const account = await addr(addressArg);
  const buyAmount = buyAmountArg;

  // get contracts and set up with signers
  const contracts = {
    BondingCurvePhaseOne: <BondingCurvePhaseOne>(
      await ethers.getContract(BCPO_TAG)
    ),
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
  };
  const sAccount = await setupUser(account, contracts);

  switch (functionToCall) {
    case 'buyFromPhaseOne': {
      console.log('buying from Bonding Curve Phase One');
      const buyReceipt = await sAccount.BondingCurvePhaseOne.buy({
        value: parseEther(buyAmount),
      });
      console.log(buyReceipt);
      break;
    }
    case 'fundPhaseOne': {
      console.log('funding Bonding Curve Phase One...');
      const fundReceipt = await sAccount.RugToken.transfer(
        contracts.BondingCurvePhaseOne.address,
        RUG_TARGET
      );
      console.log(fundReceipt);
      break;
    }
    case 'startSale': {
      console.log('starting sale...');
      const startReceipt = await sAccount.BondingCurvePhaseOne.startSale();
      await startReceipt.wait(1);
      console.log('sale started!');
      break;
    }
    case 'pauseSale': {
      console.log('pausing sale...');
      const pauseReceipt = await sAccount.BondingCurvePhaseOne.pauseSale();
      await pauseReceipt.wait(1);
      console.log('sale paused!');
      break;
    }
    case 'endSale': {
      console.log('ending sale...');
      const endReceipt = await sAccount.BondingCurvePhaseOne.endSale();
      await endReceipt.wait(1);
      console.log('sale ended!');
      break;
    }
    case 'withdrawETH': {
      console.log('withdrawing eth...');
      const withdrawReceipt = await sAccount.BondingCurvePhaseOne.withdrawETH();
      console.log(withdrawReceipt);
      break;
    }
    case 'rugBurn': {
      console.log('burning rug...');
      const burnReceipt = await sAccount.BondingCurvePhaseOne.rugBurn();
      console.log(burnReceipt);
      break;
    }
    default: {
      console.log('Skipped, please pass in one of:');
      console.log(
        '  [ buyFromPhaseOne, fundPhaseOne, startSale, pauseSale, endSale, withdrawETH, rugBurn ]'
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
