---
"invisible-wallet-sdk": patch
---

Add TSDoc to the remaining undocumented public exports, so editor tooltips are
populated across the whole SDK surface. Covers `bulkPayout`, `claimableBalance`,
`feePayer`, `network`, `signMessage`, `counterfactual`, and the stragglers in
`utils`, `outbox`, `sep7`, `crypto/prf`, `recovery/sep30` and
`webauthn/attestation`. Comments only; no runtime or type changes.
