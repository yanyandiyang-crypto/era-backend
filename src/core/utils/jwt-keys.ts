// Utility to generate and load RSA keys for JWT RS256 signing
import fs from 'fs';
import path from 'path';

const privateKeyPath = path.resolve(__dirname, '../../../keys/jwtRS256.key');
const publicKeyPath = path.resolve(__dirname, '../../../keys/jwtRS256.key.pub');

export function getPrivateKey(): string {
  const key = fs.readFileSync(privateKeyPath, 'utf8');
  // console.log('[JWT Keys] ✅ Private key loaded successfully');
  return key;
}

export function getPublicKey(): string {
  const key = fs.readFileSync(publicKeyPath, 'utf8');
  // console.log('[JWT Keys] ✅ Public key loaded successfully');
  return key;
}
