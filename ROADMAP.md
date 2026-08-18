# Veil Roadmap

Veil is an **invisible smart-contract wallet on Stellar** — your passkey *is*
your wallet. No seed phrases, no private keys: a WebAuthn passkey authorizes an
on-chain smart-wallet contract, and a separate fee-payer account covers Stellar
fees. This roadmap is the map for contributors; pick anything labelled
[`good first issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
or [`help wanted`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
and see [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

**Legend:** ✅ shipped · 🚧 in progress · 🗓️ planned

---

## Core wallet
- ✅ Passkey registration → counterfactual smart-wallet deploy
- ✅ Send / Receive (classic + Soroban SAC), SEP-7 payment links
- ✅ Inactivity auto-lock, passkey unlock, multi-device recovery (SEP-30 + paper backup)
- ✅ PRF-derived fee-payer key — no plaintext key at rest (ADR 0003)
- 🚧 Wallet UI redesign — clearer hierarchy, restrained accent, bottom-tab nav
- 🗓️ Desktop app-shell (the app is mobile-first; desktop needs its own layout)

## SDK (`invisible-wallet-sdk`)
- ✅ React hook + framework adapters, counterfactual address derivation
- ✅ Encrypted backup/restore, SEP-7/SEP-30 helpers, transaction outbox
- 🚧 First npm publish (unblocks downstream integrations)

## AI agent
- ✅ Chat agent (Claude) with passkey-gated transaction approval, x402 metering
- 🚧 Origin/token auth hardening on the agent WebSocket

## Mobile (Expo / React Native)
- ✅ App shell, navigation, core screens (send/receive/swap/vault/multisig/agent)
- ✅ SDK wired natively (AsyncStorage + expo-secure-store), passkey via react-native-passkeys
- 🚧 iOS Associated Domains / Android App Links, EAS store builds

## DeFi
- ✅ Swaps (Soroswap aggregator + SDEX fallback), AMM liquidity pools
- ✅ Time-locked vault, DAO multisig, bulk payouts
- 🗓️ Blend yield ("Earn") once mainnet pools are wired

## Infrastructure — mainnet
- ✅ Testnet: factory + wallet deployed, live PWA
- 🚧 Mainnet deployment (QuickNode RPC), dual-network (mainnet + testnet) foundation
- 🗓️ Reproducible-build verification for all contracts on mainnet

## Security & hardening
- ✅ CSP + security headers, agent-chat XSS fix, factory init auth, WebAuthn flag checks
- 🚧 Dependency-advisory sweep, spend-limit call-shape hardening
- 🗓️ External audit before mainnet value flows

---

*Want to help?* Comment on an open issue to claim it. New contributors: start with
a `good first issue`. Larger tracks (mainnet, redesign, mobile) are grouped by
`epic:*` labels.
