import dotenv from 'dotenv';

// Load environment variables before tests run
dotenv.config();

// Set test-specific defaults if not provided
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
