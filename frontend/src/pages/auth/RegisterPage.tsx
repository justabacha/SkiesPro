import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema, RegisterInput } from '@/shared/utils/validation/authSchemas';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  Button,
  Input,
  FormGroup,
  Card,
  Container,
  Stack,
  PhoneInput,
  PasswordInput,
  Modal
} from '@/shared/components';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useState } from 'react';

export const RegisterPage = () => {
  const { register: signup, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<RegisterInput | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const preSubmit = (data: RegisterInput) => {
    setFormData(data);
    setIsConfirmModalOpen(true);
  };

  const onConfirmSubmit = async () => {
    if (!formData) return;
    setIsConfirmModalOpen(false);
    try {
      await signup(formData);
      setIsSuccess(true);
      setTimeout(() => navigate('/login', { state: { registered: true } }), 2000);
    } catch (err) {
      // Error handled in context
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
        <Container className="max-w-md text-center">
          <Card className="p-8">
            <Stack gap="md" align="center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <h2 className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">Registration Successful!</h2>
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                Your account has been created. Redirecting to login...
              </p>
              <Link to="/login" className="w-full">
                <Button variant="secondary" className="w-full">Go to Login</Button>
              </Link>
            </Stack>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <Container className="max-w-lg">
        <Stack gap="lg">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded bg-brand flex items-center justify-center text-white text-2xl font-bold mb-4">S</div>
            <h2 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              Create an account
            </h2>
            <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Join thousands of traders on SkiesPro
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Display Name" error={errors.displayName?.message}>
                    <Input
                      {...register('displayName')}
                      placeholder="Amos Ryan"
                      error={!!errors.displayName}
                    />
                  </FormGroup>

                  <FormGroup label="Phone Number" error={errors.phone?.message}>
                    <PhoneInput
                      {...register('phone')}
                      error={!!errors.phone}
                    />
                  </FormGroup>
                </div>

                <FormGroup label="Email Address" error={errors.email?.message}>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="name@example.com"
                    error={!!errors.email}
                  />
                </FormGroup>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Password" error={errors.password?.message}>
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
                </div>

                <FormGroup label="Referral Code (Optional)" error={errors.referralCode?.message}>
                  <Input
                    {...register('referralCode')}
                    placeholder="REF123"
                    error={!!errors.referralCode}
                  />
                </FormGroup>

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Create Account
                </Button>
              </Stack>
            </form>
          </Card>

          <p className="text-center text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
              Sign in
            </Link>
          </p>
        </Stack>
      </Container>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Details"
      >
        <Stack gap="lg">
          <div className="p-4 rounded-md bg-bg-light-tertiary dark:bg-bg-dark-tertiary border border-border-light dark:border-border-dark">
            <Stack gap="sm">
              <div className="flex justify-between">
                <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Name</span>
                <span className="text-sm font-medium">{formData?.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Email</span>
                <span className="text-sm font-medium">{formData?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Phone</span>
                <span className="text-sm font-medium">{formData?.phone}</span>
              </div>
            </Stack>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md bg-info-light border border-info/20 text-info text-xs">
            <Info className="h-4 w-4 shrink-0" />
            <p>Please ensure your email and phone number are correct for account verification.</p>
          </div>

          <Stack direction="row" gap="md" justify="end">
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>
              Edit Details
            </Button>
            <Button variant="primary" onClick={onConfirmSubmit} isLoading={isLoading}>
              Confirm & Register
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </div>
  );
};
