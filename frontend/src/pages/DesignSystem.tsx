import React, { useState } from 'react';
import {
  Button,
  Input,
  Label,
  Avatar,
  Card,
  Modal,
  ToastContainer,
  Spinner,
  Badge,
  FormGroup,
  PasswordInput,
  PhoneInput,
  Container,
  Stack,
} from '@/shared/components';
import { useTheme } from '@/shared/context/ThemeContext';
import { Sun, Moon, Bell, Search } from 'lucide-react';

const DesignSystemPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'warning' | 'danger' | 'info'; message: string }[]>([]);

  const addToast = (type: 'success' | 'warning' | 'danger' | 'info', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  return (
    <div className="min-h-screen py-12">
      <Container>
        <Stack gap="xl">
          <header className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-6">
            <Stack gap="xs">
              <h1 className="text-3xl font-bold font-sans">SkiesPro Design System</h1>
              <p className="text-text-light-secondary dark:text-text-dark-secondary">
                Atomic components for the SkiesPro trading platform.
              </p>
            </Stack>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'light' ? (
                <Moon className="h-4 w-4 mr-2" />
              ) : (
                <Sun className="h-4 w-4 mr-2" />
              )}
              Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode
            </Button>
          </header>

          <section>
            <h2 className="text-xl font-bold mb-4">Typography & Colors</h2>
            <Card className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Stack gap="md">
                <p className="text-3xl font-bold">Inter Bold 32px</p>
                <p className="text-2xl font-semibold">Inter Semi-Bold 24px</p>
                <p className="text-xl font-medium">Inter Medium 20px</p>
                <p className="text-base">Inter Regular 16px</p>
                <p className="text-sm font-mono">JetBrains Mono 14px - $1,250.45</p>
              </Stack>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-16 w-full bg-brand rounded-md flex items-end p-2 text-[10px] text-white font-bold">
                  BRAND #2563EB
                </div>
                <div className="h-16 w-full bg-success rounded-md flex items-end p-2 text-[10px] text-white font-bold">
                  SUCCESS #059669
                </div>
                <div className="h-16 w-full bg-danger rounded-md flex items-end p-2 text-[10px] text-white font-bold">
                  DANGER #DC2626
                </div>
                <div className="h-16 w-full bg-warning rounded-md flex items-end p-2 text-[10px] text-white font-bold">
                  WARNING #D97706
                </div>
                <div className="h-16 w-full bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark rounded-md flex items-end p-2 text-[10px] font-bold">
                  CARD BG
                </div>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">Buttons</h2>
            <Card>
              <Stack direction="row" gap="md" align="center" className="flex-wrap">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="danger">Danger</Button>
                <Button size="sm">Small Button</Button>
                <Button variant="primary" isLoading>
                  Loading
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
                <Button variant="secondary" size="icon">
                  <Bell className="h-5 w-5" />
                </Button>
              </Stack>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="buy-up">HIGHER (Predict ↑)</Button>
                <Button variant="buy-down">LOWER (Predict ↓)</Button>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">Forms</h2>
            <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormGroup label="Display Name" hint="How you'll appear to others.">
                <Input placeholder="e.g. Amos Ryan" />
              </FormGroup>
              <FormGroup label="Email Address" required error="Please enter a valid email.">
                <Input type="email" placeholder="skiespro.ltd@gmail.com" error />
              </FormGroup>
              <FormGroup label="Phone Number" required>
                <PhoneInput />
              </FormGroup>
              <FormGroup label="Password">
                <PasswordInput placeholder="Enter your password" />
              </FormGroup>
              <FormGroup label="Search Assets">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light-tertiary" />
                  <Input className="pl-10" placeholder="BTC, EUR/USD, Gold..." />
                </div>
              </FormGroup>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">Status & Feedback</h2>
            <Card>
              <Stack gap="lg">
                <Stack direction="row" gap="md">
                  <Badge variant="success">Verified</Badge>
                  <Badge variant="warning">Pending</Badge>
                  <Badge variant="danger">Rejected</Badge>
                  <Badge variant="info">Settling</Badge>
                  <Badge variant="neutral">Draft</Badge>
                </Stack>

                <Stack direction="row" gap="md">
                  <Button onClick={() => addToast('success', 'Trade won! +$90.00')}>
                    Show Success Toast
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => addToast('danger', 'Insufficient balance.')}
                  >
                    Show Error Toast
                  </Button>
                  <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                    Open Modal
                  </Button>
                </Stack>

                <Stack direction="row" gap="xl" align="center">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                  <Avatar name="Amos Ryan" />
                  <Avatar name="John Doe" size="sm" />
                  <Avatar src="https://github.com/shadcn.png" name="CN" />
                </Stack>
              </Stack>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">Stats & Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="stat">
                <Stack gap="xxs">
                  <Label
                    size="sm"
                    className="text-text-light-secondary dark:text-text-dark-secondary"
                  >
                    TOTAL BALANCE
                  </Label>
                  <p className="text-2xl font-mono font-bold">$1,250.00</p>
                </Stack>
              </Card>
              <Card variant="stat">
                <Stack gap="xxs">
                  <Label
                    size="sm"
                    className="text-text-light-secondary dark:text-text-dark-secondary"
                  >
                    TODAY'S P&L
                  </Label>
                  <p className="text-2xl font-mono font-bold text-success">+$45.00</p>
                </Stack>
              </Card>
              <Card variant="stat">
                <Stack gap="xxs">
                  <Label
                    size="sm"
                    className="text-text-light-secondary dark:text-text-dark-secondary"
                  >
                    OPEN TRADES
                  </Label>
                  <p className="text-2xl font-mono font-bold text-brand">3</p>
                </Stack>
              </Card>
              <Card variant="stat">
                <Stack gap="xxs">
                  <Label
                    size="sm"
                    className="text-text-light-secondary dark:text-text-dark-secondary"
                  >
                    WIN RATE
                  </Label>
                  <p className="text-2xl font-mono font-bold text-success">72%</p>
                </Stack>
              </Card>
            </div>
          </section>
        </Stack>
      </Container>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Confirm Trade">
        <Stack gap="md">
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Are you sure you want to place a <span className="text-success font-bold">Higher</span>{' '}
            trade for
            <span className="font-bold"> EUR/USD</span> with a stake of{' '}
            <span className="font-mono">$50.00</span>?
          </p>
          <Stack direction="row" gap="md" justify="end">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsModalOpen(false);
                addToast('info', 'Trade placed successfully.');
              }}
            >
              Confirm
            </Button>
          </Stack>
        </Stack>
      </Modal>

      <ToastContainer toasts={toasts} setToasts={setToasts} />
    </div>
  );
};

export default DesignSystemPage;
