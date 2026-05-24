import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Hash a password using PBKDF2 followed by Bcrypt.
 * PBKDF2 is used to pre-hash the password to bypass bcrypt's 72-byte limit 
 * and add an additional layer of security.
 */
export async function hashPassword(password: string): Promise<string> {
  // Step 1: PBKDF2
  // We use a fixed salt for PBKDF2 here because bcrypt will generate its own unique salt.
  // The goal of this PBKDF2 step is simply to stretch the key and condense it.
  const pbkdf2Hash = crypto.pbkdf2Sync(password, 'static-app-salt-blockcanvas', 100000, 64, 'sha512').toString('base64');
  
  // Step 2: Bcrypt
  const salt = await bcrypt.genSalt(10);
  const finalHash = await bcrypt.hash(pbkdf2Hash, salt);
  
  return finalHash;
}

/**
 * Verify a password against a stored double-hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // If it's a legacy plaintext password, fail securely or handle migration upstream
  if (!storedHash || !storedHash.startsWith('$2')) {
    return false;
  }
  
  // Step 1: PBKDF2 the input
  const pbkdf2Hash = crypto.pbkdf2Sync(password, 'static-app-salt-blockcanvas', 100000, 64, 'sha512').toString('base64');
  
  // Step 2: Bcrypt compare
  return await bcrypt.compare(pbkdf2Hash, storedHash);
}
