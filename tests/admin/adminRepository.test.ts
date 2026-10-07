import { PoolClient } from 'pg';
import { AdminRepository } from '../../src/modules/admin/repositories/AdminRepository';

describe('AdminRepository user data', () => {
  const createRepository = () => {
    const client = { query: jest.fn() };
    return {
      client,
      repository: new AdminRepository(client as unknown as PoolClient),
    };
  };

  it('lists users with one active role selected by the shared role priority', async () => {
    const { client, repository } = createRepository();
    client.query
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', role: 'COMPLIANCE' }] });

    const result = await repository.listUsers({
      page: 2,
      perPage: 10,
      search: 'staff',
    });

    const listQuery = client.query.mock.calls[1][0] as string;
    expect(listQuery).toContain('LEFT JOIN LATERAL');
    expect(listQuery).toContain('ur.revoked_at IS NULL');
    expect(listQuery).toContain("WHEN 'super_admin' THEN 1");
    expect(listQuery).toContain("COALESCE(assigned_role.role, 'TRADER')");
    expect(listQuery).toContain('u.email ILIKE');
    expect(client.query.mock.calls[1][1]).toEqual(['%staff%', 10, 10]);
    expect(result).toEqual({
      rows: [{ id: 'user-1', role: 'COMPLIANCE' }],
      total: 2,
    });
  });

  it('adds role, real/demo wallet balances, and trade statistics to user details', async () => {
    const { client, repository } = createRepository();
    client.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          role: 'RISK_MANAGER',
          real_balance: '19860.0000',
          available_balance: '18360.0000',
          demo_balance: '10000.0000',
          total_trades: 4,
          winning_trades: 3,
        },
      ],
    }).mockResolvedValueOnce({
      rows: [
        {
          id: 'trade-1',
          asset_pair: 'BTC/USD',
          direction: 'higher',
          amount: '100.0000',
          payout: '180.0000',
          result: 'won',
          status: 'won',
          created_at: '2026-10-07T12:00:00.000Z',
        },
      ],
    });

    const result = await repository.getUserById('user-1');

    expect(client.query.mock.calls[0][0]).toContain("WHERE status = 'won'");
    const recentTradesQuery = client.query.mock.calls[1][0] as string;
    expect(recentTradesQuery).toContain('asset_symbol AS asset_pair');
    expect(recentTradesQuery).toContain('contract_type AS direction');
    expect(recentTradesQuery).toContain('potential_payout AS payout');
    expect(recentTradesQuery).toContain('ORDER BY created_at DESC');
    expect(recentTradesQuery).toContain('LIMIT 5');
    expect(client.query.mock.calls[1][1]).toEqual(['user-1']);
    expect(result).toMatchObject({
      id: 'user-1',
      role: 'RISK_MANAGER',
      wallet_balance_kes: 19860,
      demo_balance_kes: 10000,
      total_trades: 4,
      win_rate_pct: 75,
      wallet: {
        real_balance: 19860,
        available_balance: 18360,
        demo_balance: 10000,
      },
      recent_trades: [
        {
          id: 'trade-1',
          asset_pair: 'BTC/USD',
          direction: 'higher',
          amount: '100.0000',
          payout: '180.0000',
          result: 'won',
          status: 'won',
          created_at: '2026-10-07T12:00:00.000Z',
        },
      ],
    });
    expect(result).not.toHaveProperty('real_balance');
    expect(result).not.toHaveProperty('winning_trades');
  });

  it('returns a null win rate when there are no trades', async () => {
    const { client, repository } = createRepository();
    client.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-2',
          role: 'TRADER',
          real_balance: null,
          available_balance: null,
          demo_balance: null,
          total_trades: 0,
          winning_trades: 0,
        },
      ],
    }).mockResolvedValueOnce({ rows: [] });

    const result = await repository.getUserById('user-2');

    expect(result).toMatchObject({
      wallet_balance_kes: 0,
      demo_balance_kes: 0,
      total_trades: 0,
      win_rate_pct: null,
      wallet: {
        real_balance: 0,
        available_balance: 0,
        demo_balance: 0,
      },
    });
  });

  it('counts and returns user ledger entries through the wallet relationship', async () => {
    const { client, repository } = createRepository();
    client.query
      .mockResolvedValueOnce({ rows: [{ count: 6 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-1',
            user_id: 'user-1',
            wallet_id: 'wallet-1',
            amount: '-1500.0000',
            type: 'debit',
            reference_type: 'trade_stake',
            description: 'Trade stake',
            balance_after: '18360.0000',
            currency: 'KES',
          },
        ],
      });

    const result = await repository.getUserLedger('user-1', 2, 10);

    const countQuery = client.query.mock.calls[0][0] as string;
    const rowsQuery = client.query.mock.calls[1][0] as string;
    expect(countQuery).toContain('JOIN wallet.wallets w ON w.id = le.wallet_id');
    expect(rowsQuery).toContain('le.entry_type AS type');
    expect(rowsQuery).toContain('w.currency');
    expect(rowsQuery).toContain('w.user_id = $1');
    expect(client.query.mock.calls[1][1]).toEqual(['user-1', 10, 10]);
    expect(result).toEqual({
      rows: [
        {
          id: 'entry-1',
          user_id: 'user-1',
          wallet_id: 'wallet-1',
          amount: '-1500.0000',
          type: 'debit',
          reference_type: 'trade_stake',
          description: 'Trade stake',
          balance_after: '18360.0000',
          currency: 'KES',
        },
      ],
      total: 6,
    });
  });

  it('returns one flattened KYC application per user with status filtering and pagination', async () => {
    const { client, repository } = createRepository();
    client.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            user_id: 'user-1',
            user_email: 'kyc@example.com',
            user_display_name: 'KYC User',
            doc_type: 'national_id, proof_of_address, selfie',
            status: 'approved',
            id_front_url: 'https://example.com/id.png',
            proof_of_address_url: 'https://example.com/address.png',
            selfie_url: 'https://example.com/selfie.png',
          },
        ],
      });

    const result = await repository.listPendingKyc(2, 5, 'approved');
    const countQuery = client.query.mock.calls[0][0] as string;
    const rowsQuery = client.query.mock.calls[1][0] as string;

    expect(countQuery).toContain('SELECT user_id');
    expect(countQuery).toContain('GROUP BY user_id');
    expect(client.query.mock.calls[0][1]).toEqual(['approved']);
    expect(rowsQuery).toContain('STRING_AGG(DISTINCT kd.document_type');
    expect(rowsQuery).toContain("kd.document_type = 'proof_of_address'");
    expect(rowsQuery).toContain("kd.document_type = 'selfie'");
    expect(rowsQuery).toContain('OR application_status = $1');
    expect(rowsQuery).toContain('GROUP BY u.id, u.email, u.display_name, u.kyc_status');
    expect(rowsQuery).toContain('LIMIT $2 OFFSET $3');
    expect(client.query.mock.calls[1][1]).toEqual(['approved', 5, 5]);
    expect(result).toEqual({
      rows: [
        {
          id: 'user-1',
          user_id: 'user-1',
          user_email: 'kyc@example.com',
          user_display_name: 'KYC User',
          doc_type: 'national_id, proof_of_address, selfie',
          status: 'approved',
          id_front_url: 'https://example.com/id.png',
          proof_of_address_url: 'https://example.com/address.png',
          selfie_url: 'https://example.com/selfie.png',
        },
      ],
      total: 1,
    });
  });

  it('updates pending KYC documents and the parent user status in one query', async () => {
    const { client, repository } = createRepository();
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'document-1', user_id: 'user-1', status: 'approved' }],
    });

    const result = await repository.reviewKyc(
      'user-1',
      'approved',
      'Documents verified',
      'reviewer-1'
    );
    const query = client.query.mock.calls[0][0] as string;

    expect(query).toContain('UPDATE compliance.kyc_documents');
    expect(query).toContain('UPDATE app_auth.users');
    expect(query).toContain("THEN 'verified' ELSE 'rejected' END");
    expect(query).toContain("kd.status = 'pending'");
    expect(client.query.mock.calls[0][1]).toEqual([
      'approved',
      'Documents verified',
      'reviewer-1',
      'user-1',
    ]);
    expect(result).toEqual({ id: 'document-1', user_id: 'user-1', status: 'approved' });
  });
});
