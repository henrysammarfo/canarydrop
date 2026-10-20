# On chain evidence

> **In plain words:** this folder holds the public proof that CanaryDrop really ran on the Arkiv Tiramisu test network. It contains only test data and public addresses. No private keys, seed phrases, or private network links.

| File | What is inside |
|---|---|
| `wallets.json` | The public addresses of the test wallets |
| `seed.json` and `../evidence.json` | The first test records we wrote and their transaction links |

The newest proof, from the final demo video, is listed in the main [README](../../README.md#real-proof-on-the-network).

To rebuild the self hosted copy and its file fingerprints, run `npm run build:static`. The fingerprint list is written to `out/build.sha256`.
