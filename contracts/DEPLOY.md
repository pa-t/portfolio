# Real Deploy Run

- fund deployer & multisig with ETH

- setup gnosis safe
- add gnosis safe address as hardhat.config.ts tokenOwner for mainnet
- yarn deploy [network]
- verify etherscan manually
- run etherscanVerify script

  - yarn execute [network] scripts/etherscanVerify.ts RugToken
  - yarn execute [network] scripts/etherscanVerify.ts BondingCurvePhaseOne

In Address Book, add:

- RugToken - CONTRACT
- BondingCurvePhaseOne - CONTRACT

In Gnosis-safe transaction:

- Select RugToken - CONTRACT
- Method - transfer
- recipient - bonding curve addr
- amount - 30000000000000000000000000
  - aka total supply with 1 less 0.
  - (10%)
