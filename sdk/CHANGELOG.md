# invisible-wallet-sdk

## 0.2.1

### Patch Changes

- 84347ec: Add TSDoc to the remaining undocumented public exports, so editor tooltips are
  populated across the whole SDK surface. Covers `bulkPayout`, `claimableBalance`,
  `feePayer`, `network`, `signMessage`, `counterfactual`, and the stragglers in
  `utils`, `outbox`, `sep7`, `crypto/prf`, `recovery/sep30` and
  `webauthn/attestation`. Comments only; no runtime or type changes.

## 0.2.0

### Minor Changes

- 0afa16e: Initial release of `invisible-wallet-sdk`:
  - Client SDK for Invisible Wallet (Soroban + WebAuthn passkeys).
  - Verified subpath exports for default (`.`), `./vanilla`, `./react`, and `./vue`.
  - ESM modules and TypeScript type definitions for Web, React Native, and Node environments.
  - Standalone documentation and quick-start guides for React, Vue 3, and framework-agnostic usage.
