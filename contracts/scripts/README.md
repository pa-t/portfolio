## To run scripts:

```
yarn execute <network> <file.ts> [args...]
```

List of networks available in `hardhat.config.ts`:

- hardhat, localhost, staging(rinkeby), production(mainnet), mainnet, rinkeby, kovan, goerli

---

## Commands

**Send Ether**
Options \_ADDRESS: `tokenOwner` `deployer` `1-18` (for unnamed accounts) `0x.........`

```
yarn execute <network> scripts/sendEther.ts <FROM_ADDRESS> <TO_ADDRESS> <INT_AMOUNT>
```

**Send Rug**
Options \_ADDRESS: `tokenOwner` `deployer` `1-18` (for unnamed accounts) `0x.........`

```
yarn execute <network> scripts/sendEther.ts <FROM_ADDRESS> <TO_ADDRESS> <INT_AMOUNT>
```

**Get Balance**
Options TOKEN: `RUG` `ETH`
Options 0X_ADDRESS: `deployer` `tokenOwner` `1-18` (for unnamed accounts) `0x.........`

```
yarn execute <network> scripts/getBalance.ts <TOKEN> <0X_ADDRESS>
```

**Verify Contract on Etherscan:**

Options: `RugToken` `BondingCurvePhaseOne`

```
yarn execute <network> scripts/etherscanVerify.ts <CONTRACT_TAG>
```

**Interact with BondingCurvePhaseOne:**
Options ADDRESS: `tokenOwner` `deployer` `1-18` (for unnamed accounts) `0x.........`
Options PHASE_ONE_FUNC: `buyFromPhaseOne` `fundPhaseOne` `startSale` `pauseSale` `endSale` `withdrawETH` `rugBurn`
Options AMOUNT (only read for buyFromPhaseOne): `number`

```
yarn execute <network> scripts/interactPhaseOne.ts <ADDRESS> <PHASE_ONE_FUNC> <AMOUNT>
```

---

## Examples

**Eg. Persistant Node:**

Term 1:

```
yarn dev
```

Term 2:

```
yarn execute localhost scripts/sendEther.ts <0X_ADDRESS> <INT_AMOUNT>
```

---

**Ex. Deploying RugToken and BondingCurvePhaseOne contracts and interacting with BondingCurvePhaseOne:**

Deploy contracts to desired network:

```
yarn deploy <network>
```

Fund Bonding Curve Phase One:

```
yarn execute <network> scripts/interactPhaseOne.ts fundPhaseOne
```

Start BondingCurvePhaseOne:

```
yarn execute <network> scripts/interactPhaseOne.ts startSale
```

Now Bonding Curve Phase One is funded and started, can now make calls to buy from phase one or use `scripts/interactPhaseOne.ts` to call other admin functions
