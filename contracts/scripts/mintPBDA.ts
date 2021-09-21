import {deployments, getNamedAccounts, ethers} from 'hardhat';

import {PBDA} from '../typechain';

import {addr, setupUser} from './utils';

import {PBDA_TAG} from './utils/constants';

// const { execute } = deployments;
const args = process.argv.slice(2);
const toAccount = args[0];
const tokenURI = args[1];

async function main() {
  await deployments.all();

  // parse args
  const toAddress = await addr(toAccount);

  // token owner is default sender
  const {tokenOwner} = await getNamedAccounts();

  // basically same as setup() in tests
  const contracts = {
    PBDA: <PBDA>await ethers.getContract(PBDA_TAG),
  };
  const connectedOwner = await setupUser(tokenOwner, contracts);
  const connectedToAccount = await setupUser(toAddress, contracts);

  const transactionReceipt = await connectedOwner.PBDA.mintDeed(
    connectedToAccount.address,
    tokenURI
  );

  console.log('waiting for confirmations...');
  await transactionReceipt.wait(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
