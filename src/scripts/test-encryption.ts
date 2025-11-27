import { DataEncryptionService } from '../core/utils/data-encryption.service';

/**
 * Test script to verify data encryption/decryption functionality
 */
async function testEncryption() {
  const encryptionService = new DataEncryptionService();

  console.log('Testing Data Encryption Service...\n');

  // Test data
  const testPhone = '+63 912 345 6789';
  const testAddress = '123 Main Street, Barangay Central, City';
  const testEmail = 'test@example.com'; // Should not be encrypted

  console.log('Original data:');
  console.log('Phone:', testPhone);
  console.log('Address:', testAddress);
  console.log('Email:', testEmail);
  console.log();

  // Test encryption
  const encryptedPhone = encryptionService.encrypt(testPhone);
  const encryptedAddress = encryptionService.encrypt(testAddress);
  const encryptedEmail = encryptionService.encrypt(testEmail);

  console.log('Encrypted data:');
  console.log('Phone:', encryptedPhone);
  console.log('Address:', encryptedAddress);
  console.log('Email:', encryptedEmail);
  console.log();

  // Test decryption
  const decryptedPhone = encryptionService.decrypt(encryptedPhone);
  const decryptedAddress = encryptionService.decrypt(encryptedAddress);
  const decryptedEmail = encryptionService.decrypt(encryptedEmail);

  console.log('Decrypted data:');
  console.log('Phone:', decryptedPhone);
  console.log('Address:', decryptedAddress);
  console.log('Email:', decryptedEmail);
  console.log();

  // Verify results
  const phoneMatch = decryptedPhone === testPhone;
  const addressMatch = decryptedAddress === testAddress;
  const emailMatch = decryptedEmail === testEmail;

  console.log('Verification:');
  console.log('Phone match:', phoneMatch);
  console.log('Address match:', addressMatch);
  console.log('Email match:', emailMatch);
  console.log();

  if (phoneMatch && addressMatch && emailMatch) {
    console.log('✅ All encryption/decryption tests passed!');
  } else {
    console.log('❌ Some tests failed!');
    process.exit(1);
  }

  // Test object encryption/decryption
  console.log('\nTesting object field encryption...');
  const testObject = {
    id: '123',
    name: 'John Doe',
    phone: testPhone,
    address: testAddress,
    email: testEmail
  };

  console.log('Original object:', testObject);

  const encryptedObject = encryptionService.encryptObjectFields(testObject, ['phone', 'address']);
  console.log('Encrypted object:', encryptedObject);

  const decryptedObject = encryptionService.decryptObjectFields(encryptedObject, ['phone', 'address']);
  console.log('Decrypted object:', decryptedObject);

  const objectMatch = JSON.stringify(testObject) === JSON.stringify(decryptedObject);
  console.log('Object encryption/decryption match:', objectMatch);

  if (objectMatch) {
    console.log('✅ Object encryption/decryption tests passed!');
  } else {
    console.log('❌ Object tests failed!');
    process.exit(1);
  }

  console.log('\n🎉 All tests completed successfully!');
}

// Run the test
testEncryption().catch(console.error);