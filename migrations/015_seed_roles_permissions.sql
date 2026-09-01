-- Migration 015: Seed roles and permissions
-- Seeds default roles and permissions as per business requirements

-- Insert roles
INSERT INTO app_auth.roles (name, description) VALUES
('admin', 'Full system administrator with all privileges'),
('trader', 'Standard user who can place trades'),
('support', 'Customer support agent'),
('compliance', 'Compliance officer for KYC/AML review'),
('finance', 'Finance officer for deposit/withdrawal approval')
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
DO $$
DECLARE
    perm_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='permissions' AND column_name='code') THEN
        perm_col := 'code';
    ELSE
        perm_col := 'name';
    END IF;

    EXECUTE format('
    INSERT INTO app_auth.permissions (%I, resource, action, description) VALUES
    (''users.create'', ''users'', ''create'', ''Create new user accounts''),
    (''users.read'', ''users'', ''read'', ''View user information''),
    (''users.update'', ''users'', ''update'', ''Update user information''),
    (''users.delete'', ''users'', ''delete'', ''Delete user accounts''),
    (''trades.create'', ''trades'', ''create'', ''Place new trades''),
    (''trades.read'', ''trades'', ''read'', ''View trade history''),
    (''trades.settle'', ''trades'', ''settle'', ''Settle trades (system)''),
    (''wallet.read'', ''wallet'', ''read'', ''View wallet balance''),
    (''wallet.credit'', ''wallet'', ''credit'', ''Credit wallet (admin)''),
    (''wallet.debit'', ''wallet'', ''debit'', ''Debit wallet (admin)''),
    (''deposits.read'', ''deposits'', ''read'', ''View deposit history''),
    (''deposits.approve'', ''deposits'', ''approve'', ''Approve deposits''),
    (''withdrawals.read'', ''withdrawals'', ''read'', ''View withdrawal history''),
    (''withdrawals.approve'', ''withdrawals'', ''approve'', ''Approve withdrawals''),
    (''kyc.review'', ''kyc'', ''review'', ''Review KYC documents''),
    (''aml.review'', ''aml'', ''review'', ''Review AML flags''),
    (''admin.read'', ''admin'', ''read'', ''View admin logs''),
    (''settings.update'', ''settings'', ''update'', ''Update platform settings'')
    ON CONFLICT (%I) DO NOTHING', perm_col, perm_col);
END $$;

-- Assign permissions to admin role (all permissions)
INSERT INTO app_auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app_auth.roles r
CROSS JOIN app_auth.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to trader role
DO $$
DECLARE
    perm_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='permissions' AND column_name='code') THEN
        perm_col := 'code';
    ELSE
        perm_col := 'name';
    END IF;

    EXECUTE format('
    INSERT INTO app_auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_auth.roles r
    JOIN app_auth.permissions p ON p.%I IN (
      ''users.read'',
      ''users.update'',
      ''trades.create'',
      ''trades.read'',
      ''wallet.read'',
      ''deposits.read'',
      ''withdrawals.read''
    )
    WHERE r.name = ''trader''
    ON CONFLICT (role_id, permission_id) DO NOTHING', perm_col);
END $$;

-- Assign permissions to support role
DO $$
DECLARE
    perm_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='permissions' AND column_name='code') THEN
        perm_col := 'code';
    ELSE
        perm_col := 'name';
    END IF;

    EXECUTE format('
    INSERT INTO app_auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_auth.roles r
    JOIN app_auth.permissions p ON p.%I IN (
      ''users.read'',
      ''trades.read'',
      ''wallet.read'',
      ''deposits.read'',
      ''withdrawals.read'',
      ''kyc.review''
    )
    WHERE r.name = ''support''
    ON CONFLICT (role_id, permission_id) DO NOTHING', perm_col);
END $$;

-- Assign permissions to compliance role
DO $$
DECLARE
    perm_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='permissions' AND column_name='code') THEN
        perm_col := 'code';
    ELSE
        perm_col := 'name';
    END IF;

    EXECUTE format('
    INSERT INTO app_auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_auth.roles r
    JOIN app_auth.permissions p ON p.%I IN (
      ''users.read'',
      ''kyc.review'',
      ''aml.review''
    )
    WHERE r.name = ''compliance''
    ON CONFLICT (role_id, permission_id) DO NOTHING', perm_col);
END $$;

-- Assign permissions to finance role
DO $$
DECLARE
    perm_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='permissions' AND column_name='code') THEN
        perm_col := 'code';
    ELSE
        perm_col := 'name';
    END IF;

    EXECUTE format('
    INSERT INTO app_auth.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_auth.roles r
    JOIN app_auth.permissions p ON p.%I IN (
      ''users.read'',
      ''wallet.read'',
      ''wallet.credit'',
      ''wallet.debit'',
      ''deposits.read'',
      ''deposits.approve'',
      ''withdrawals.read'',
      ''withdrawals.approve''
    )
    WHERE r.name = ''finance''
    ON CONFLICT (role_id, permission_id) DO NOTHING', perm_col);
END $$;
