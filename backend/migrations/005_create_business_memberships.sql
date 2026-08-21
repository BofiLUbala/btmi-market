CREATE TYPE membership_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE');
CREATE TYPE membership_status AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'REMOVED');

CREATE TABLE business_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'EMPLOYEE',
    status membership_status DEFAULT 'ACTIVE',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_business UNIQUE (user_id, business_id)
);

CREATE INDEX idx_memberships_user_id ON business_memberships(user_id);
CREATE INDEX idx_memberships_business_id ON business_memberships(business_id);
CREATE INDEX idx_memberships_role ON business_memberships(role);
CREATE INDEX idx_memberships_status ON business_memberships(status);
