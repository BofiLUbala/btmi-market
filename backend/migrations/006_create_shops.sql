CREATE TYPE shop_type AS ENUM ('PHYSICAL', 'ONLINE');
CREATE TYPE shop_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type shop_type NOT NULL DEFAULT 'PHYSICAL',
    city VARCHAR(100) DEFAULT '',
    address VARCHAR(500) DEFAULT '',
    phone VARCHAR(20) DEFAULT '',
    status shop_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_shops_business_id ON shops(business_id);
CREATE INDEX idx_shops_status ON shops(status);
