import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {
  AUCTION_TAG,
  AUCTION_ID,
  AUCTION_FEE,
  TOKEN_NAME,
  SWAPBUYER_TAG,
} from '../scripts/utils/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, tokenOwner} = await getNamedAccounts();

  // InitialAuction contract requires address of contract
  const RugToken = await deployments.get(TOKEN_NAME);
  const SwapBuyer = await deployments.get(SWAPBUYER_TAG);

  // Auction.sol args:
  // - ERC20RugToken (address) _token,
  // - address feeRecipient
  // - uint256 feePercent
  // - address owner
  const args = [RugToken.address, SwapBuyer.address, AUCTION_FEE, tokenOwner];

  //const useProxy = !hre.network.live;
  // proxy only in non-live network (localhost and hardhat network) enabling HCR (Hot Contract Replacement)
  // in live network, proxy is disabled and constructor is invoked
  await deploy(AUCTION_TAG, {
    contract: AUCTION_TAG,
    from: deployer,
    //proxy: useProxy && 'postUpgrade',
    args: args,
    log: true,
  });

  //return !useProxy; // when live network, record the script as executed to prevent rexecution
};
export default func;
func.id = AUCTION_ID; // id required to prevent reexecution
func.tags = [AUCTION_TAG]; // so deployments obj can search tagged deploys
func.dependencies = [TOKEN_NAME, SWAPBUYER_TAG]; // must run first
