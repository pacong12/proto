import { ref, computed, watch } from 'vue';
import { parseEther, erc20Abi } from 'viem';
import { useI18n } from '@/lib/i18n';
import { apiFetch } from '@/lib/api-client';
import { useSwap, parseAmountToWei } from '@/composables/useSwap';
import { useWallet } from '@/composables/useWallet';
import { getPublicClient, waitForReceiptWithFallback } from '@/lib/viem-client';
import { toast } from '@/components/ui/sonner';
import { isStableSymbol } from '@goton/shared-types';
import {
  calculateCurveBuyOutput,
  calculateCurveSellOutput,
  getChainMathConfig,
} from '@goton/math-sdk';
import type { TradePage } from './types';
import type { UseTradeMarket } from './useTradeMarket';
import type { UseTradeTax } from './useTradeTax';
import type { UseTradeDividends } from './useTradeDividends';

/** The swap form: side, amount and slippage, the wallet's token balance, the output preview and the swap itself. */
export function useTradeForm(
  page: TradePage,
  tradeMarket: UseTradeMarket,
  tradeTax: UseTradeTax,
  tradeDividends: UseTradeDividends,
) {
  const {
    buyPresets,
    currencySymbol,
    currentMarketData,
    currentToken,
    explorerUrl,
    refreshTokenData,
    tokenNetwork,
  } = page;
  const {
    fetchCandlesticks,
    fetchHolders,
    fetchTopTraders,
    fetchTrades,
    quoteAssetPriceUsd,
    selectedResolution,
  } = tradeMarket;
  const { onchainTaxConfig } = tradeTax;
  const { refreshLiveDividends } = tradeDividends;
  const { t } = useI18n();
  const { account, activeNetwork, balanceWei, isConnected, updateBalance } = useWallet();

  const { executeSwap, isSwapping, swapError, slippage } = useSwap();

  // Trade state
  const tradeTab = ref<'buy' | 'sell'>('buy');

  const isBuy = computed(() => tradeTab.value === 'buy');

  const payInUsd = ref(false);

  const amountIn = ref('');

  // Start from the smallest preset of the token's quote currency (10 USDC, 0.01 ETH), and follow
  // the currency when navigating between tokens unless the user typed their own amount.
  watch(
    buyPresets,
    (presets, previous) => {
      if (!amountIn.value || previous?.includes(amountIn.value)) amountIn.value = presets[0];
    },
    { immediate: true },
  );

  const swapSuccessTx = ref<string | null>(null);

  function scrollToSwap(tab: 'buy' | 'sell') {
    tradeTab.value = tab;
    const el = document.getElementById('swap-panel-container');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const effectiveNativeInput = computed(() => {
    const input = parseFloat(amountIn.value) || 0;
    if (input <= 0) return 0;
    if (isBuy.value && payInUsd.value) {
      return input / (quoteAssetPriceUsd.value || 1);
    }
    return input;
  });

  const activeBuyPresets = computed(() => {
    if (payInUsd.value) {
      return ['10', '50', '100', '500'];
    }
    return buyPresets.value;
  });

  const userTokenBalance = ref<bigint>(0n);

  const isTokenBalanceLoading = ref(false);

  const isMaxSell = ref(false);

  // Slippage
  const isCustomSlippage = ref(false);

  const customSlippageInput = ref('');

  // -----------------------------------------------------------------------
  // Constant-product preview math (BondingCurve, or the equivalent reserves of an in-pool v4
  // launch). Prefers the curve's indexed virtual reserves; otherwise rebuilds them from the chain's
  // math config: k = initial virtual quote × initial virtual token supply.
  // -----------------------------------------------------------------------
  function getVirtualReserves() {
    const vEthRaw = currentToken.value.virtualEthReserve;
    const vTokenRaw = currentToken.value.virtualTokenReserve;
    if (vEthRaw && vTokenRaw) {
      const vEth = Number(BigInt(vEthRaw)) / 1e18;
      const vToken = Number(BigInt(vTokenRaw)) / 10 ** (currentToken.value.decimals || 18);
      if (vEth > 0 && vToken > 0) {
        return { vEth, vToken };
      }
    }
    // SDK-02: virtual token reserve starts at the full supply (not 800M) and shrinks as quote
    // flows in; chain parameters come from math-sdk instead of guessing from the currency symbol.
    const math = getChainMathConfig(tokenNetwork.value.chainId);
    const baseVirtualQuote = Number(math?.virtualQuoteReserve ?? 0n) / 1e18;
    const baseVirtualToken = math?.totalSupplyNum ?? 1_000_000_000;
    const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
    const vEth = baseVirtualQuote + currentRaised;
    return {
      vEth,
      vToken: vEth > 0 ? (baseVirtualQuote * baseVirtualToken) / vEth : baseVirtualToken,
    };
  }

  function computeCurveBuyOutput(ethIn: number): number {
    if (ethIn <= 0) return 0;
    const { vEth, vToken } = getVirtualReserves();
    const cap = getChainMathConfig(tokenNetwork.value.chainId)?.curveSupplyNum;
    return calculateCurveBuyOutput(ethIn, vEth, vToken, cap);
  }

  function computeCurveSellOutput(tokensIn: number): number {
    if (tokensIn <= 0) return 0;
    const { vEth, vToken } = getVirtualReserves();
    return calculateCurveSellOutput(tokensIn, vEth, vToken);
  }

  const estimatedOutputAmount = computed(() => {
    const input = effectiveNativeInput.value;
    if (input <= 0) return '0';

    const isV2OnCurve =
      (currentToken.value.version === 'v2' || Boolean(currentToken.value.curveAddress)) &&
      !currentMarketData.value.isGraduated;

    // On the curve the token itself takes the creator's tax: the buy tax from the tokens received,
    // the sell tax from the tokens sold. Show what actually reaches the wallet.
    const { buyTaxBps, sellTaxBps } = onchainTaxConfig.value;
    if (isBuy.value) {
      const tokens = isV2OnCurve
        ? computeCurveBuyOutput(input) * (1 - buyTaxBps / 10_000)
        : input / (currentMarketData.value.priceInWeth || 0.000001);
      return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else {
      const weth = isV2OnCurve
        ? computeCurveSellOutput(input * (1 - sellTaxBps / 10_000))
        : input * (currentMarketData.value.priceInWeth || 0);
      const decimals = currencySymbol.value === 'USDC' ? 2 : 6;
      return weth.toFixed(decimals);
    }
  });

  const swapButtonText = computed(() => {
    if (isSwapping.value) return 'Executing...';
    if (!isConnected.value) return t('connectWallet');
    if (activeNetwork.value.chainId !== tokenNetwork.value.chainId) {
      return `Switch to ${tokenNetwork.value.name}`;
    }
    const input = effectiveNativeInput.value;
    if (!amountIn.value || input <= 0) return 'Enter an amount';

    if (!isBuy.value) {
      if (userTokenBalance.value <= 0n) {
        return `Insufficient ${currentToken.value.symbol} balance`;
      }
      if (!isMaxSell.value) {
        const decimals = currentToken.value.decimals || 18;
        const inputWei = parseAmountToWei(amountIn.value, decimals);
        if (inputWei > userTokenBalance.value) {
          return `Insufficient ${currentToken.value.symbol} balance`;
        }
      }
      return `Sell ${currentToken.value.symbol}`;
    } else {
      const ethBalance = Number(balanceWei.value) / 1e18;
      if (ethBalance > 0 && input > ethBalance) {
        return `Insufficient ${currencySymbol.value} balance`;
      }
      return `Buy ${currentToken.value.symbol}`;
    }
  });

  const isSwapDisabled = computed(() => {
    if (isSwapping.value) return true;
    if (!isConnected.value) return false;
    if (activeNetwork.value.chainId !== tokenNetwork.value.chainId) return false;
    const input = parseFloat(amountIn.value) || 0;
    if (!amountIn.value || input <= 0) return true;
    if (!isBuy.value) {
      if (userTokenBalance.value <= 0n) return true;
      if (!isMaxSell.value) {
        const decimals = currentToken.value.decimals || 18;
        const inputWei = parseAmountToWei(amountIn.value, decimals);
        return inputWei > userTokenBalance.value;
      }
      return false;
    }
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance > 0 && input > ethBalance) return true;
    return false;
  });

  // -----------------------------------------------------------------------
  // UI Helpers
  // -----------------------------------------------------------------------
  function applyQuickBuy(val: string) {
    amountIn.value = val;
  }

  function applyPercentage(percent: number) {
    if (isBuy.value) {
      isMaxSell.value = false;
      const isUsdQuote = isStableSymbol(currencySymbol.value);
      const ethBalance = Number(balanceWei.value) / 1e18;
      if (ethBalance <= 0) {
        amountIn.value = '0';
        return;
      }
      const reserveGas = isUsdQuote ? 0.05 : 0.005;
      const maxEth =
        percent === 100 ? Math.max(0, ethBalance - reserveGas) : ethBalance * (percent / 100);
      const nativeVal = maxEth > 0 ? maxEth : ethBalance;
      if (payInUsd.value) {
        amountIn.value = (nativeVal * (quoteAssetPriceUsd.value || 1)).toFixed(2);
      } else {
        amountIn.value = nativeVal.toFixed(isUsdQuote ? 2 : 4);
      }
    } else {
      const decimals = currentToken.value.decimals || 18;
      if (userTokenBalance.value <= 0n) {
        amountIn.value = '0';
        isMaxSell.value = false;
        return;
      }
      if (percent === 100) {
        isMaxSell.value = true;
        const whole = userTokenBalance.value / 10n ** BigInt(decimals);
        const frac = userTokenBalance.value % 10n ** BigInt(decimals);
        const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
        amountIn.value = fracStr ? `${whole}.${fracStr}` : whole.toString();
      } else {
        isMaxSell.value = false;
        const tokenBal = Number(userTokenBalance.value) / 10 ** decimals;
        const calculated = tokenBal * (percent / 100);
        amountIn.value = calculated < 1 ? calculated.toFixed(6) : calculated.toFixed(2);
      }
    }
  }

  function handleCustomSlippageInput() {
    const val = parseFloat(customSlippageInput.value);
    if (!isNaN(val) && val > 0 && val <= 49) {
      slippage.value = val;
    } else if (!isNaN(val) && val > 49) {
      slippage.value = 49;
      customSlippageInput.value = '49';
    }
  }

  // -----------------------------------------------------------------------
  // Data Fetching
  // -----------------------------------------------------------------------
  let balanceFetchPromise: Promise<void> | null = null;

  let lastBalanceFetchTime = 0;

  async function fetchUserTokenBalance(force = false) {
    const currentAcc = account.value;
    const tokenAddr = currentToken.value.address;
    if (!currentAcc || !tokenAddr || tokenAddr === '0x0000000000000000000000000000000000000000') {
      userTokenBalance.value = 0n;
      return;
    }
    const now = Date.now();
    if (balanceFetchPromise) return balanceFetchPromise;
    if (!force && now - lastBalanceFetchTime < 2500) return;
    lastBalanceFetchTime = now;

    // Never flicker if balance is already loaded
    if (userTokenBalance.value === 0n) {
      isTokenBalanceLoading.value = true;
    }

    balanceFetchPromise = (async () => {
      try {
        const [onChainResult, backendResult] = await Promise.allSettled([
          getPublicClient(tokenNetwork.value.chainId).readContract({
            address: tokenAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [currentAcc as `0x${string}`],
          }) as Promise<bigint>,
          apiFetch<{ success: boolean; data: { balanceWei: string } } | null>(
            `/api/tokens/${tokenAddr}/balance?account=${currentAcc}&chain=${tokenNetwork.value.chainId}`,
          ).catch(() => null),
        ]);

        let resolvedBal: bigint | null = null;
        if (onChainResult.status === 'fulfilled' && onChainResult.value > 0n) {
          resolvedBal = onChainResult.value;
        } else if (
          backendResult.status === 'fulfilled' &&
          backendResult.value?.success &&
          backendResult.value?.data?.balanceWei
        ) {
          resolvedBal = BigInt(backendResult.value.data.balanceWei);
        } else if (onChainResult.status === 'fulfilled') {
          resolvedBal = onChainResult.value;
        }

        if (resolvedBal !== null) {
          userTokenBalance.value = resolvedBal;
        }
      } catch {
        // Non-blocking
      } finally {
        isTokenBalanceLoading.value = false;
        balanceFetchPromise = null;
      }
    })();

    return balanceFetchPromise;
  }

  async function handleSwap() {
    swapSuccessTx.value = null;
    let expectedAmountOut: bigint | undefined;
    const input = effectiveNativeInput.value;
    const isV2OnCurve =
      (currentToken.value.version === 'v2' || Boolean(currentToken.value.curveAddress)) &&
      !currentMarketData.value.isGraduated;

    if (input > 0 && currentMarketData.value.priceInWeth > 0) {
      if (isBuy.value) {
        const estimatedTokens = isV2OnCurve
          ? computeCurveBuyOutput(input)
          : input / (currentMarketData.value.priceInWeth || 0.000001);
        expectedAmountOut = parseEther(Math.max(0, estimatedTokens).toFixed(6));
      } else {
        const estimatedEth = isV2OnCurve
          ? computeCurveSellOutput(input)
          : input * (currentMarketData.value.priceInWeth || 0);
        expectedAmountOut = parseEther(Math.max(0, estimatedEth).toFixed(6));
      }
    }

    let loadingToastId: string | number | undefined;

    const hash = await executeSwap({
      tokenAddress: currentToken.value.address,
      isBuy: isBuy.value,
      amountInEth:
        !isBuy.value && isMaxSell.value
          ? userTokenBalance.value
          : isBuy.value
            ? effectiveNativeInput.value.toString()
            : amountIn.value,
      slippagePercent: slippage.value,
      expectedAmountOut,
      curveAddress: currentToken.value.curveAddress,
      isGraduated: currentMarketData.value.isGraduated,
      chainId: tokenNetwork.value.chainId,
      tokenDecimals: currentToken.value.decimals || 18,
      onApproveSubmitted: (approveHash) => {
        toast.info('Approval Submitted', {
          description: 'Approving tokens for trading...',
          action: {
            label: 'View on Explorer',
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.open(
                  `${explorerUrl.value}/tx/${approveHash}`,
                  '_blank',
                  'noopener,noreferrer',
                );
              }
            },
          },
          duration: 5000,
        });
      },
      onSubmitted: (txHash) => {
        loadingToastId = toast.loading(
          isBuy.value ? 'Processing Buy Order...' : 'Processing Sell Order...',
          {
            description: 'Transaction broadcasted. Waiting for block confirmation...',
            action: {
              label: 'View on Explorer',
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.open(`${explorerUrl.value}/tx/${txHash}`, '_blank', 'noopener,noreferrer');
                }
              },
            },
          },
        );

        // Trigger immediate background sync — fire-and-forget, non-blocking
        apiFetch<unknown>(`/api/tokens/${currentToken.value.address}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash }),
        }).catch(() => {});
      },
    });

    if (hash) {
      const txExplorerLink = `${explorerUrl.value}/tx/${hash}`;
      // FO-01: only announce success once the swap is mined and did not revert.
      const receipt = await waitForReceiptWithFallback(
        getPublicClient(tokenNetwork.value.chainId),
        hash as `0x${string}`,
      );
      if (!receipt || receipt.status !== 'success') {
        const reverted = receipt?.status === 'reverted';
        toast.error(reverted ? 'Swap Reverted' : 'Swap Still Pending', {
          id: loadingToastId,
          description: reverted
            ? 'The transaction was mined but reverted. No tokens were exchanged.'
            : 'No confirmation yet. Check the explorer before retrying.',
          action: {
            label: 'View on Explorer',
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.open(txExplorerLink, '_blank', 'noopener,noreferrer');
              }
            },
          },
          duration: 10000,
        });
        return;
      }

      swapSuccessTx.value = hash;
      isMaxSell.value = false;

      toast.success('Swap Confirmed', {
        id: loadingToastId,
        description: isBuy.value
          ? `Successfully bought ${currentToken.value.symbol || 'tokens'}!`
          : `Successfully sold ${currentToken.value.symbol || 'tokens'}!`,
        action: {
          label: 'View on Explorer',
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.open(txExplorerLink, '_blank', 'noopener,noreferrer');
            }
          },
        },
        duration: 8000,
      });

      try {
        await apiFetch<unknown>(`/api/tokens/${currentToken.value.address}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: hash }),
        });
      } catch {
        // non-blocking
      }
      // In place: a full load would swap the page for its loading skeleton and rebuild the chart.
      await Promise.allSettled([
        refreshTokenData(currentToken.value.address),
        updateBalance(),
        fetchUserTokenBalance(true),
        refreshLiveDividends(),
        fetchTrades(currentToken.value.address, true),
        fetchCandlesticks(currentToken.value.address, selectedResolution.value, true),
        fetchHolders(currentToken.value.address, true),
        fetchTopTraders(currentToken.value.address, true),
      ]);

      // Fast realtime sync poll for 6s in background
      for (let i = 1; i <= 3; i++) {
        setTimeout(async () => {
          await Promise.allSettled([
            updateBalance(),
            fetchUserTokenBalance(true),
            fetchTrades(currentToken.value.address, true),
            fetchCandlesticks(currentToken.value.address, selectedResolution.value, true),
          ]);
        }, i * 2000);
      }
    } else if (swapError.value) {
      toast.error('Swap Failed', {
        id: loadingToastId,
        description: swapError.value,
        duration: 6000,
      });
    }
  }

  return {
    activeBuyPresets,
    amountIn,
    applyPercentage,
    applyQuickBuy,
    customSlippageInput,
    estimatedOutputAmount,
    fetchUserTokenBalance,
    getVirtualReserves,
    handleCustomSlippageInput,
    handleSwap,
    isBuy,
    isCustomSlippage,
    isMaxSell,
    isSwapDisabled,
    isSwapping,
    isTokenBalanceLoading,
    payInUsd,
    scrollToSwap,
    slippage,
    swapButtonText,
    swapSuccessTx,
    tradeTab,
    userTokenBalance,
  };
}

export type UseTradeForm = ReturnType<typeof useTradeForm>;
