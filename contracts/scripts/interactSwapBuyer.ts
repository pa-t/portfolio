import {deployments, ethers} from 'hardhat';
import {parseEther} from 'ethers/lib/utils';
import {ArgumentConfig, parse} from 'ts-command-line-args';

import {SwapBuyer, RugToken} from '../typechain';

import {addr, setupUser} from './utils';

import {TOKEN_NAME, SWAPBUYER_TAG} from './utils/constants';

// parse command line arg to determine what method to call
interface ICommandLineArgs {
  functionName: string;
  address: string;
  amount: string;
}

const CommandLineArgsConfig: ArgumentConfig<ICommandLineArgs> = {
  functionName: String,
  address: String,
  amount: {type: String, defaultValue: '1'},
};

const args: ICommandLineArgs = parse<ICommandLineArgs>(CommandLineArgsConfig);

async function main() {
  await deployments.all();

  const account = await addr(args['address']);
  const accountSigner = ethers.provider.getSigner(account);

  // get contracts and set up with signers
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    SwapBuyer: <SwapBuyer>await ethers.getContract(SWAPBUYER_TAG),
  };
  const connectedAccount = await setupUser(account, contracts);

  switch (args['functionName']) {
    case 'buyFromSwap': {
      console.log('buying from swap...');
      const txReceipt = await connectedAccount.SwapBuyer.buyFromSwap(
        {value: parseEther(args.amount)}
      );
      console.log(txReceipt);
      break;
    }
    case 'sendToContract': {
      console.log('buying from swap...');
      const txReceipt = await accountSigner.sendTransaction({
        to: contracts.SwapBuyer.address,
        value: parseEther(args.amount),
      });
      console.log(txReceipt);
      break;
    }
    default: {
      console.log('Skipped, please pass in one of:');
      console.log(
        ' [ buyFromSwap, sendToContract ]'
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
