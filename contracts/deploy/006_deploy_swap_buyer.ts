import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {
  SWAPBUYER_TAG,
  SWAPBUYER_ID,
  TOKEN_NAME,
  BCPO_TAG,
  STAKING_TAG,
} from '../scripts/utils/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  // SwapBuyer contract requires address of contracts
  const RugToken = await deployments.get(TOKEN_NAME);
  const BondingCurvePhaseOne = await deployments.get(BCPO_TAG);
  const RugStall = await deployments.get(STAKING_TAG);

  const args = [RugToken.address, BondingCurvePhaseOne.address, RugStall.address];

  //const useProxy = !hre.network.live;
  // proxy only in non-live network (localhost and hardhat network) enabling HCR (Hot Contract Replacement)
  // in live network, proxy is disabled and constructor is invoked
  await deploy(SWAPBUYER_TAG, {
    contract: SWAPBUYER_TAG,
    from: deployer,
    //proxy: useProxy && 'postUpgrade',
    args: args,
    log: true,
  });

  //return !useProxy; // when live network, record the script as executed to prevent rexecution
};
export default func;
func.id = SWAPBUYER_ID; // id required to prevent reexecution
func.tags = [SWAPBUYER_TAG]; // so deployments obj can search tagged deploys
func.dependencies = [TOKEN_NAME, BCPO_TAG, STAKING_TAG]; // must run first
