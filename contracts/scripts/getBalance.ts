import {deployments, ethers} from 'hardhat';
import {formatEther} from 'ethers/lib/utils';

import {addr} from './utils';

import {TOKEN_NAME, TOKEN_SYMBOL, TOKEN_SYMBOL_LOWER} from './utils/constants';

const args = process.argv.slice(2);
const tokenArg = args[0];
const addressArg = args[1];

async function main() {
  await deployments.all();

  const address = await addr(addressArg);

  if (tokenArg === 'ETH' || tokenArg === 'eth') {
    const balance = await ethers.provider.getBalance(address);
    console.log(formatEther(balance), 'ETH');
  } else if (tokenArg === TOKEN_SYMBOL || tokenArg === TOKEN_SYMBOL_LOWER) {
    const RugToken = await ethers.getContract(TOKEN_NAME);
    const rugBalace = await RugToken.balanceOf(address);
    console.log(formatEther(rugBalace), TOKEN_SYMBOL);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
