import hre from 'hardhat';
import {deployments, getNamedAccounts, ethers} from 'hardhat';
import '@nomiclabs/hardhat-etherscan';
import {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  BCPO_TAG,
  RUG_TARGET,
  WEI_TARGET,
} from './utils/constants';

// parse command line arg to determine what method to call
const args = process.argv.slice(1);
const contractToVerify = args[1];

async function main() {
  await deployments.all();

  // get tokenOwner account
  const {tokenOwner} = await getNamedAccounts();

  const PhaseOne = await ethers.getContract(BCPO_TAG);
  const RugToken = await ethers.getContract(TOKEN_NAME);

  switch (contractToVerify) {
    case TOKEN_NAME: {
      console.log('verifying RugToken on etherscan');
      await hre.run('verify:verify', {
        address: RugToken.address,
        constructorArguments: [TOKEN_NAME, TOKEN_SYMBOL, tokenOwner],
      });
      break;
    }
    case BCPO_TAG: {
      console.log('verifying Phase One on etherscan');
      await hre.run('verify:verify', {
        address: PhaseOne.address,
        constructorArguments: [
          RugToken.address,
          RUG_TARGET,
          WEI_TARGET,
          tokenOwner,
        ],
      });
      break;
    }
    default: {
      console.log('Skipped verification, please pass in RugToken or Phase One');
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
