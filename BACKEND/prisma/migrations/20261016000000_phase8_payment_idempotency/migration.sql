-- Existing payments predate idempotency keys, so the column remains nullable for backward compatibility.
-- The payment API requires a key for every new payment.
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
