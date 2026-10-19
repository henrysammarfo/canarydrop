# What Arkiv does not give us

These are Ethereum standards we researched and used where they fit. Gaps are written as proposals, not as claims that Arkiv already has them.

## Used in this app

| Standard | Citation | How we use it |
|---|---|---|
| EIP-712 | https://eips.ethereum.org/EIPS/eip-712 | Signed canary statements. `lib/eip712.ts` hashes a `CanaryStatement` typed payload. Anyone can check the signature offline with the desk address. |
| EIP-4361 | https://eips.ethereum.org/EIPS/eip-4361 | Newsroom sign in. `lib/siwe.ts` builds and parses the SIWE message. The desk settings page asks the wallet to sign. |
| ERC-5564 | https://eips.ethereum.org/EIPS/eip-5564 | Experimental. One time reply addresses on secp256k1. A reply stores scheme 1, the stealth address, the ephemeral public key, and the view tag. Those keys are derived from a meta-address stored with the desk key pair on this device, not from an ERC-6538 registry. Anyone who holds the desk keys can also scan those replies. |
| ERC-6538 | https://eips.ethereum.org/EIPS/eip-6538 | The registry those stealth meta-addresses would be published to. We cannot ship a chain registry Arkiv does not have. |

## Proposals for Arkiv

1. A stealth meta-address registry keyed by newsroom wallet, with `createdBy` as the only writer. Until then, the meta-address stays in the desk payload or in a local file.
2. A first-class typed-data attribute so an EIP-712 digest can be queried without putting the hex in JSON payload.
3. A scheduled `changeOwnership` that fires when an entity expires, so a dead-man switch can hand a key to recipients instead of deleting the row. Today we pair a long-lived release row with a short-lived hold and treat absence as the signal.
4. A public, documented anonymous RPC quota. Static hosts have no server cache of their own.

None of this is a comparison to another product. It is the list of things this chain does not do yet.
