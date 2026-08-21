-- Point 8: Cash Tracking (Suivre Argent)

-- Cash Session Status
CREATE TYPE cash_session_status AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- Cash Payment Status
CREATE TYPE cash_payment_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED');

-- Cash Payment Reference Type
CREATE TYPE cash_reference_type AS ENUM ('SALE', 'ORDER');

-- Cash Session: tracks a seller's cash handling during a shift
CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    employee_id UUID NOT NULL REFERENCES employees(id),

    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,

    opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    cash_sales_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    declared_closing_amount DECIMAL(12,2),
    difference DECIMAL(12,2),

    reconciliation_result VARCHAR(20),

    status cash_session_status NOT NULL DEFAULT 'OPEN',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_sessions_business ON cash_sessions(business_id);
CREATE INDEX idx_cash_sessions_shop ON cash_sessions(shop_id);
CREATE INDEX idx_cash_sessions_employee ON cash_sessions(employee_id);
CREATE INDEX idx_cash_sessions_status ON cash_sessions(status);
CREATE INDEX idx_cash_sessions_shop_status ON cash_sessions(shop_id, status);

-- Cash Payment: links financial record to a sale or order
CREATE TABLE cash_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    employee_id UUID REFERENCES employees(id),
    customer_id UUID REFERENCES customers(id),

    cash_session_id UUID REFERENCES cash_sessions(id),

    reference_type cash_reference_type NOT NULL,
    reference_id UUID NOT NULL,

    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    status cash_payment_status NOT NULL DEFAULT 'CONFIRMED',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_payments_business ON cash_payments(business_id);
CREATE INDEX idx_cash_payments_shop ON cash_payments(shop_id);
CREATE INDEX idx_cash_payments_employee ON cash_payments(employee_id);
CREATE INDEX idx_cash_payments_session ON cash_payments(cash_session_id);
CREATE INDEX idx_cash_payments_reference ON cash_payments(reference_type, reference_id);
CREATE INDEX idx_cash_payments_status ON cash_payments(status);
CREATE INDEX idx_cash_payments_created ON cash_payments(created_at);
