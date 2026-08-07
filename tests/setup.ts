import dotenv from 'dotenv';

// Load environment variables before tests run
dotenv.config();

// Set test-specific defaults if not provided
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || Buffer.from('test_private_key').toString('base64');
process.env.JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || Buffer.from('test_public_key').toString('base64');
process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || Buffer.from('12345678901234567890123456789012').toString('base64');
