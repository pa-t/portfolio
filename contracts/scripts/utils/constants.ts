// scripts/utils/constants.ts

import {parseEther} from 'ethers/lib/utils';

export const TOKEN_NAME = 'RugToken';
export const TOKEN_SYMBOL = 'RUG';
export const TOKEN_SYMBOL_LOWER = 'rug';

export const BCPO_TAG = 'BondingCurvePhaseOne';
export const BCPO_ID = 'bondingcurvephaseone';

export const TOKEN_SUPPLY = parseEther('300000000'); // 300,000,000 RUG, Total Supply
export const RUG_TARGET = parseEther('30000000'); // 30,000,000 RUG, Bonding Curve Phase One Target
export const WEI_TARGET = parseEther('10000'); // 10,000 ETH, Bonding Curve Phase One Target

export const STAKING_TAG = 'RugStall';
export const STAKING_ID = 'rugstall';

export const PBDA_TAG = 'PBDA';
export const PDBA_ID = 'physicallybackeddigitalasset';
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const PDBA_METADATA_URI = (process.env.PBDA_METADATA_URI! || 'localhost:3001') + '/metadata/';

export const AUCTION_TAG = 'Auction';
export const AUCTION_ID = 'auction';
export const AUCTION_FEE = 1;

export const SWAPBUYER_TAG = 'SwapBuyer';
export const SWAPBUYER_ID = 'swapbuyer';
