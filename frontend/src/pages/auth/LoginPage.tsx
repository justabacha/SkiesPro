import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema, LoginInput } from '@/shared/utils/validation/authSchemas';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  Button,
  Input,
  FormGroup,
  Card,
  Container,
  Stack
} from '@/shared/components';
import { AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const { login, isLoading, error, requiresMfa } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    await login(data);
    if (!requiresMfa && !error) {
      navigate('/');
    } else if (requiresMfa) {
      navigate('/verify-otp');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <Container className="max-w-md">
        <Stack gap="lg">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded bg-brand flex items-center justify-center text-white text-2xl font-bold mb-4">S</div>
            <h2 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Sign in to your SkiesPro account
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

                <FormGroup label="Email Address" error={errors.email?.message}>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    error={!!errors.email}
                  />
                </FormGroup>

                <FormGroup label="Password" error={errors.password?.message}>
                  <Input
                    {...register('password')}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    error={!!errors.password}
                  />
                </FormGroup>

                <div className="flex items-center justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Sign in
                </Button>
              </Stack>
            </form>
          </Card>

          <p className="text-center text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-brand hover:text-brand-hover">
              Register now
            </Link>
          </p>
        </Stack>
      </Container>
    </div>
  );
};
