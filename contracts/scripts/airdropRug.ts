import {deployments, ethers} from 'hardhat';
import {formatEther} from 'ethers/lib/utils';

import {RugToken, BondingCurvePhaseOne} from '../typechain';

import {createObjectCsvWriter} from 'csv-writer';

import {TOKEN_NAME, BCPO_TAG} from './utils/constants';

const csvWriter = createObjectCsvWriter({
  path: './data.csv',
  header: [
    {id: 'token_address', title: 'TOKEN ADDRESS'},
    {id: 'receiver', title: 'RECEIVER'},
    {id: 'amount', title: 'AMOUNT'},
  ],
});

const args = process.argv.slice(2);
const newMultiplier = Number(args[0]);

async function main() {
  await deployments.all();

  // basically same as setup() in tests
  const contracts = {
    RugToken: <RugToken>await ethers.getContract(TOKEN_NAME),
    PhaseOne: <BondingCurvePhaseOne>await ethers.getContract(BCPO_TAG),
  };

  const oldMultiplier: number = (
    await contracts.PhaseOne.multiplier()
  ).toNumber();
  const fixMultiplier: number = newMultiplier / oldMultiplier;

  const boughtFilter = contracts.PhaseOne.filters.Bought();
  const buys = await contracts.PhaseOne.queryFilter(boughtFilter);
  const records = [];
  for (const purchase in buys) {
    const purchaserAddress = buys[purchase].args.account;
    const purchasedAmount = formatEther(buys[purchase].args.amount);
    console.log('address:', purchaserAddress, 'bought:', purchasedAmount);

    const newAmount =
      Number(purchasedAmount) * fixMultiplier - Number(purchasedAmount);

    console.log('amount to airdrop:', newAmount);
    records.push({
      token_address: contracts.RugToken.address,
      receiver: purchaserAddress,
      amount: newAmount,
    });
  }
  await csvWriter.writeRecords(records);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
