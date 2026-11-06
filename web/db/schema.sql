-- Sword website database. Run with: npm run db:migrate
-- The chain is the source of truth for money and status. These tables hold what the chain does not:
-- who a user is, which account belongs to whom, and a readable copy of orders for the website.

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text NOT NULL UNIQUE,            -- stable Google account id; never changes
  email       text NOT NULL,                   -- display and support only; can change
  name        text,
  role        text NOT NULL CHECK (role IN ('customer', 'merchant')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('customer', 'merchant')),
  custody        text NOT NULL CHECK (custody IN ('custodial', 'self')),
  address        text NOT NULL UNIQUE,         -- the smart account address on chain
  owner_address  text NOT NULL,                -- relayer address (custodial) or the user's wallet (self)
  chain_id       integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)                       -- one account of each kind per user
);

CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id        integer NOT NULL,
  merchant_address text NOT NULL,              -- the merchant account on chain
  order_id        text NOT NULL,               -- on-chain order id (hex)
  reference       text NOT NULL,               -- the merchant's own reference
  collector       text,
  amount          numeric(20, 6) NOT NULL,     -- USDT, 6 decimals
  status          text NOT NULL DEFAULT 'open',
  payer_address   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, merchant_address, order_id)
);

CREATE TABLE IF NOT EXISTS events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  type        text NOT NULL,                   -- for example "account.created", "order.created"
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  tx_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_merchant_idx ON orders (merchant_address, created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_idx ON events (user_id, created_at DESC);

-- How an account signs: the relayer runs everything (custodial), the owner signs every action (manual),
-- or the owner signs one permission and the relayer runs actions within it (signless).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS signing text NOT NULL DEFAULT 'relayer'
  CHECK (signing IN ('relayer', 'manual', 'signless'));

-- Permissions the owner signed. The signature is kept so it can be used again if needed.
CREATE TABLE IF NOT EXISTS permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_address text NOT NULL,
  chain_id        integer NOT NULL,
  terms           jsonb NOT NULL,              -- relayer, expiry, maxAmount, nonce (as text)
  signature       text NOT NULL,
  tx_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS permissions_account_idx ON permissions (account_address, chain_id, created_at DESC);

-- True when the account is the merchant's own wallet (non-custodial merchants). No smart account is created for it.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_eoa boolean NOT NULL DEFAULT false;

-- Subscription plans a merchant offers. Customers subscribe to a plan from their wallet at /subscribe.
CREATE TABLE IF NOT EXISTS plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id         integer NOT NULL,
  merchant_address text NOT NULL,
  name             text NOT NULL,
  description      text,
  amount           numeric(20, 6) NOT NULL,     -- USDT per period
  period_days      integer NOT NULL CHECK (period_days BETWEEN 1 AND 365),
  periods          integer NOT NULL CHECK (periods BETWEEN 1 AND 120),
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_merchant_idx ON plans (merchant_address, chain_id, created_at DESC);

-- One row per subscription on chain. The chain is the source of truth for status and payments.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 text PRIMARY KEY,            -- the subscription id on chain (bytes32 hex)
  plan_id            uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  chain_id           integer NOT NULL,
  merchant_address   text NOT NULL,
  subscriber_address text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_merchant_idx ON subscriptions (merchant_address, chain_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_subscriber_idx ON subscriptions (plan_id, subscriber_address);

-- Subscriptions built like orders: the merchant creates one, it has its own deposit address (vault) on chain, and
-- exactly one customer takes it. The chain is the source of truth for status, payments, and balances.
-- (The older plans and subscriptions tables belong to the previous design and are no longer used.)
CREATE TABLE IF NOT EXISTS subscription_orders (
  id                 text PRIMARY KEY,           -- the subscription id on chain (bytes32 hex, lowercase)
  chain_id           integer NOT NULL,
  merchant_address   text NOT NULL,
  reference          text NOT NULL,
  name               text NOT NULL,
  description        text,
  amount             numeric(20, 6) NOT NULL,    -- USDT per period
  period_days        integer NOT NULL CHECK (period_days BETWEEN 1 AND 365),
  periods            integer NOT NULL CHECK (periods BETWEEN 1 AND 120),
  vault              text,
  subscriber_address text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_orders_merchant_idx ON subscription_orders (merchant_address, chain_id, created_at DESC);

-- In-app notifications, one row per person told. They are made when the website records an event (a refund asked,
-- declined or paid, a payment received, a subscription started or renewed) and read from the bell in the header.
CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tone        text NOT NULL DEFAULT 'info',     -- info, success, warning, destructive
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  link        text,                             -- the dashboard section it opens, such as "refunds"
  tx_hash     text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- API keys a merchant creates on the Developers page. Only a SHA-256 hash of the key is kept; the key is shown once.
-- A key acts for one merchant account on one chain, and only within its scopes.
CREATE TABLE IF NOT EXISTS api_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_address  text NOT NULL,                 -- the merchant account the key acts for
  chain_id         integer NOT NULL,
  name             text NOT NULL,
  prefix           text NOT NULL,                 -- the first characters, so a key can be recognised in lists
  key_hash         text NOT NULL UNIQUE,
  scopes           text[] NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id, created_at DESC);

-- Per-merchant settings for integrations. Checkout pages only report back to these origins.
CREATE TABLE IF NOT EXISTS merchant_settings (
  account_address  text NOT NULL,
  chain_id         integer NOT NULL,
  allowed_origins  text[] NOT NULL DEFAULT '{}',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_address, chain_id)
);

-- Transactions the API prepared for a wallet merchant that signs its own actions. The merchant's SDK signs one, sends
-- it, and reports the hash; the API checks it on chain before it records the result.
CREATE TABLE IF NOT EXISTS api_pending (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id           uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  kind             text NOT NULL,                 -- for example "order.create"
  params           jsonb NOT NULL,
  from_address     text NOT NULL,
  to_address       text NOT NULL,
  data             text NOT NULL,
  value            text NOT NULL DEFAULT '0',
  expires_at       timestamptz NOT NULL,
  tx_hash          text,
  result           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS api_pending_key_idx ON api_pending (key_id, created_at DESC);

-- A period can be as short as 10 seconds (for testing renewals), so the exact length is kept in seconds. period_days
-- stays (rounded up, at least 1) for older code; period_seconds is the truth.
ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS period_seconds integer;
UPDATE subscription_orders SET period_seconds = period_days * 86400 WHERE period_seconds IS NULL;
ALTER TABLE subscription_orders ALTER COLUMN period_seconds SET NOT NULL;
ALTER TABLE subscription_orders DROP CONSTRAINT IF EXISTS subscription_orders_period_seconds_check;
ALTER TABLE subscription_orders ADD CONSTRAINT subscription_orders_period_seconds_check CHECK (period_seconds BETWEEN 10 AND 31536000);

-- Payments made in local money (bank transfer, UPI, Pix, ...) for an order or a subscription. The payer gives the id
-- their bank showed; the order or subscription counts as paid from then on.
CREATE TABLE IF NOT EXISTS fiat_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL CHECK (kind IN ('order', 'subscription')),
  chain_id         integer NOT NULL,
  merchant_address text NOT NULL,
  target_id        text NOT NULL,                 -- the order id, or the subscription id (lowercase)
  amount           numeric(20, 6) NOT NULL,       -- in the stablecoin
  currency         text NOT NULL,
  fiat_amount      numeric(24, 2) NOT NULL,
  rate             numeric(24, 8) NOT NULL,       -- local money per dollar at the time
  country          text,
  payer_reference  text NOT NULL,
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, chain_id, merchant_address, target_id)
);

-- Cash-outs: a balance converted to local money and sent to the user's bank account.
CREATE TABLE IF NOT EXISTS fiat_payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id         integer NOT NULL,
  account_address  text NOT NULL,
  amount           numeric(20, 6) NOT NULL,       -- in the stablecoin
  currency         text NOT NULL,
  fiat_amount      numeric(24, 2) NOT NULL,
  rate             numeric(24, 8) NOT NULL,
  country          text NOT NULL,
  holder_name      text NOT NULL,
  bank_name        text,
  account_last4    text NOT NULL,
  reference        text NOT NULL,
  status           text NOT NULL DEFAULT 'completed',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fiat_payouts_user_idx ON fiat_payouts (user_id, created_at DESC);
