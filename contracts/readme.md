# Sword deployed contracts, Whitechain testnet (chain 1874)

Explorer: https://explorer.testnet.whitechain.io

| Contract | Address | Deploy transaction | Role |
|---|---|---|---|
| MerchantSpender | [`0x43f3072d3a48714148e071ef9a92008d499c5e25`](https://explorer.testnet.whitechain.io/address/0x43f3072d3a48714148e071ef9a92008d499c5e25) | [`0xe6556cc5…d84b75`](https://explorer.testnet.whitechain.io/tx/0xe6556cc54b57e340bd6921fd8041b4de33d2665f0db4e604a5e346e153d84b75) | Pulls payments, runs subscriptions and refunds |
| CollectorFactory | [`0xdec3f7576bf6a52294ddb1d18724bb5d02a83e33`](https://explorer.testnet.whitechain.io/address/0xdec3f7576bf6a52294ddb1d18724bb5d02a83e33) | [`0xf22006e4…0e681e`](https://explorer.testnet.whitechain.io/tx/0xf22006e49da03a479b0092d8a71924185847146c86c3857dcd166886a30e681e) | Creates a deposit address for each order |
| MerchantRegistry | [`0xa405b892155dadc12ace19269f94447041d9d5a3`](https://explorer.testnet.whitechain.io/address/0xa405b892155dadc12ace19269f94447041d9d5a3) | [`0x2c316f5a…55163e`](https://explorer.testnet.whitechain.io/tx/0x2c316f5a0c82a193b9a019748be52013f984aa39abad4c6561ea9c79b755163e) | Registers merchants and their order books |
| CustomerAccount (blueprint) | [`0xfe171f746478127d15964ad79ae22c4396bf5b7a`](https://explorer.testnet.whitechain.io/address/0xfe171f746478127d15964ad79ae22c4396bf5b7a) | [`0xc2383c90…29941e`](https://explorer.testnet.whitechain.io/tx/0xc2383c909b3d64d75cec8705d3de6b0d15596730945b4c373f92f134d229941e) | Template copied for every customer account |
| MerchantAccount (blueprint) | [`0x89a52fce633d48fffff46ecaed4f76b0ca403d3a`](https://explorer.testnet.whitechain.io/address/0x89a52fce633d48fffff46ecaed4f76b0ca403d3a) | [`0xbbb0fbe5…faf53e`](https://explorer.testnet.whitechain.io/tx/0xbbb0fbe53b9c5ca48d8fe301edaa03e3b79895b92378f5c08b1bb8c5b4faf53e) | Template copied for every merchant account |
| AccountFactory | [`0x5b8390b5c5cdc9f949ac1cd9071b0a79ebaffb4b`](https://explorer.testnet.whitechain.io/address/0x5b8390b5c5cdc9f949ac1cd9071b0a79ebaffb4b) | [`0xf851437f…a90ac0`](https://explorer.testnet.whitechain.io/tx/0xf851437f1a59e3fe758764f2c7fe2f8f0444b8e4a3896c8f4bafb5de40a90ac0) | Creates customer and merchant accounts |
| SubscriptionVault (template) | [`0xdFDcc9F2A5C0971AcBF86fA43F72704195d3A82F`](https://explorer.testnet.whitechain.io/address/0xdFDcc9F2A5C0971AcBF86fA43F72704195d3A82F) | | Created inside the MerchantSpender. Copied once per subscription. |
| USDT (Tether USD, 6 decimals) | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) | | Existing testnet token used for all payments |
