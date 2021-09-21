import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {
  RUG_TARGET,
  WEI_TARGET,
  BCPO_TAG,
  BCPO_ID,
  TOKEN_NAME,
} from '../scripts/utils/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, tokenOwner} = await getNamedAccounts();

  // BondingCurvePhaseOne contract requires address of contract
  const RugToken = await deployments.get(TOKEN_NAME);

  // BondingCurvePhaseOne.sol args:
  // - ERC20PresetMinterPauser (address) _token,
  // - uint256 _rugTarget,
  // - uint256 _weiTarget
  // - address owner
  const args = [RugToken.address, RUG_TARGET, WEI_TARGET, tokenOwner];

  //const useProxy = !hre.network.live;
  // proxy only in non-live network (localhost and hardhat network) enabling HCR (Hot Contract Replacement)
  // in live network, proxy is disabled and constructor is invoked
  await deploy(BCPO_TAG, {
    contract: BCPO_TAG,
    from: deployer,
    //proxy: useProxy && 'postUpgrade',
    args: args,
    log: true,
  });

  //return !useProxy; // when live network, record the script as executed to prevent rexecution
};
export default func;
func.id = BCPO_ID; // id required to prevent reexecution
func.tags = [BCPO_TAG]; // so deployments obj can search tagged deploys
func.dependencies = [TOKEN_NAME]; // must run first
