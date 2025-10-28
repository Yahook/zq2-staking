import { useEffect, useRef, useCallback, useState } from "react"
import {
  AFFILIATE_DEFAULT_PERCENT,
  AFFILIATE_EVM_RECIPIENT,
  DEBRIDGE_SCRIPT_SRC,
  REFERRAL_CODE,
  WIDGET_DEFAULTS,
  DEBRIDGE_WIDGET_ELEMENT_ID,
  STAKING_MIN_ZIL,
} from "@/misc/bridgeConfig"
import { isEligibleForZeroFee } from "@/misc/stakingChecker"
import { WalletConnector } from "@/contexts/walletConnector"

type DeBridgeWidget = {
  on: (eventName: string, cb: (...args: unknown[]) => void) => void
  setAffiliateFee: (cfg: {
    evm?: { affiliateFeePercent: string; affiliateFeeRecipient: string }
    solana?: { affiliateFeePercent: string; affiliateFeeRecipient: string }
  }) => void
  destroy?: () => void
}

declare global {
  interface Window {
    deBridge?: {
      widget: (params: Record<string, unknown>) => Promise<DeBridgeWidget>
    }
    __ZP_DEBRIDGE_INIT__?: boolean
  }
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") return resolve()
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    )
    if (existing) {
      if ((existing as any).dataset.loaded === "1") return resolve()
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true }
      )
      return
    }
    const s = document.createElement("script")
    s.src = src
    s.async = true
    s.dataset.loaded = "0"
    s.onload = () => {
      s.dataset.loaded = "1"
      resolve()
    }
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

export type BridgeWidgetProps = {
  className?: string
  onAffiliateFeeChange?: (percent: number) => void
}

function zilToEvmAddress(base16?: string): `0x${string}` | null {
  if (!base16) return null
  if (base16.toLowerCase().startsWith("0x")) {
    return base16 as `0x${string}`
  }
  return `0x${base16}` as `0x${string}`
}

