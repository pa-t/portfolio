import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {TOKEN_NAME, TOKEN_SYMBOL} from '../scripts/utils/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, tokenOwner} = await getNamedAccounts();

  // RugToken.sol args:
  // - string memory name,
  // - string memory symbol,
  // - address owner
  const args = [TOKEN_NAME, TOKEN_SYMBOL, tokenOwner];

  await deploy(TOKEN_NAME, {
    contract: TOKEN_NAME,
    from: deployer,
    args: args,
    log: true,
  });
};
export default func;
func.tags = [TOKEN_NAME];
