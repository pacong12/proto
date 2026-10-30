import { rpcUrlsFor, type NetworkConfig } from '@goton/shared-types';
import type { WalletProviderLike } from './wallet-store';

/**
 * Switches an injected wallet to `network`, adding the network first when the wallet does not
 * know it (EIP-3085). Throws when the user rejects either request.
 */
export async function switchProviderNetwork(
  provider: WalletProviderLike,
  network: NetworkConfig,
): Promise<void> {
  const chainId = `0x${network.chainId.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (switchErr) {
    const code = (switchErr as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw switchErr;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: rpcUrlsFor(network),
          blockExplorerUrls: [network.blockExplorer],
        },
      ],
    });
  }
}
