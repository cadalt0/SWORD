# Sword deployed contracts, Whitechain testnet (chain 1874)

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
