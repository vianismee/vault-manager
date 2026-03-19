/**
 * Test encryption/decryption to debug the issue
 * Run this in the browser console to verify
 */

import { encrypt, decrypt } from '../encryption';

// Test 1: Basic encryption/decryption
const testPassword = 'MyTestPassword123!';
const encrypted = encrypt(testPassword);
console.log('Encrypted:', encrypted);

const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', testPassword === decrypted);

// Test 2: Decrypt a known password from DB
const dbEncrypted = 'U2FsdGVkX1/w0/F6T6Pom9Aglm93mtC/iBVayazMExQ=';
const dbDecrypted = decrypt(dbEncrypted);
console.log('DB Decrypted:', dbDecrypted);

// Test 3: Check if env key is loaded
console.log('Env key loaded:', !!process.env.NEXT_PUBLIC_ENCRYPTION_KEY);
