import dotenv from 'dotenv';

// Load environment variables before tests run
dotenv.config();

// Set test-specific defaults if not provided
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const privPEM = "-----BEGIN PRIVATE KEY-----\nMIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAMfUux4fmHz6d8Lj\nCBGWMttEssyRTq6cVS3B6+RVX2iQgPJF+P1wA5oGlBeRSa+looPKd7T68x3b+d08\nb83ppHYmlIxvY3WYqqB5s8HJqIZ3Yr1l4w8mNpjB8k4tD82kHwMFbPRMCZJOKoJu\niL4gGdW43F1sa4vA6KxMSf5bm7PxAgMBAAECgYA2trBlFxGRZqLT4YWcCxvxnWW3\nTTHV7UgFN0t3QUjWQHqN20rJWZoi2hpCOa2LQja1DwKnsu5OBqTrRlj2cDpvAq0e\nR2G44Zhax1ub+v5iqgm3D+noQFphJehovXxBV3A/3CUTlm4sV0uNQgQOM9lvD8Cm\nj9KuTKu+dH+QL1nugQJBAPq+prjedVeUlujxrJEjywTol2+U77FjbooZsJtFXjGx\nJRVgnqE17oAgIwxsVJdKSa9zqlIpA/89tcAy+WK+zr0CQQDMBOgLqaJGi/0D07nR\n/lEu9k8kDwFLA8ObzegDn8Qx6+EvUk1JGpdJTjd4sMgm49I2JzYezrZU+/PrMNxb\nNxdFAkBmAkYFk8sdNEAoyJkx+uPPPWjOZkMVYaRI3qawpInroWu6xLIEV9KNoYVg\nunm3iutrS50RC8qqfkqAxLwcZg/pAkEAkjqOCxXpvsDFd4HAtRegHpXiQYkTty2a\nfUjHHBneKJ3Vh/JofJY3iw4pyjKDMwSlfbT7IHeuzhjMSm1581L4NQJBAO1nH+CT\nOL3YJfjAk0gW+k69UQkvkqSohKvaQeDGMDSJoN1ulP0Bi4bW5zUtISca+BoBtPDk\nI9j/s9tQcPjC6jg=\n-----END PRIVATE KEY-----\n";
const pubPEM = "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDH1LseH5h8+nfC4wgRljLbRLLM\nkU6unFUtwevkVV9okIDyRfj9cAOaBpQXkUmvpaKDyne0+vMd2/ndPG/N6aR2JpSM\nb2N1mKqgebPByaiGd2K9ZeMPJjYwfJOLQ/NpB8DBWz0TAmSTiqCboi+IBnVuNxd\nbGuLwOisTEn+W5uz8QIDAQAB\n-----END PUBLIC KEY-----\n";

process.env.JWT_PRIVATE_KEY = privPEM;
process.env.JWT_PUBLIC_KEY = pubPEM;
process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || Buffer.from('12345678901234567890123456789012').toString('base64');

// Set global Jest timeout
jest.setTimeout(60000);
