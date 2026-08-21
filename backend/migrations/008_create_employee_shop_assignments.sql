CREATE TYPE assignment_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE employee_shop_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status assignment_status DEFAULT 'ACTIVE',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    CONSTRAINT fk_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_employee_shop UNIQUE (employee_id, shop_id)
);

CREATE INDEX idx_assignments_employee_id ON employee_shop_assignments(employee_id);
CREATE INDEX idx_assignments_shop_id ON employee_shop_assignments(shop_id);
CREATE INDEX idx_assignments_status ON employee_shop_assignments(status);
