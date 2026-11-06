import "./load-env.js";

import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { CHAIN_IDS, chainKit } from "./chain/relayer.js";

const server = serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`sword-api listening on http://localhost:${info.port} · web ${config.webUrl}`);
  for (const id of CHAIN_IDS) {
    const kit = chainKit(id);
    console.log(`  chain ${id} (${kit.entry.chain.name}, ${kit.entry.token.symbol}) · relayer ${kit.relayer.address} · rpc ${kit.rpcUrl}`);
  }
});

// Finish requests in flight before exiting.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
