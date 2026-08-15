import { Link } from 'react-router-dom';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button, Card, Container, Stack } from '@/shared/components';

export const EmailVerificationPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light-tertiary dark:bg-bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <Container className="max-w-md text-center">
        <Stack gap="lg">
          <div className="mx-auto h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center text-brand mb-4">
            <Mail className="h-8 w-8" />
          </div>

          <Stack gap="sm">
            <h2 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              Verify your email
            </h2>
            <p className="text-text-light-secondary dark:text-text-dark-secondary">
              We've sent a verification link to your email address. Please click the link to verify your account.
            </p>
          </Stack>

          <Card className="p-6 text-left">
            <Stack gap="md">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">Check your inbox</h4>
                  <p className="text-xs text-text-light-tertiary mt-1">
                    Click the link in the email we sent you. It might take a few minutes to arrive.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-border-light dark:border-border-dark pt-4">
                <div className="h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-text-light-tertiary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Didn't receive the email?</h4>
                  <p className="text-xs text-text-light-tertiary mt-1">
                    Check your spam folder or click below to resend the verification link.
                  </p>
                </div>
              </div>
            </Stack>
          </Card>

          <Stack gap="md">
            <Button className="w-full">
              Resend Verification Email
            </Button>

            <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-text-light-secondary hover:text-brand transition-colors">
              Back to Login <ArrowRight className="h-4 w-4" />
            </Link>
          </Stack>
        </Stack>
      </Container>
    </div>
  );
};
