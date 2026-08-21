CREATE TYPE receipt_status AS ENUM ('PENDING', 'RECEIVED', 'CANCELLED');

CREATE TABLE stock_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reference_number VARCHAR(100) DEFAULT '',
    notes TEXT DEFAULT '',
    status receipt_status DEFAULT 'PENDING',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX idx_receipts_business_id ON stock_receipts(business_id);
CREATE INDEX idx_receipts_shop_id ON stock_receipts(shop_id);
CREATE INDEX idx_receipts_status ON stock_receipts(status);

CREATE TABLE stock_receipt_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(15,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_receipt FOREIGN KEY (receipt_id) REFERENCES stock_receipts(id) ON DELETE CASCADE,
    CONSTRAINT fk_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX idx_receipt_lines_receipt_id ON stock_receipt_lines(receipt_id);
CREATE INDEX idx_receipt_lines_variant_id ON stock_receipt_lines(variant_id);
