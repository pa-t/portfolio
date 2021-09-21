import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {STAKING_TAG, STAKING_ID, TOKEN_NAME} from '../scripts/utils/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  // RugStall requires address of the RugToken
  const RugToken = await deployments.get(TOKEN_NAME);

  // RugStall.sol args:
  // - ERC20Rug (address) _token,
  const args = [RugToken.address];

  //const useProxy = !hre.network.live;
  // proxy only in non-live network (localhost and hardhat network) enabling HCR (Hot Contract Replacement)
  // in live network, proxy is disabled and constructor is invoked
  await deploy(STAKING_TAG, {
    contract: STAKING_TAG,
    from: deployer,
    //proxy: useProxy && 'postUpgrade',
    args: args,
    log: true,
  });

  //return !useProxy; // when live network, record the script as executed to prevent rexecution
};
export default func;
func.id = STAKING_ID; // id required to prevent reexecution
func.tags = [STAKING_TAG]; // so deployments obj can search tagged deploys
func.dependencies = [TOKEN_NAME]; // must run first
