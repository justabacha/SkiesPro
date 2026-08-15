import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Input,
  FormGroup,
  Stack,
  PhoneInput,
} from '@/shared/components';
import { useWallet } from '@/shared/hooks/useWallet';
import { formatKES } from '@/shared/utils/currencyUtils';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const withdrawSchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 1500;
  }, { message: 'Minimum withdrawal is KES 1,500' }),
  phone: z.string().regex(/^(?:254|\+254|0)?([71][0-9]{8})$/, {
    message: 'Please enter a valid Safaricom phone number',
  }),
});

type WithdrawInput = z.infer<typeof withdrawSchema>;

interface WithdrawFormProps {
  availableBalance: string;
  onSuccess: () => void;
}

export const WithdrawForm: React.FC<WithdrawFormProps> = ({ availableBalance, onSuccess }) => {
  const { requestWithdrawal } = useWallet();
  const [status, setState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawInput>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      amount: '1500',
    }
  });

  const amount = useWatch({ control, name: 'amount' });
  const numAmount = parseFloat(amount) || 0;
  const fee = numAmount * 0.02;
  const netAmount = numAmount - fee;

  const onSubmit = async (data: WithdrawInput) => {
    if (parseFloat(data.amount) > parseFloat(availableBalance)) {
      setError('Insufficient available balance');
      setState('error');
      return;
    }

    setState('idle');
    setError(null);
    try {
      const normalizedPhone = data.phone.replace(/^\+/, '').replace(/^0/, '254');
      await requestWithdrawal({
        amount: data.amount,
        phone: normalizedPhone.startsWith('254') ? normalizedPhone : `254${normalizedPhone}`
      });
      setState('success');
      setTimeout(onSuccess, 3000);
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  };

  if (status === 'success') {
    return (
      <Stack align="center" gap="md" className="py-8">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <h3 className="text-xl font-bold">Request Submitted</h3>
        <p className="text-center text-text-light-secondary dark:text-text-dark-secondary">
          Your withdrawal request has been received and is being processed.
        </p>
      </Stack>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack gap="lg">
        {status === 'error' && (
          <div className="p-3 rounded-md bg-danger-light border border-danger/20 flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="h-4 w-4" />
            {errorMsg}
          </div>
        )}

        <div className="p-4 rounded-md bg-bg-light-tertiary dark:bg-bg-dark-tertiary border border-border-light dark:border-border-dark">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-text-light-tertiary uppercase font-bold">Available for Withdrawal</span>
            <span className="text-sm font-mono font-bold text-success">{formatKES(availableBalance)}</span>
          </div>
        </div>

        <FormGroup label="Withdrawal Amount (KES)" error={errors.amount?.message}>
          <Input
            {...register('amount')}
            type="number"
            placeholder="Min 1,500"
            className="font-mono"
            error={!!errors.amount}
          />
        </FormGroup>

        <FormGroup label="Receiving M-Pesa Number" error={errors.phone?.message}>
          <PhoneInput
            {...register('phone')}
            placeholder="0712345678"
            error={!!errors.phone}
          />
        </FormGroup>

        <div className="space-y-2 p-3 bg-bg-light-secondary dark:bg-bg-dark-secondary rounded border border-border-light dark:border-border-dark">
          <div className="flex justify-between text-xs">
            <span className="text-text-light-tertiary">Processing Fee (2%)</span>
            <span className="font-mono">{formatKES(fee)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-border-light dark:border-border-dark pt-2">
            <span>Net Payout</span>
            <span className="font-mono">{formatKES(netAmount)}</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-info-light border border-info/20 text-info text-[10px]">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          <p>Withdrawals to M-Pesa are usually processed within 2 hours. Large amounts may require manual review.</p>
        </div>

        <Button
          type="submit"
          className="w-full h-12"
          isLoading={isSubmitting}
          disabled={numAmount > parseFloat(availableBalance)}
        >
          Request Withdrawal
        </Button>
      </Stack>
    </form>
  );
};
