-- Replace the former ONLINE method with the Phase 7 UPI method. Existing ONLINE
-- records are preserved as UPI rather than being discarded.
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'OTHER');
ALTER TABLE "Payment"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
  USING (
    CASE WHEN "paymentMethod"::text = 'ONLINE' THEN 'UPI' ELSE "paymentMethod"::text END
  )::"PaymentMethod";
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" SET DEFAULT 'CASH';
DROP TYPE "PaymentMethod_old";

-- Service validation is the primary guard; this check protects direct database writes too.
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
