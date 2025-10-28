export const DEBRIDGE_WIDGET_ELEMENT_ID = "debridgeWidget"
export const DEBRIDGE_SCRIPT_SRC =
  "https://app.debridge.finance/assets/scripts/widget.js"

export const AFFILIATE_EVM_RECIPIENT =
  "0x36e1330847b5a8362ee11921637E92bA83249742" as const

export const AFFILIATE_DEFAULT_PERCENT = 0.1

export const STAKING_MIN_ZIL = 20_000

export const REFERRAL_CODE = 32608

export const ZIL_EVM_RPC = "https://ssn.zilpay.io/api" as const

export const ELIGIBILITY_POOLS = [
  {
    name: "Amazing Pool",
    proxy: "0x1f0e86Bc299Cc66df2e5512a7786C3F528C0b5b6",
  },
  {
    name: "2ZilMoon",
    proxy: "0xCDb0B23Db1439b28689844FD093C478d73C0786A",
  },
] as const

export const CHAIN = {
  ETH: 1,
  BSC: 56,
  POLYGON: 137,
  FANTOM: 250,
  ZIL_EVM: 32769,
} as const

export const SUPPORTED_CHAINS_MIN = {
  inputChains: {
    1: "all",
    10: "all",
    56: "all",
    137: "all",
    42161: "all",
    43114: "all",
    8453: "all",
    59144: "all",
    80094: "all",
    32769: "all",
  },
  outputChains: {
    1: "all",
    10: "all",
    56: "all",
    137: "all",
    42161: "all",
    43114: "all",
    8453: "all",
    59144: "all",
    80094: "all",
    32769: "all",
  },
} as const

export const WIDGET_DEFAULTS = {
  v: "1",
  element: DEBRIDGE_WIDGET_ELEMENT_ID,
  mode: "deswap",
  theme: "dark",
  lang: "en",
  width: "100%",
  height: 780,

  outputChain: 32769,

  supportedChains: SUPPORTED_CHAINS_MIN,

  affiliateFeePercent: AFFILIATE_DEFAULT_PERCENT,
  affiliateFeeRecipient: AFFILIATE_EVM_RECIPIENT,
}
