import {deployments, getNamedAccounts, ethers} from 'hardhat';
import {parseEther, formatEther} from 'ethers/lib/utils';

import {RugToken} from '../typechain';

import {addr, setupUser} from './utils';

import {TOKEN_NAME} from './utils/constants';

// const { execute } = deployments;
const args = process.argv.slice(2);
const fromAccount = args[0];
const toAccount = args[1];
const amount = args[2];

async function main() {
  await deployments.all();

  // parse args
  const fromAddress = await addr(fromAccount);
  const toAddress = await addr(toAccount);

  // token owner is default sender
  const {tokenOwner} = await getNamedAccounts();

  // basically same as setup() in tests
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
  };
  const sFromAccount = await setupUser(fromAddress, contracts);
  const sToAccount = await setupUser(toAddress, contracts);
  const RugToken = contracts[TOKEN_NAME];

  // // log current balances
  const fromBalance = await RugToken.balanceOf(sFromAccount.address);
  const toBalance = await RugToken.balanceOf(sToAccount.address);

  console.log('from:', tokenOwner, 'current:', formatEther(fromBalance));
  console.log('to:  ', toAddress, 'current:', formatEther(toBalance));

  console.log('\n', 'sending', amount, 'to', sToAccount.address, '...', '\n');
  const transactionReceipt = await sFromAccount.RugToken.transfer(
    sToAccount.address,
    parseEther(amount)
  );

  console.log('waiting for confirmations...');
  await transactionReceipt.wait(1);

  const afterFromBalance = await RugToken.balanceOf(sFromAccount.address);
  const afterToBalance = await RugToken.balanceOf(sToAccount.address);
  console.log('from:', tokenOwner, 'current:', formatEther(afterFromBalance));
  console.log('to:  ', toAddress, 'current:', formatEther(afterToBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
