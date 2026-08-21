CREATE TYPE employee_status AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    job_title VARCHAR(100) DEFAULT '',
    status employee_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_linked_user FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_employees_business_id ON employees(business_id);
CREATE INDEX idx_employees_linked_user_id ON employees(linked_user_id);
CREATE INDEX idx_employees_status ON employees(status);
