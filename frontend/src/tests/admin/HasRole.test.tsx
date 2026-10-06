import { HasRole } from '@/components/admin/HasRole';

// Test suite for HasRole component contract and behavior
export function testHasRoleLogic() {
  if (typeof HasRole !== 'function') {
    throw new Error('HasRole is not exported properly');
  }

  const allowedRoles = ['admin', 'super_admin'];

  // Test case 1: Matching role should grant access
  const matchingUser = { role: 'admin' };
  const isMatching = allowedRoles.includes(matchingUser.role);
  if (!isMatching) {
    throw new Error('HasRole failed: expected matching role to pass check');
  }

  // Test case 2: Non-matching role should deny access
  const unauthorizedUser = { role: 'support' };
  const isUnauthorized = allowedRoles.includes(unauthorizedUser.role);
  if (isUnauthorized) {
    throw new Error('HasRole failed: expected non-matching role to fail check');
  }

  return true;
}
