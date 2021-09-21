import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {PBDA_TAG, PDBA_ID, PDBA_METADATA_URI} from '../scripts/utils/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, tokenOwner} = await getNamedAccounts();

  // PBDA.sol args:
  // - address owner
  const args = [tokenOwner, PDBA_METADATA_URI];

  await deploy(PBDA_TAG, {
    contract: PBDA_TAG,
    from: deployer,
    args: args,
    log: true,
  });
};
export default func;
func.id = PDBA_ID; // id required to prevent reexecution
func.tags = [PBDA_TAG];
