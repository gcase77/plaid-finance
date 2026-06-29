-- CreateTable
CREATE TABLE "investment_holdings" (
    "account_id" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" TEXT NOT NULL,
    "institution_price" DOUBLE PRECISION NOT NULL,
    "institution_price_as_of" TIMESTAMP(3),
    "institution_price_datetime" TIMESTAMP(3),
    "institution_price_date" TIMESTAMP(3) NOT NULL,
    "institution_value" DOUBLE PRECISION NOT NULL,
    "cost_basis" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "iso_currency_code" TEXT,
    "unofficial_currency_code" TEXT,
    "currency_code" TEXT,
    "vested_quantity" DOUBLE PRECISION,
    "vested_value" DOUBLE PRECISION,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_holdings_pkey" PRIMARY KEY ("account_id","security_id")
);

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "security_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "plaid_datetime" TIMESTAMP(3),
    "datetime" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "iso_currency_code" TEXT,
    "unofficial_currency_code" TEXT,
    "currency_code" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "securities" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "institution_security_id" TEXT,
    "institution_id" TEXT,
    "proxy_security_id" TEXT,
    "name" TEXT,
    "ticker_symbol" TEXT,
    "is_cash_equivalent" BOOLEAN,
    "type" TEXT,
    "subtype" TEXT,
    "close_price" DOUBLE PRECISION,
    "close_price_as_of" TIMESTAMP(3),
    "update_datetime" TIMESTAMP(3),
    "iso_currency_code" TEXT,
    "unofficial_currency_code" TEXT,
    "currency_code" TEXT,
    "market_identifier_code" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "option_contract" JSONB,
    "fixed_income" JSONB,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "securities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_holdings_user_id_item_id_idx" ON "investment_holdings"("user_id", "item_id");

-- CreateIndex
CREATE INDEX "investment_transactions_user_id_datetime_idx" ON "investment_transactions"("user_id", "datetime");

-- CreateIndex
CREATE INDEX "investment_transactions_account_id_security_id_idx" ON "investment_transactions"("account_id", "security_id");

-- CreateIndex
CREATE INDEX "securities_user_id_item_id_idx" ON "securities"("user_id", "item_id");

-- CreateIndex
CREATE INDEX "securities_ticker_symbol_idx" ON "securities"("ticker_symbol");

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "securities" ADD CONSTRAINT "securities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "securities" ADD CONSTRAINT "securities_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "securities" ADD CONSTRAINT "securities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
