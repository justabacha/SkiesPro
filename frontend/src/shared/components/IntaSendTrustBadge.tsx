import React from 'react';
import { useTheme } from '@/shared/hooks/useTheme';

export const IntaSendTrustBadge: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const badgeSrc = isDark
    ? 'https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-dark.png'
    : 'https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-light.png';

  const textColor = isDark ? '#fafafa' : '#454545';

  return (
    <div className="flex flex-col items-center justify-center mt-2">
      <a href="https://intasend.com/security" target="_blank" rel="noopener noreferrer">
        <img
          src={badgeSrc}
          width="375px"
          alt="IntaSend Secure Payments (PCI-DSS Compliant)"
          className="max-w-full h-auto"
        />
      </a>
      <p
        style={{
          color: textColor,
          fontSize: '0.8em',
          marginTop: '0.6em',
          fontWeight: 500,
          opacity: 0.9,
          textAlign: 'center',
        }}
      >
        SkiesPro values your account security. Payments are securely processed by IntaSend.
      </p>
    </div>
  );
};
