import {BigNumber, Contract} from 'ethers';
import {ethers} from 'hardhat';
import {ContractTransaction} from '@ethersproject/contracts';

export async function setupUsers<T extends {[contractName: string]: Contract}>(
  addresses: string[],
  contracts: T
): Promise<({address: string} & T)[]> {
  const users: ({address: string} & T)[] = [];
  for (const address of addresses) {
    users.push(await setupUser(address, contracts));
  }
  return users;
}

export async function setupUser<T extends {[contractName: string]: Contract}>(
  address: string,
  contracts: T
): Promise<{address: string} & T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = {address};
  for (const key of Object.keys(contracts)) {
    user[key] = contracts[key].connect(await ethers.getSigner(address));
  }
  return user as {address: string} & T;
}

export async function calcGas(tx: ContractTransaction): Promise<BigNumber> {
  const GAS_PRICE = await ethers.provider.getGasPrice();
  const gasUsed = (await ethers.provider.getTransactionReceipt(tx.hash))
    .cumulativeGasUsed;
  return GAS_PRICE.mul(gasUsed);
}

export async function calcRugFee(
  amount: BigNumber,
  feePercent: number
): Promise<BigNumber> {
  return amount.mul(BigNumber.from(feePercent)).div(BigNumber.from(100));
}
