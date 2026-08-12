import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { mfaSchema, MfaInput } from '@/shared/utils/validation/authSchemas';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  Button,
  Input,
  FormGroup,
  Card,
  Container,
  Stack
} from '@/shared/components';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';

export const MfaPage = () => {
  const { verifyMfa, isLoading, error, isAuthenticated, userId } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MfaInput>({
    resolver: zodResolver(mfaSchema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    } else if (!userId) {
      // If we don't have a userId, we shouldn't be here
      navigate('/login');
    }
  }, [isAuthenticated, userId, navigate]);

  const onSubmit = async (data: MfaInput) => {
    try {
      await verifyMfa(data.totpCode);
    } catch (err) {
      // Error is handled in context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <Container className="max-w-md">
        <Stack gap="lg">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-brand-light flex items-center justify-center text-brand mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              Verify your identity
            </h2>
            <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack gap="md">
                {error && (
                  <div className="p-3 rounded-md bg-danger-light border border-danger/20 flex items-center gap-2 text-danger text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <FormGroup label="Verification Code" error={errors.totpCode?.message}>
                  <Input
                    {...register('totpCode')}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl tracking-[1em] font-mono"
                    error={!!errors.totpCode}
                  />
                </FormGroup>

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Verify
                </Button>

                <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>
                  Back to Login
                </Button>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Container>
    </div>
  );
};
