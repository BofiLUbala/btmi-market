CREATE TYPE employee_invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

CREATE TABLE employee_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    status employee_invitation_status DEFAULT 'PENDING',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_employee_invitations_employee_id ON employee_invitations(employee_id);
CREATE INDEX idx_employee_invitations_token_hash ON employee_invitations(token_hash);
CREATE INDEX idx_employee_invitations_status ON employee_invitations(status);