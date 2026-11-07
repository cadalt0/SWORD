# Sword deployed contracts

The same contracts are deployed on two networks. Each merchant and customer account lives on one of them.

## Arc testnet (chain 5042002)

Explorer: https://explorer.testnet.arc.io

| Contract | Address | Deploy transaction | Role |
|---|---|---|---|
| MerchantSpender | [`0x6a2694158de4141a31c428d06a8aee994dfddc86`](https://explorer.testnet.arc.io/address/0x6a2694158de4141a31c428d06a8aee994dfddc86) | [`0xa585950a…373173`](https://explorer.testnet.arc.io/tx/0xa585950a1056f6010711ab6585f78e5e9dd57b7100ccfdaba3ac0d2dbb373173) | Pulls payments, runs subscriptions and refunds |
| CollectorFactory | [`0xa8336857bf520c3340b8a18945a534852124dd44`](https://explorer.testnet.arc.io/address/0xa8336857bf520c3340b8a18945a534852124dd44) | [`0x197e2e57…5bbd4c`](https://explorer.testnet.arc.io/tx/0x197e2e571f92e634e3028dacccf34413624e8eb379ce56e0f7f92322c15bbd4c) | Creates a deposit address for each order |
| MerchantRegistry | [`0x8380f81dc88182c8f0d082a785a05e75aeb28600`](https://explorer.testnet.arc.io/address/0x8380f81dc88182c8f0d082a785a05e75aeb28600) | [`0x735edd61…81a21e`](https://explorer.testnet.arc.io/tx/0x735edd618dda82d671e50e998c7979e184f3586423537f72d34fa1eaaf81a21e) | Registers merchants and their order books |
| CustomerAccount (blueprint) | [`0x6e5e87d19dc7b54c5afb86a75c52844774994568`](https://explorer.testnet.arc.io/address/0x6e5e87d19dc7b54c5afb86a75c52844774994568) | [`0xcdf90d1a…eb76c3`](https://explorer.testnet.arc.io/tx/0xcdf90d1a8c2dd6febe03206a0c60dfdd07864861e647b64b26b40e8c3deb76c3) | Template copied for every customer account |
| MerchantAccount (blueprint) | [`0x076aa9be90d48afeefae164fb6b5186577902444`](https://explorer.testnet.arc.io/address/0x076aa9be90d48afeefae164fb6b5186577902444) | [`0x020fa8e4…b824e8`](https://explorer.testnet.arc.io/tx/0x020fa8e4b1c5ee76630c8530d8d5cdf07b3a1cd9731bdc0abb4a5f8995b824e8) | Template copied for every merchant account |
| AccountFactory | [`0x025f7371db8a5f2418469ee84b838c16cc811068`](https://explorer.testnet.arc.io/address/0x025f7371db8a5f2418469ee84b838c16cc811068) | [`0xa59d4b77…2244fa`](https://explorer.testnet.arc.io/tx/0xa59d4b7774f8b94252638cf6ae1ed9d9aefff908c1acd67eeeeea698762244fa) | Creates customer and merchant accounts |
| SubscriptionVault (template) | [`0xb6090865Ee553A05a1E6c04C4f3495D07706CB0d`](https://explorer.testnet.arc.io/address/0xb6090865Ee553A05a1E6c04C4f3495D07706CB0d) | | Created inside the MerchantSpender. Copied once per subscription. |
| USDC (6 decimals) | [`0x3600000000000000000000000000000000000000`](https://explorer.testnet.arc.io/address/0x3600000000000000000000000000000000000000) | | Arc's USDC, used for all payments |

## Whitechain testnet (chain 1874)

Explorer: https://explorer.testnet.whitechain.io

| Contract | Address | Deploy transaction | Role |
|---|---|---|---|
| MerchantSpender | [`0xf5a6b0482d54bb92837dd127d3d609a82c5ce8f4`](https://explorer.testnet.whitechain.io/address/0xf5a6b0482d54bb92837dd127d3d609a82c5ce8f4) | [`0xd71632cd…02d793`](https://explorer.testnet.whitechain.io/tx/0xd71632cdd0800c8348aeb21da7fba53a7833206ca7a4a07ce2080b15f002d793) | Pulls payments, runs subscriptions and refunds |
| CollectorFactory | [`0x00dcb33b428e86e23d6da6b2ad318413360d587e`](https://explorer.testnet.whitechain.io/address/0x00dcb33b428e86e23d6da6b2ad318413360d587e) | [`0xf89d953f…3e62ec`](https://explorer.testnet.whitechain.io/tx/0xf89d953f80aa9392eaeba94d32bda39e358114c14e6778394ae7e8fa073e62ec) | Creates a deposit address for each order |
| MerchantRegistry | [`0x16334366ced5715af763ef66282de36b1f34ecd7`](https://explorer.testnet.whitechain.io/address/0x16334366ced5715af763ef66282de36b1f34ecd7) | [`0x42231571…3dae53`](https://explorer.testnet.whitechain.io/tx/0x4223157163ff55abf77f2c2ac1fdbd7d109eb57c75ce246ea1b08648fc3dae53) | Registers merchants and their order books |
| CustomerAccount (blueprint) | [`0xa3337363b4148bf20647afd37390911bbad192d8`](https://explorer.testnet.whitechain.io/address/0xa3337363b4148bf20647afd37390911bbad192d8) | [`0x90e6b65f…673c4c`](https://explorer.testnet.whitechain.io/tx/0x90e6b65fb7a2ec197edba1d5febb876adf87a1b7a680cadaf45664135b673c4c) | Template copied for every customer account |
| MerchantAccount (blueprint) | [`0x78eca0679bb5350551e3696b8ba1d762942bf4f9`](https://explorer.testnet.whitechain.io/address/0x78eca0679bb5350551e3696b8ba1d762942bf4f9) | [`0xa7074148…4308a3`](https://explorer.testnet.whitechain.io/tx/0xa7074148a68f26450299dada64f08dfcd140bde625098da22f9a41877c4308a3) | Template copied for every merchant account |
| AccountFactory | [`0x7e62f438ee98871855b6ab2b22113a84ba0eda96`](https://explorer.testnet.whitechain.io/address/0x7e62f438ee98871855b6ab2b22113a84ba0eda96) | [`0x943daf92…92c666`](https://explorer.testnet.whitechain.io/tx/0x943daf9288618b342beaa3b6cb94a5d5be3d5639649fd1728dd2618acc92c666) | Creates customer and merchant accounts |
| SubscriptionVault (template) | [`0x93BDd6124cAc3A436917A877255617d258bfc722`](https://explorer.testnet.whitechain.io/address/0x93BDd6124cAc3A436917A877255617d258bfc722) | | Created inside the MerchantSpender. Copied once per subscription. |
| USDT (Tether USD, 6 decimals) | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) | | Existing testnet token used for all payments |
