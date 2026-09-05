import { Asset, Networks } from '@stellar/stellar-sdk';
import type { StorageAdapter } from './core';

/** The Stellar networks Veil deploys to. */
export type VeilNetworkName = 'testnet' | 'mainnet';

/**
 * Everything needed to talk to one Stellar network.
 *
 * The factory is deployed separately per network, so the same passkey resolves
 * to a different wallet contract on each.
 */
export type VeilNetwork = {
  /** Machine name, and the key this entry sits under in {@link NETWORKS}. */
  name: VeilNetworkName;
  /** Human-readable name for UI. */
  displayName: string;
  /** Stellar network passphrase. */
  networkPassphrase: string;
  /** Horizon REST base URL, for classic operations. */
  horizonUrl: string;
  /** Soroban RPC base URL, for contract calls. Empty when none is configured. */
  rpcUrl: string;
  /** The wallet factory contract on this network ("C..."). */
  factoryContractId: string;
  /** Friendbot funding endpoint, or `null` on networks without one. */
  friendbotUrl: string | null;
};

/** Key name holding the user's chosen network in storage. */
export const NETWORK_STORAGE_KEY = 'veil_network';

/**
 * Wallet keys that are network-scoped: each identifies state belonging to one
 * network's wallet and must not be shared across networks. The wallet contract
 * is deployed per network (its own factory each), so one passkey resolves to a
 * different `C…` address on testnet vs mainnet. Any other key (theme, chosen network, …)
 * is not namespaced.
 */
export const WALLET_KEYS = [
  'invisible_wallet_address',
  'invisible_wallet_key_id',
  'invisible_wallet_public_key',
  'invisible_wallet_portable_signer',
  'invisible_wallet_recovery_private_key',
  'veil_signer_secret',
  'veil_signer_public_key',
] as const;

/** {@link WALLET_KEYS} as a set, for membership checks in {@link namespaceKey}. */
export const WALLET_KEY_SET = new Set<string>(WALLET_KEYS);

/** The suffix mainnet slots carry. Testnet uses the bare key for backward compatibility. */
export const MAINNET_KEY_SUFFIX = '_mainnet';

/**
 * Built-in endpoints and factory addresses for each supported network.
 *
 * Prefer {@link getNetworkConfig}, which falls back to testnet for an unknown
 * name.
 */
export const NETWORKS: Record<VeilNetworkName, VeilNetwork> = {
  testnet: {
    name: 'testnet',
    displayName: 'Stellar Testnet',
    networkPassphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    factoryContractId: 'CAUK4MWO3TTFM6PLURSH2GPK3AB747SZGABKTCVLKCU7W2MGKHKP35GA',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  mainnet: {
    name: 'mainnet',
    displayName: 'Stellar Mainnet',
    networkPassphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    rpcUrl: '',
    factoryContractId: 'CCZ3JLRESNLDADGXWNEH4YQ4NXUUAHRJNCWZHYG6QB4KTDYHOH6OQ7BK',
    friendbotUrl: null,
  },
};

/**
 * Returns network metadata by name, defaulting to testnet.
 */
export function getNetworkConfig(name: VeilNetworkName = 'testnet'): VeilNetwork {
  return NETWORKS[name] ?? NETWORKS.testnet;
}

/**
 * Map a logical wallet key to the target network's physical storage slot.
 * Testnet (and non-wallet keys) is returned unchanged; wallet keys on mainnet
 * gain the `_mainnet` suffix so keys never collide across networks.
 */
export function namespaceKey(key: string, network: VeilNetworkName = 'testnet'): string {
  if (!WALLET_KEY_SET.has(key)) return key;
  return network === 'mainnet' ? `${key}${MAINNET_KEY_SUFFIX}` : key;
}

/**
 * Wraps an underlying `StorageAdapter` to automatically namespace wallet keys per network.
 */
export function createNamespacedStorageAdapter(
  storage: StorageAdapter,
  getNetwork: () => VeilNetworkName = () => 'testnet',
): StorageAdapter {
  return {
    getItem(key: string): string | null | Promise<string | null> {
      try {
        return storage.getItem(namespaceKey(key, getNetwork()));
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void | Promise<void> {
      try {
        return storage.setItem(namespaceKey(key, getNetwork()), value);
      } catch {
        /* quota / blocked */
      }
    },
    removeItem(key: string): void | Promise<void> {
      try {
        return storage.removeItem?.(namespaceKey(key, getNetwork()));
      } catch {
        /* blocked */
      }
    },
  };
}

/**
 * Returns the native XLM Soroban contract address for the specified network passphrase.
 */
export function getNativeAssetContractId(networkPassphrase: string = Networks.TESTNET): string {
  return Asset.native().contractId(networkPassphrase);
}

/**
 * Builds a Friendbot funding URL for testnet accounts. Returns null for networks without Friendbot.
 */
export function buildFriendbotUrl(
  address: string,
  friendbotUrl: string | null = NETWORKS.testnet.friendbotUrl,
): string | null {
  if (!friendbotUrl) return null;
  try {
    const url = new URL(friendbotUrl);
    url.searchParams.set('addr', address);
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Canonical USDC issuer for the given network name.
 */
export function getUsdcIssuer(network: VeilNetworkName = 'testnet'): string {
  return network === 'mainnet'
    ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
}
