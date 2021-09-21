import {getNamedAccounts, ethers, getUnnamedAccounts} from 'hardhat';
import {isAddress, getAddress} from 'ethers/lib/utils';
import {Contract} from 'ethers';

export async function addr(address: string): Promise<string> {
  if (isAddress(address)) {
    return getAddress(address);
  }

  const namedAccounts = await getNamedAccounts();
  if (address in namedAccounts) {
    return namedAccounts[address];
  }

  const accounts = await getUnnamedAccounts();
  const accountIndex = parseInt(address);
  if (accounts[accountIndex] !== undefined) {
    return accounts[accountIndex];
  }
  throw `Could not normalize address: ${address}`;
}

export async function getNetworkName(network_id: string): Promise<string> {
  interface networkidToName {
    [network_id: string]: string;
  }
  const map: networkidToName = {
    '1': 'mainnet',
    '3': 'ropsten',
    '4': 'rinkeby',
    '5': 'goerly',
    '42': 'kovan',
  };
  return map[network_id];
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
