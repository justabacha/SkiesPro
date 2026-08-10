import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { resetPasswordSchema, ResetPasswordInput } from '@/shared/utils/validation/authSchemas';
import {
  Button,
  FormGroup,
  Card,
  Container,
  Stack,
  PasswordInput
} from '@/shared/components';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

export const ResetPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (_data: ResetPasswordInput) => {
    setIsLoading(true);
    setError(null);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      navigate('/login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <Container className="max-w-md">
        <Stack gap="lg">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              Set new password
            </h2>
            <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Your new password must be different from previous ones.
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

                <FormGroup label="New Password" error={errors.password?.message}>
                  <PasswordInput
                    {...register('password')}
                    placeholder="••••••••"
                    error={!!errors.password}
                  />
                </FormGroup>

                <FormGroup label="Confirm Password" error={errors.confirmPassword?.message}>
                  <PasswordInput
                    {...register('confirmPassword')}
                    placeholder="••••••••"
                    error={!!errors.confirmPassword}
                  />
                </FormGroup>

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Reset Password
                </Button>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Container>
    </div>
  );
};
