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
  Stack
} from '@/shared/components';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (_data: ForgotPasswordInput) => {
    setIsLoading(true);
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setIsSubmitted(true);
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
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack gap="md">
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
    </div>
  );
};
