import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, ResetPasswordInput } from '@/shared/utils/validation/authSchemas';
import {
  Button,
  FormGroup,
  Card,
  Container,
  Stack,
  PasswordInput,
  Modal
} from '@/shared/components';
import { useState, useEffect } from 'react';
import { AlertCircle, ShieldQuestion } from 'lucide-react';
import { apiClient } from '@/shared/services/apiClient';

export const ResetPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<ResetPasswordInput | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.');
    }
  }, [token]);

  const preSubmit = (data: ResetPasswordInput) => {
    setFormData(data);
    setIsConfirmModalOpen(true);
  };

  const onConfirmSubmit = async () => {
    if (!token || !formData) return;
    setIsConfirmModalOpen(false);
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/auth/reset-password', {
        token,
        new_password: formData.password,
      });
      navigate('/login', { state: { passwordReset: true } });
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
            <form onSubmit={handleSubmit(preSubmit)}>
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
                    disabled={!token}
                  />
                </FormGroup>

                <FormGroup label="Confirm Password" error={errors.confirmPassword?.message}>
                  <PasswordInput
                    {...register('confirmPassword')}
                    placeholder="••••••••"
                    error={!!errors.confirmPassword}
                    disabled={!token}
                  />
                </FormGroup>

                <Button type="submit" className="w-full" isLoading={isLoading} disabled={!token}>
                  Reset Password
                </Button>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Container>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Password Reset"
      >
        <Stack gap="lg">
          <div className="flex items-center gap-3">
            <ShieldQuestion className="h-10 w-10 text-brand" />
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Are you sure you want to update your password? This will sign you out of all other devices.
            </p>
          </div>
          <Stack direction="row" gap="md" justify="end">
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirmSubmit} isLoading={isLoading}>
              Update Password
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </div>
  );
};
