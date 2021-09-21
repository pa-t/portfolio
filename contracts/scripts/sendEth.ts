import {deployments, ethers} from 'hardhat';
import {parseEther, formatEther} from 'ethers/lib/utils';

import {addr} from './utils';

const args = process.argv.slice(2);
const fromAccount = args[0];
const toAccount = args[1];
const amount = args[2];

async function main() {
  await deployments.all();

  // parse args
  const fromAddress = await addr(fromAccount);
  const toAddress = await addr(toAccount);

  // log current balances
  const fromBalance = await ethers.provider.getBalance(fromAddress);
  const toBalance = await ethers.provider.getBalance(toAddress);

  console.log('from:', fromAddress, 'current:', formatEther(fromBalance));
  console.log('to:  ', toAddress, 'current:', formatEther(toBalance));

  console.log();

  const fromSigner = await ethers.provider.getSigner(fromAddress);
  const transactionReceipt = await fromSigner.sendTransaction({
    to: toAddress,
    value: parseEther(amount),
  });

  console.log('\n', 'sending', amount, 'to', toAddress, '...', '\n');

  console.log('waiting for confirmations...');
  await transactionReceipt.wait(1);

  // log after balances
  const fromAfterBalance = await ethers.provider.getBalance(fromAddress);
  const toAfterBalance = await ethers.provider.getBalance(toAddress);

  console.log('from:', fromAddress, 'current:', formatEther(fromAfterBalance));
  console.log('to:  ', toAddress, 'current:', formatEther(toAfterBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
