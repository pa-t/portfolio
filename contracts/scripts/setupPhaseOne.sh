#!/bin/bash
declare -a networks=("localhost" "hardhat" "ropsten" "rinkeby" "mainnet")

echo "what network to deploy to? "
read network

if grep -q "${network}" <<< "${networks[*]}" ; then
  echo "${network} selected, proceed? [y/n]: "
  read ans
else
  echo "network not recognized"
  exit
fi

if [[ "${ans::1}" != "y" ]] ; then
  exit
fi


# check balances
echo "checking deployer eth balance..."
yarn execute ${network} scripts/getBalance.ts ETH deployer

echo "checking tokenOwner eth balance..."
yarn execute ${network} scripts/getBalance.ts ETH tokenOwner

echo "sufficient balance to proceed? [y/n]: "
read ans
if [[ "${ans::1}" != "y" ]] ; then
  exit
fi


# deploy, run tests (coverage runs locally), verify contracts
echo "deploying..."
yarn deploy ${network} --reset

echo "running coverage..."
yarn run coverage

echo "running tests..."
if [[ "${network}" == "hardhat" || "${network}" == "localhost" ]] ; then
  yarn test ${network}
else
  yarn fork:test ${network}
fi

if [[ "${network}" != "hardhat" && "${network}" != "localhost" ]] ; then
  echo "verifying RugToken..."
  yarn execute ${network} scripts/etherscanVerify.ts RugToken

  echo "verifying Phase One..."
  yarn execute ${network} scripts/etherscanVerify.ts BondingCurvePhaseOne
fi


# fund BondingCurvePhaseOne and then start sale
echo "fund Phase One? [y/n]: "
read ans
if [[ "${ans::1}" == "y" ]] ; then
  echo "funding BondingCurvePhaseOne..."
  yarn execute ${network} scripts/interactPhaseOne.ts tokenOwner fundPhaseOne
else
  echo "exiting..."
  exit
fi

echo "start Phase One? [y/n]: "
read ans
if [[ "${ans::1}" == "y" ]] ; then
  echo "starting BondingCurvePhaseOne..."
  yarn execute ${network} scripts/interactPhaseOne.ts tokenOwner startSale
else
  echo "exiting..."
  exit
fi
