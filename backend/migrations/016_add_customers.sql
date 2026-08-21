CREATE TYPE customer_status AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    phone VARCHAR(50),
    email VARCHAR(255),
    status customer_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_customer_phone_business ON customers(business_id, phone) WHERE phone IS NOT NULL AND phone != '';
CREATE UNIQUE INDEX uq_customer_email_business ON customers(business_id, email) WHERE email IS NOT NULL AND email != '';

CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);

ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
