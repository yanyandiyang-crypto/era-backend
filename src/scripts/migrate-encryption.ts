import { PrismaClient } from '@prisma/client';
import { DataEncryptionService } from '../core/utils/data-encryption.service';
import { logger } from '../core/utils/logger';

/**
 * Migration script to encrypt existing sensitive data
 * Run this once after deploying the encryption middleware
 */
export async function migrateExistingData() {
  const prisma = new PrismaClient();
  const encryptionService = new DataEncryptionService();

  logger.info('Starting data encryption migration...');

  try {
    // Migrate User phone numbers
    logger.info('Migrating User phone numbers...');
    const users = await prisma.user.findMany({ select: { id: true, phone: true } });
    for (const user of users) {
      if (user.phone && !encryptionService.isEncrypted(user.phone)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { phone: encryptionService.encrypt(user.phone) }
        });
      }
    }

    // Migrate Personnel phone and address
    logger.info('Migrating Personnel phone and address...');
    const personnel = await prisma.personnel.findMany({
      select: { id: true, phone: true, address: true }
    });
    for (const person of personnel) {
      const updateData: Record<string, string> = {};
      if (person.phone && !encryptionService.isEncrypted(person.phone)) {
        updateData.phone = encryptionService.encrypt(person.phone);
      }
      if (person.address && !encryptionService.isEncrypted(person.address)) {
        updateData.address = encryptionService.encrypt(person.address);
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.personnel.update({
          where: { id: person.id },
          data: updateData
        });
      }
    }

    // Migrate Incident reporter data
    logger.info('Migrating Incident reporter data...');
    const incidents = await prisma.incident.findMany({
      select: { id: true, reporterPhone: true }
    });
    for (const incident of incidents) {
      const updateData: Record<string, string> = {};
      if (incident.reporterPhone && !encryptionService.isEncrypted(incident.reporterPhone)) {
        updateData.reporterPhone = encryptionService.encrypt(incident.reporterPhone);
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.incident.update({
          where: { id: incident.id },
          data: updateData
        });
      }
    }

    // Migrate EmergencyContact phone numbers
    logger.info('Migrating EmergencyContact phone numbers...');
    const emergencyContacts = await prisma.emergencyContact.findMany({
      select: { id: true, phone: true }
    });
    for (const contact of emergencyContacts) {
      if (contact.phone && !encryptionService.isEncrypted(contact.phone)) {
        await prisma.emergencyContact.update({
          where: { id: contact.id },
          data: { phone: encryptionService.encrypt(contact.phone) }
        });
      }
    }

    logger.info('Data encryption migration completed successfully');

  } catch (error) {
    logger.error('Data encryption migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI runner
if (require.main === module) {
  migrateExistingData()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}