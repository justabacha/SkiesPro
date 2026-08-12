import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, ForgotPasswordInput } from '@/shared/utils/validation/authSchemas';
import {
  Button,
  Input,
  FormGroup,
  Card,
  Container,
  Stack,
  Modal
} from '@/shared/components';
import { useState } from 'react';
import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { apiClient } from '@/shared/services/apiClient';

export const ForgotPasswordPage = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<ForgotPasswordInput | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const preSubmit = (data: ForgotPasswordInput) => {
    setFormData(data);
    setIsConfirmModalOpen(true);
  };

  const onConfirmSubmit = async () => {
    if (!formData) return;
    setIsConfirmModalOpen(false);
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/auth/forgot-password', formData);
      setIsSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
        <Container className="max-w-md text-center">
          <Card className="p-8">
            <Stack gap="md" align="center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <h2 className="text-2xl font-bold">Check your email</h2>
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                If an account exists for that email, we've sent instructions to reset your password.
              </p>
              <Link to="/login" className="w-full">
                <Button variant="secondary" className="w-full">Back to Login</Button>
              </Link>
            </Stack>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <Container className="max-w-md">
        <Stack gap="lg">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              Forgot password?
            </h2>
            <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              No worries, we'll send you reset instructions.
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

                <FormGroup label="Email Address" error={errors.email?.message}>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="name@example.com"
                    error={!!errors.email}
                  />
                </FormGroup>

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Reset Password
                </Button>

                <Link to="/login" className="w-full text-center">
                  <span className="text-sm font-medium text-brand hover:text-brand-hover">Back to Login</span>
                </Link>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Container>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Request Password Reset"
      >
        <Stack gap="lg">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-10 w-10 text-brand" />
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Are you sure you want to send a password reset link to <span className="font-bold">{formData?.email}</span>?
            </p>
          </div>
          <Stack direction="row" gap="md" justify="end">
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirmSubmit} isLoading={isLoading}>
              Send Link
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </div>
  );
};
