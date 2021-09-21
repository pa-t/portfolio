import {deployments, ethers} from 'hardhat';
import {TOKEN_NAME, BCPO_TAG} from './utils/constants';

async function main() {
  await deployments.all();

  const RugToken = await ethers.getContract(TOKEN_NAME);
  const PhaseOne = await ethers.getContract(BCPO_TAG);

  console.log(TOKEN_NAME, RugToken.address);
  console.log(BCPO_TAG, PhaseOne.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
