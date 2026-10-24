import React, { useEffect, useMemo, useState } from 'react';
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
import { usePublicConfig } from '@/shared/hooks/usePublicConfig';
import { formatKES } from '@/shared/utils/currencyUtils';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const createDepositSchema = (min: number, max: number) =>
  z.object({
    amount: z.string().refine((value) => {
      const amount = Number(value);
      return Number.isFinite(amount) && amount >= min && amount <= max;
    }, { message: `Deposit amount must be between KES ${min} and KES ${max}` }),
    phone: z.string().regex(/^(?:254|\+254|0)?([71][0-9]{8})$/, {
      message: 'Please enter a valid Safaricom phone number',
    }),
  });

interface DepositFormProps {
  onSuccess: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({ onSuccess }) => {
  const { initiateDeposit } = useWallet({ accountMode: 'real' });
  const config = usePublicConfig();
  const [status, setState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setError] = useState<string | null>(null);
  const depositSchema = useMemo(
    () => createDepositSchema(config.minDeposit, config.maxDeposit),
    [config.minDeposit, config.maxDeposit]
  );
  type DepositInput = z.infer<typeof depositSchema>;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: String(config.minDeposit),
    }
  });
  useEffect(() => {
    setValue('amount', String(config.minDeposit), { shouldValidate: true });
  }, [config.minDeposit, setValue]);

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

  const quickAmounts = Array.from(
    new Set([config.minDeposit, config.minDeposit * 2, config.minDeposit * 5])
  ).filter((amount) => amount <= config.maxDeposit);

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

        {config.error && (
          <div className="text-xs text-amber-600">Using default limits; latest settings could not be loaded.</div>
        )}

        <FormGroup label="Deposit Amount (KES)" error={errors.amount?.message}>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setValue('amount', String(amt))}
              >
                {formatKES(amt, false)}
              </Button>
            ))}
          </div>
          <Input
            {...register('amount')}
            type="number"
            placeholder={`KES ${config.minDeposit}–${config.maxDeposit}`}
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
