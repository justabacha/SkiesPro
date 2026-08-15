import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const depositSchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 500;
  }, { message: 'Minimum deposit is KES 500' }),
  phone: z.string().regex(/^(?:254|\+254|0)?([71][0-9]{8})$/, {
    message: 'Please enter a valid Safaricom phone number',
  }),
});

type DepositInput = z.infer<typeof depositSchema>;

interface DepositFormProps {
  onSuccess: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({ onSuccess }) => {
  const { initiateDeposit } = useWallet();
  const [status, setState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: '500',
    }
  });

  const onSubmit = async (data: DepositInput) => {
    setState('processing');
    setError(null);
    try {
      // Normalize phone to 254...
      const normalizedPhone = data.phone.replace(/^\+/, '').replace(/^0/, '254');
      await initiateDeposit({
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

  const quickAmounts = ['500', '1000', '2000', '5000'];

  if (status === 'success') {
    return (
      <Stack align="center" gap="md" className="py-8">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <h3 className="text-xl font-bold">STK Push Sent!</h3>
        <p className="text-center text-text-light-secondary dark:text-text-dark-secondary">
          Please check your phone and enter your M-Pesa PIN to complete the deposit.
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

        <FormGroup label="Deposit Amount (KES)" error={errors.amount?.message}>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setValue('amount', amt)}
              >
                {formatKES(amt, false)}
              </Button>
            ))}
          </div>
          <Input
            {...register('amount')}
            type="number"
            placeholder="Min 500"
            className="font-mono"
            error={!!errors.amount}
          />
        </FormGroup>

        <FormGroup label="M-Pesa Phone Number" error={errors.phone?.message}>
          <PhoneInput
            {...register('phone')}
            placeholder="0712345678"
            error={!!errors.phone}
          />
          <p className="text-[10px] text-text-light-tertiary mt-1">
            Ensure this number is registered with M-Pesa.
          </p>
        </FormGroup>

        <Button
          type="submit"
          className="w-full h-12"
          isLoading={status === 'processing'}
          disabled={isSubmitting}
        >
          {status === 'processing' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Initializing STK Push...
            </span>
          ) : (
            'Deposit via M-Pesa'
          )}
        </Button>
      </Stack>
    </form>
  );
};