export function BridgeWidget({
  className,
  onAffiliateFeeChange,
}: BridgeWidgetProps) {
  const { walletAddress } = WalletConnector.useContainer()
  const widgetRef = useRef<DeBridgeWidget | null>(null)
  const initializedRef = useRef(false)
  const lastAddressRef = useRef<string | null>(null)

  const getUserAddress = useCallback((): `0x${string}` | null => {
    if (walletAddress) {
      return zilToEvmAddress(walletAddress)
    }
    return null
  }, [walletAddress])

  const checkAndSetFee = useCallback(
    async (
      widget: DeBridgeWidget,
      userAddress: `0x${string}` | null,
      resetToDefault = false
    ) => {
      let finalPercent = AFFILIATE_DEFAULT_PERCENT

      if (resetToDefault && !userAddress) {
        widget.setAffiliateFee({
          evm: {
            affiliateFeePercent: String(AFFILIATE_DEFAULT_PERCENT),
            affiliateFeeRecipient: AFFILIATE_EVM_RECIPIENT,
          },
        })
        console.debug(
          "[BridgeWidget] reset to default",
          AFFILIATE_DEFAULT_PERCENT
        )
        onAffiliateFeeChange?.(finalPercent)
        return
      }

      if (userAddress) {
        try {
          console.debug(
            "[BridgeWidget] checking staking eligibility for",
            userAddress
          )
          const { eligible, total } = await isEligibleForZeroFee(userAddress)

          if (eligible) {
            finalPercent = 0
            widget.setAffiliateFee({
              evm: {
                affiliateFeePercent: "0",
                affiliateFeeRecipient: AFFILIATE_EVM_RECIPIENT,
              },
            })
            console.debug(
              `[BridgeWidget] eligible (≈ ${total.toFixed(2)} ZIL) → set 0%`
            )
          } else {
            widget.setAffiliateFee({
              evm: {
                affiliateFeePercent: String(AFFILIATE_DEFAULT_PERCENT),
                affiliateFeeRecipient: AFFILIATE_EVM_RECIPIENT,
              },
            })
            console.debug(
              `[BridgeWidget] not eligible (≈ ${total.toFixed(
                2
              )} ZIL) → set ${AFFILIATE_DEFAULT_PERCENT}%`
            )
          }
        } catch (err) {
          console.warn("[BridgeWidget] eligibility check failed:", err)
          widget.setAffiliateFee({
            evm: {
              affiliateFeePercent: String(AFFILIATE_DEFAULT_PERCENT),
              affiliateFeeRecipient: AFFILIATE_EVM_RECIPIENT,
            },
          })
        }
      } else {
        console.debug(
          "[BridgeWidget] no wallet connected → default",
          AFFILIATE_DEFAULT_PERCENT
        )
      }

      onAffiliateFeeChange?.(finalPercent)
    },
    [onAffiliateFeeChange]
  )

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (typeof window === "undefined") return

      const container = document.getElementById(DEBRIDGE_WIDGET_ELEMENT_ID)
      if (!container) {
        console.error(
          "[BridgeWidget] container not found:",
          DEBRIDGE_WIDGET_ELEMENT_ID
        )
        return
      }

      // Always clear the container and reset state when component mounts
      container.innerHTML = ""
      window.__ZP_DEBRIDGE_INIT__ = false
      initializedRef.current = false

      if (widgetRef.current?.destroy) {
        try {
          widgetRef.current.destroy()
        } catch (e) {
          console.warn("[BridgeWidget] Error destroying previous widget:", e)
        }
        widgetRef.current = null
      }

      console.debug("[BridgeWidget] loading script…", DEBRIDGE_SCRIPT_SRC)
      await loadScriptOnce(DEBRIDGE_SCRIPT_SRC)
      if (cancelled) return

      if (!window.deBridge) {
        console.error(
          "[BridgeWidget] window.deBridge is undefined — script blocked? CSP/HTTPS issue?"
        )
        return
      }

      const userAddress = getUserAddress()

      const params: Record<string, unknown> = { ...WIDGET_DEFAULTS }
      if (REFERRAL_CODE) params.r = String(REFERRAL_CODE)

      params.affiliateFeePercent = AFFILIATE_DEFAULT_PERCENT
      params.affiliateFeeRecipient = AFFILIATE_EVM_RECIPIENT

      console.debug("[BridgeWidget] init widget with params:", params)
      const widget = await window.deBridge.widget(params)
      if (cancelled) {
        widget?.destroy?.()
        return
      }

      widgetRef.current = widget
      window.__ZP_DEBRIDGE_INIT__ = true
      initializedRef.current = true

      lastAddressRef.current = userAddress
      await checkAndSetFee(widget, userAddress, false)

      widget.on("order", () => {})
      widget.on("bridge", () => {})
      console.debug("[BridgeWidget] widget ready")
    })().catch((e) => {
      console.error("[BridgeWidget] init error:", e)
    })

    return () => {
      cancelled = true
      // Cleanup when component unmounts or tab changes
      if (widgetRef.current?.destroy) {
        try {
          widgetRef.current.destroy()
        } catch (e) {
          console.warn("[BridgeWidget] Error destroying widget on cleanup:", e)
        }
        widgetRef.current = null
      }
      window.__ZP_DEBRIDGE_INIT__ = false
      initializedRef.current = false
    }
  }, [getUserAddress, checkAndSetFee])

  useEffect(() => {
    const currentAddress = getUserAddress()

    if (currentAddress !== lastAddressRef.current && initializedRef.current) {
      const wasConnected = lastAddressRef.current !== null
      const isConnected = currentAddress !== null

      console.debug(
        "[BridgeWidget] wallet changed:",
        lastAddressRef.current,
        "→",
        currentAddress
      )

      if (wasConnected && !isConnected) {
        console.debug(
          "[BridgeWidget] wallet disconnected, page reload will reinit widget"
        )
        lastAddressRef.current = null
        if (widgetRef.current) {
          checkAndSetFee(widgetRef.current, null, true)
        }
      } else if (widgetRef.current) {
        lastAddressRef.current = currentAddress
        checkAndSetFee(widgetRef.current, currentAddress, false)
      }
    }
  }, [walletAddress, getUserAddress, checkAndSetFee])

  return (
    <div
      id={DEBRIDGE_WIDGET_ELEMENT_ID}
      className={className}
      style={{ minHeight: 780 }}
    />
  )
}

export function BridgeFeeInfo({ feePercent }: { feePercent: number }) {
  const formatPercent = (v: number) =>
    `${Number.isInteger(v) ? v.toFixed(0) : String(v)}%`

  return (
    <div className="bg-black1/[68%] rounded-2.5xl p-6 lg:p-8 h-fit">
      <h3 className="bold20 mb-4 lg:mb-6">💰 Fee Information</h3>

      <div className="space-y-4 lg:space-y-6">
        <div>
          <dt className="bold16 mb-2">Bridge fee</dt>
          <dd className="regular-base">
            Standard deBridge network fees apply.
          </dd>
        </div>

        <div>
          <dt className="bold16 mb-2">StakeZil fee</dt>
          <dd className="space-y-2">
            <p className="regular-base">
              <span className="text-tealPrimary font-bold">0%</span> if you
              stake at least{" "}
              <span className="text-white font-bold">
                {STAKING_MIN_ZIL.toLocaleString()} ZIL
              </span>{" "}
              on <span className="text-white font-bold">AmazingPool</span> or{" "}
              <span className="text-white font-bold">2ZilMoon</span>.
            </p>
            <p className="gray-base">
              Otherwise —{" "}
              <span className="text-white font-bold">
                {formatPercent(AFFILIATE_DEFAULT_PERCENT)}
              </span>{" "}
              of the input amount.
            </p>
          </dd>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 lg:mt-8 pt-4 lg:pt-6 border-t border-gray3">
        <span className="bold16">Your StakeZil fee</span>
        <span className="bg-tealPrimary text-black font-bold px-3 py-1.5 rounded-lg text-sm">
          {formatPercent(feePercent)}
        </span>
      </div>

      <p className="gray-base text-xs lg:text-sm mt-4">
        Our fee helps support Zilliqa ecosystem development.
      </p>
    </div>
  )
}

export default BridgeWidget
