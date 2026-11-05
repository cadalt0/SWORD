# Sword deployed contracts, Whitechain testnet (chain 1874)

Explorer: https://explorer.testnet.whitechain.io

| Contract | Address | Deploy transaction | Role |
|---|---|---|---|
| MerchantSpender | [`0xc64118ffd8543ce5cd14314708908370f21fabe4`](https://explorer.testnet.whitechain.io/address/0xc64118ffd8543ce5cd14314708908370f21fabe4) | [`0x8de62ff7…b3da79`](https://explorer.testnet.whitechain.io/tx/0x8de62ff749755f584a3f47688f830379ecac8aaba88c5905580629ddb5b3da79) | Pulls payments, runs subscriptions and refunds |
| CollectorFactory | [`0xb852c949ec8fdd98fd6837e83fe9688e3e4dd3e5`](https://explorer.testnet.whitechain.io/address/0xb852c949ec8fdd98fd6837e83fe9688e3e4dd3e5) | [`0x2c76a4aa…fd77b9`](https://explorer.testnet.whitechain.io/tx/0x2c76a4aaf5516c29eb0c06f0b1592a50709c2bae309cf7c7c215b57d8afd77b9) | Creates a deposit address for each order |
| MerchantRegistry | [`0x83e5afa0b40d71672992d584a1dbe84ad80a07c2`](https://explorer.testnet.whitechain.io/address/0x83e5afa0b40d71672992d584a1dbe84ad80a07c2) | [`0xef201eb8…713d23`](https://explorer.testnet.whitechain.io/tx/0xef201eb8c2425b095b0bf972c25871d0bc06fa3627ecbdd041cd565808713d23) | Registers merchants and their order books |
| CustomerAccount (blueprint) | [`0x2a295ed6494045d06645f2fac7830c6baa540bc3`](https://explorer.testnet.whitechain.io/address/0x2a295ed6494045d06645f2fac7830c6baa540bc3) | [`0x9ad8264d…bd46f9`](https://explorer.testnet.whitechain.io/tx/0x9ad8264d41df9ab5e194a5cd7d725454aff53ed5c67c553271fb8367b3bd46f9) | Template copied for every customer account |
| MerchantAccount (blueprint) | [`0x9cbd586265d8a94b5fe24d6bdb178b60ec545947`](https://explorer.testnet.whitechain.io/address/0x9cbd586265d8a94b5fe24d6bdb178b60ec545947) | [`0x7378bbfc…81e85c`](https://explorer.testnet.whitechain.io/tx/0x7378bbfc6a2c3d49967aa71d3367e0197fa8dda87d6868aa8a374bb9aa81e85c) | Template copied for every merchant account |
| AccountFactory | [`0x1e91b481294a10359d069cd332046a559a389635`](https://explorer.testnet.whitechain.io/address/0x1e91b481294a10359d069cd332046a559a389635) | [`0x29994946…37f4e7`](https://explorer.testnet.whitechain.io/tx/0x2999494664c3f24a77fe62c17bcc67fbcde45f4a802be52f5a34a145ca37f4e7) | Creates customer and merchant accounts |
| SubscriptionVault (template) | [`0x50bF1Cf079c70dD705eb99EE7c81f572a8D01c9b`](https://explorer.testnet.whitechain.io/address/0x50bF1Cf079c70dD705eb99EE7c81f572a8D01c9b) | | Created inside the MerchantSpender. Copied once per subscription. |
| USDT (test token, not ours) | [`0x39A1022E775394BEd9638A385192f12E44305e8F`](https://explorer.testnet.whitechain.io/address/0x39A1022E775394BEd9638A385192f12E44305e8F) | | Existing token, 6 decimals. Reused. |
