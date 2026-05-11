-- Add criticality column to products table
ALTER TABLE "public"."products"
ADD COLUMN "is_critical" BOOLEAN NOT NULL DEFAULT false;

-- Add a comment to the column for documentation
COMMENT ON COLUMN "public"."products"."is_critical" IS 'Flag indicating if the product is highly critical. Critical products require closer monitoring and should never approach zero stock.';
