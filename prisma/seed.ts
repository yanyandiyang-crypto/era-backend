import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Super Admin
  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@era.com' },
    update: {},
    create: {
      email: 'admin@era.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+639123456789',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✓ Created admin user:', admin.email);

  // Create sample barangays in Lapu-Lapu City with Emergency Contacts
  const barangay1 = await prisma.barangay.upsert({
    where: { code: 'BRG001' },
    update: {},
    create: {
      name: 'Barangay Basak',
      code: 'BRG001',
      latitude: 10.3120,
      longitude: 123.9600,
      address: 'M.L. Quezon Highway, Basak, Lapu-Lapu City, Cebu 6015',
      description: 'Coastal barangay near Mactan Airport and Gaisano Grand Mall',
      operatingHours: 'Mon-Fri: 8AM-5PM | Emergency: 24/7',
      landmarks: 'Near Gaisano Grand Mall Basak, Mactan Cebu International Airport',
      emergencyContacts: {
        create: [
          {
            name: 'Barangay Hall',
            phone: '+63 32 340 1234',
            type: 'BARANGAY_HALL',
            isPrimary: true,
          },
          {
            name: 'Emergency Hotline',
            phone: '911',
            type: 'EMERGENCY',
          },
          {
            name: 'Barangay Police',
            phone: '+63 32 340 5678',
            type: 'POLICE',
          },
          {
            name: 'Basak Fire Station',
            phone: '+63 32 340 9999',
            type: 'FIRE',
          },
          {
            name: 'Lapu-Lapu City Health Center',
            phone: '+63 32 341 8888',
            type: 'MEDICAL',
          },
        ],
      },
    },
  });

  const barangay2 = await prisma.barangay.upsert({
    where: { code: 'BRG002' },
    update: {},
    create: {
      name: 'Barangay Maribago',
      code: 'BRG002',
      latitude: 10.3050,
      longitude: 123.9750,
      address: 'Maribago Road, Maribago, Lapu-Lapu City, Cebu 6015',
      description: 'Prime tourist area with beach resorts and hotels',
      operatingHours: 'Mon-Fri: 8AM-5PM | 24/7 Tourist Assistance',
      landmarks: 'Pacific Mall, Shangri-La Mactan Resort, JPark Island Resort',
      emergencyContacts: {
        create: [
          {
            name: 'Barangay Hall Maribago',
            phone: '+63 32 495 1234',
            type: 'BARANGAY_HALL',
            isPrimary: true,
          },
          {
            name: 'Emergency Hotline',
            phone: '911',
            type: 'EMERGENCY',
          },
          {
            name: 'Tourist Police',
            phone: '+63 32 495 5678',
            type: 'POLICE',
          },
          {
            name: 'Maribago Fire Brigade',
            phone: '+63 32 495 9999',
            type: 'FIRE',
          },
        ],
      },
    },
  });

  const barangay3 = await prisma.barangay.upsert({
    where: { code: 'BRG003' },
    update: {},
    create: {
      name: 'Barangay Pusok',
      code: 'BRG003',
      latitude: 10.3200,
      longitude: 123.9500,
      address: 'Mactan Circumferential Road, Pusok, Lapu-Lapu City, Cebu 6015',
      description: 'Dense urban residential area with commercial establishments',
      operatingHours: 'Mon-Fri: 7:30AM-5:30PM | Emergency: 24/7',
      landmarks: 'Along Mactan Circumferential Road, near MEPZ',
      emergencyContacts: {
        create: [
          {
            name: 'Barangay Hall Pusok',
            phone: '+63 32 345 1111',
            type: 'BARANGAY_HALL',
            isPrimary: true,
          },
          {
            name: 'Emergency Hotline',
            phone: '911',
            type: 'EMERGENCY',
          },
          {
            name: 'Pusok Police Outpost',
            phone: '+63 32 345 2222',
            type: 'POLICE',
          },
          {
            name: 'Fire Volunteer Brigade',
            phone: '+63 32 345 3333',
            type: 'FIRE',
          },
          {
            name: 'Barangay Health Station',
            phone: '+63 32 345 4444',
            type: 'MEDICAL',
          },
        ],
      },
    },
  });

  console.log('✓ Created barangays:', barangay1.name, barangay2.name, barangay3.name);

  // Create sample personnel
  const personnelPassword = await bcrypt.hash('Personnel@123', 10);

  const responder1 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP001' },
    update: {},
    create: {
      employeeId: 'EMP001',
      email: 'responder1@era.com',
      password: personnelPassword,
      firstName: 'Ricardo',
      lastName: 'Mendoza',
      phone: '+639333333333',
      role: 'RESPONDER',
      status: 'AVAILABLE',
      address: 'Basak, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3125,
          longitude: 123.9605,
        },
      },
    },
  });

  const medic1 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP002' },
    update: {},
    create: {
      employeeId: 'EMP002',
      email: 'medic1@era.com',
      password: personnelPassword,
      firstName: 'Maria',
      lastName: 'Villanueva',
      phone: '+639444444444',
      role: 'MEDIC',
      status: 'AVAILABLE',
      address: 'Maribago, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3055,
          longitude: 123.9755,
        },
      },
    },
  });

  const responder2 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP003' },
    update: {},
    create: {
      employeeId: 'EMP003',
      email: 'responder2@era.com',
      password: personnelPassword,
      firstName: 'Juan',
      lastName: 'Santos',
      phone: '+639555555555',
      role: 'RESPONDER',
      status: 'ON_DUTY',
      address: 'Pusok, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3200,
          longitude: 123.9500,
        },
      },
    },
  });

  const medic2 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP004' },
    update: {},
    create: {
      employeeId: 'EMP004',
      email: 'medic2@era.com',
      password: personnelPassword,
      firstName: 'Ana',
      lastName: 'Garcia',
      phone: '+639666666666',
      role: 'MEDIC',
      status: 'AVAILABLE',
      address: 'Basak, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3110,
          longitude: 123.9590,
        },
      },
    },
  });

  console.log('✓ Created personnel:', responder1.firstName, medic1.firstName, responder2.firstName, medic2.firstName);

  // Create sample incidents in Lapu-Lapu City
  const incident1 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-001' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-001',
      title: 'House Fire in Basak',
      type: 'FIRE',
      priority: 'CRITICAL',
      status: 'PENDING_VERIFICATION',
      description: 'House fire near Gaisano Grand Mall Basak, smoke visible',
      address: 'M.L. Quezon Highway, Basak, Lapu-Lapu City',
      latitude: 10.3125,
      longitude: 123.9605,
      reporterName: 'Jun Reyes',
      reporterPhone: '+639555555555',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  const incident2 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-002' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-002',
      title: 'Elderly Patient - Chest Pain',
      type: 'MEDICAL',
      priority: 'HIGH',
      status: 'PENDING_VERIFICATION',
      description: 'Elderly patient with severe chest pain, possible heart attack',
      address: 'Pacific Mall Maribago, Lapu-Lapu City',
      latitude: 10.3055,
      longitude: 123.9755,
      reporterName: 'Maria Santos',
      reporterPhone: '+639666666666',
      barangayId: barangay2.id,
      createdById: admin.id,
    },
  });

  const incident3 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-003' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-003',
      title: 'Motorcycle Collision - Mactan Circumferential Road',
      type: 'ACCIDENT',
      priority: 'MEDIUM',
      status: 'PENDING_VERIFICATION',
      description: 'Motorcycle-truck collision, driver injured',
      address: 'Mactan Circumferential Road, Pusok, Lapu-Lapu City',
      latitude: 10.3195,
      longitude: 123.9505,
      reporterName: 'Carlos Abad',
      reporterPhone: '+639777777777',
      barangayId: barangay3.id,
      createdById: admin.id,
    },
  });

  const incident4 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-004' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-004',
      title: 'Child Trapped in Drainage',
      type: 'OTHER',
      priority: 'HIGH',
      status: 'PENDING_VERIFICATION',
      description: 'Child fell into drainage canal, needs rescue',
      address: 'Sitio San Vicente, Basak, Lapu-Lapu City',
      latitude: 10.3115,
      longitude: 123.9595,
      reporterName: 'Luz Cruz',
      reporterPhone: '+639888888888',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  const incident5 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-005' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-005',
      title: 'Robbery at Sari-Sari Store',
      type: 'CRIME',
      priority: 'MEDIUM',
      status: 'PENDING_VERIFICATION',
      description: 'Hold-up incident at store, suspect fled',
      address: 'Sitio Maharlika, Basak, Lapu-Lapu City',
      latitude: 10.3130,
      longitude: 123.9610,
      reporterName: 'Rosa Fernandez',
      reporterPhone: '+639999999999',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  const incident6 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-006' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-006',
      title: 'Grass Fire Near Resort',
      type: 'FIRE',
      priority: 'LOW',
      status: 'PENDING_VERIFICATION',
      description: 'Small grass fire near beach resort area',
      address: 'Maribago Beach Road, Lapu-Lapu City',
      latitude: 10.3045,
      longitude: 123.9760,
      reporterName: 'Lisa Gonzales',
      reporterPhone: '+639101010101',
      barangayId: barangay2.id,
      createdById: admin.id,
    },
  });

  const incident7 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-007' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-007',
      title: 'Worker Fall at Construction Site',
      type: 'MEDICAL',
      priority: 'CRITICAL',
      status: 'PENDING_VERIFICATION',
      description: 'Construction worker fell from scaffolding, severe injuries',
      address: 'New Condo Project, Pusok, Lapu-Lapu City',
      latitude: 10.3210,
      longitude: 123.9510,
      reporterName: 'Engr. David Tan',
      reporterPhone: '+639121212121',
      barangayId: barangay3.id,
      createdById: admin.id,
    },
  });

  const incident8 = await prisma.incident.upsert({
    where: { incidentNumber: 'INC-2024-008' },
    update: {},
    create: {
      incidentNumber: 'INC-2024-008',
      title: 'Coastal Flooding - Storm Surge',
      type: 'FLOOD',
      priority: 'HIGH',
      status: 'PENDING_VERIFICATION',
      description: 'Coastal flooding due to storm surge, residents need evacuation',
      address: 'Coastal Road, Basak, Lapu-Lapu City',
      latitude: 10.3110,
      longitude: 123.9590,
      reporterName: 'Capt. Roberto Aying',
      reporterPhone: '+639131313131',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  console.log('✓ Created 8 sample incidents');

  // Create some incident assignments
  await prisma.incidentAssignment.upsert({
    where: {
      incidentId_personnelId: {
        incidentId: incident2.id,
        personnelId: medic1.id,
      },
    },
    update: {},
    create: {
      incidentId: incident2.id,
      personnelId: medic1.id,
      assignedAt: new Date(),
    },
  });

  await prisma.incidentAssignment.upsert({
    where: {
      incidentId_personnelId: {
        incidentId: incident3.id,
        personnelId: responder1.id,
      },
    },
    update: {},
    create: {
      incidentId: incident3.id,
      personnelId: responder1.id,
      assignedAt: new Date(),
      arrivedAt: new Date(),
    },
  });

  await prisma.incidentAssignment.upsert({
    where: {
      incidentId_personnelId: {
        incidentId: incident7.id,
        personnelId: medic1.id,
      },
    },
    update: {},
    create: {
      incidentId: incident7.id,
      personnelId: medic1.id,
      assignedAt: new Date(),
      arrivedAt: new Date(),
    },
  });

  console.log('✓ Created incident assignments');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Admin Credentials:');
  console.log('   Email: admin@era.com');
  console.log('   Password: Admin@123');
  console.log('   Role: SUPER_ADMIN');
  console.log('\n✨ Sample data created:');
  console.log('   • 3 barangays with emergency contacts');
  console.log('   • 4 personnel responders');
  console.log('   • 8 incidents with geo data');
  console.log('   • Incident assignments linking personnel');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/* REMOVED ALL SAMPLE DATA - KEEPING CODE FOR REFERENCE IF NEEDED LATER

  // Create sample barangays in Lapu-Lapu City with Emergency Contacts
  const barangay1 = await prisma.barangay.upsert({
    where: { code: 'BRG001' },
    update: {},
    create: {
      name: 'Barangay Basak',
      code: 'BRG001',
      latitude: 10.3120,
      longitude: 123.9600,
      address: 'M.L. Quezon Highway, Basak, Lapu-Lapu City, Cebu 6015',
      description: 'Coastal barangay near Mactan Airport and Gaisano Grand Mall',
      operatingHours: 'Mon-Fri: 8AM-5PM | Emergency: 24/7',
      landmarks: 'Near Gaisano Grand Mall Basak, Mactan Cebu International Airport',
      emergencyContacts: {
        create: [
          {
            name: 'Barangay Hall',
            phone: '+63 32 340 1234',
            type: 'BARANGAY_HALL',
            isPrimary: true,
          },
          {
            name: 'Emergency Hotline',
            phone: '911',
            type: 'EMERGENCY',
          },
          {
            name: 'Barangay Police',
            phone: '+63 32 340 5678',
            type: 'POLICE',
          },
          {
            name: 'Basak Fire Station',
            phone: '+63 32 340 9999',
            type: 'FIRE',
          },
          {
            name: 'Lapu-Lapu City Health Center',
            phone: '+63 32 341 8888',
            type: 'MEDICAL',
          },
        ],
      },
    },
  });

  const barangay2 = await prisma.barangay.upsert({
    where: { code: 'BRG002' },
    update: {},
    create: {
      name: 'Barangay Maribago',
      code: 'BRG002',
      latitude: 10.3050,
      longitude: 123.9750,
      address: 'Maribago Road, Maribago, Lapu-Lapu City, Cebu 6015',
      description: 'Prime tourist area with beach resorts and hotels',
      operatingHours: 'Mon-Fri: 8AM-5PM | 24/7 Tourist Assistance',
      landmarks: 'Pacific Mall, Shangri-La Mactan Resort, JPark Island Resort',
      emergencyContacts: {
        create: [
          {
            name: 'Barangay Hall Maribago',
            phone: '+63 32 495 1234',
            type: 'BARANGAY_HALL',
            isPrimary: true,
          },
          {
            name: 'Emergency Hotline',
            phone: '911',
            type: 'EMERGENCY',
          },
          {
            name: 'Tourist Police',
            phone: '+63 32 495 5678',
            type: 'POLICE',
          },
          {
            name: 'Maribago Fire Brigade',
            phone: '+63 32 495 9999',
            type: 'FIRE',
          },
        ],
      },
    },
  });

  const barangay3 = await prisma.barangay.upsert({
    where: { code: 'BRG003' },
    update: {},
    create: {
      name: 'Barangay Pusok',
      code: 'BRG003',
      latitude: 10.3200,
      longitude: 123.9500,
      address: 'Mactan Circumferential Road, Pusok, Lapu-Lapu City, Cebu 6015',
      description: 'Dense urban residential area with commercial establishments',
      operatingHours: 'Mon-Fri: 7:30AM-5:30PM | Emergency: 24/7',
      landmarks: 'Along Mactan Circumferential Road, near MEPZ',
      emergencyContacts: {
        create: [
          {
            name: 'Barangay Hall Pusok',
            phone: '+63 32 345 1111',
            type: 'BARANGAY_HALL',
            isPrimary: true,
          },
          {
            name: 'Emergency Hotline',
            phone: '911',
            type: 'EMERGENCY',
          },
          {
            name: 'Pusok Police Outpost',
            phone: '+63 32 345 2222',
            type: 'POLICE',
          },
          {
            name: 'Fire Volunteer Brigade',
            phone: '+63 32 345 3333',
            type: 'FIRE',
          },
          {
            name: 'Barangay Health Station',
            phone: '+63 32 345 4444',
            type: 'MEDICAL',
          },
        ],
      },
    },
  });

  console.log('✓ Created barangays:', barangay1.name, barangay2.name, barangay3.name);

  // Create sample personnel
  const personnelPassword = await bcrypt.hash('Personnel@123', 10);

  const responder1 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP001' },
    update: {},
    create: {
      employeeId: 'EMP001',
      email: 'responder1@era.com',
      password: personnelPassword,
      firstName: 'Ricardo',
      lastName: 'Mendoza',
      phone: '+639333333333',
      role: 'RESPONDER',
      status: 'AVAILABLE',
      address: 'Basak, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3125,
          longitude: 123.9605,
        },
      },
    },
  });

  const medic1 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP002' },
    update: {},
    create: {
      employeeId: 'EMP002',
      email: 'medic1@era.com',
      password: personnelPassword,
      firstName: 'Maria',
      lastName: 'Villanueva',
      phone: '+639444444444',
      role: 'MEDIC',
      status: 'AVAILABLE',
      address: 'Maribago, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3055,
          longitude: 123.9755,
        },
      },
    },
  });

  // Add more personnel for better map display
  const responder2 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP003' },
    update: {},
    create: {
      employeeId: 'EMP003',
      email: 'responder2@era.com',
      password: personnelPassword,
      firstName: 'Juan',
      lastName: 'Santos',
      phone: '+639555555555',
      role: 'RESPONDER',
      status: 'ON_DUTY',
      address: 'Pusok, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3200,
          longitude: 123.9500,
        },
      },
    },
  });

  const medic2 = await prisma.personnel.upsert({
    where: { employeeId: 'EMP004' },
    update: {},
    create: {
      employeeId: 'EMP004',
      email: 'medic2@era.com',
      password: personnelPassword,
      firstName: 'Ana',
      lastName: 'Garcia',
      phone: '+639666666666',
      role: 'MEDIC',
      status: 'AVAILABLE',
      address: 'Basak, Lapu-Lapu City',
      isAvailable: true,
      locations: {
        create: {
          latitude: 10.3110,
          longitude: 123.9590,
        },
      },
    },
  });

  console.log('✓ Created personnel:', responder1.firstName, medic1.firstName, responder2.firstName, medic2.firstName);

  // Create sample incidents in Lapu-Lapu City
  const incident1 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-001',
      title: 'House Fire in Basak',
      type: 'FIRE',
      priority: 'CRITICAL',
      status: 'REPORTED',
      description: 'House fire near Gaisano Grand Mall Basak, smoke visible',
      address: 'M.L. Quezon Highway, Basak, Lapu-Lapu City',
      latitude: 10.3125,
      longitude: 123.9605,
      reporterName: 'Jun Reyes',
      reporterPhone: '+639555555555',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  const incident2 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-002',
      title: 'Elderly Patient - Chest Pain',
      type: 'MEDICAL',
      priority: 'HIGH',
      status: 'DISPATCHED',
      description: 'Elderly patient with severe chest pain, possible heart attack',
      address: 'Pacific Mall Maribago, Lapu-Lapu City',
      latitude: 10.3055,
      longitude: 123.9755,
      reporterName: 'Maria Santos',
      reporterPhone: '+639666666666',
      barangayId: barangay2.id,
      createdById: admin.id,
    },
  });

  const incident3 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-003',
      title: 'Motorcycle Collision - Mactan Circumferential Road',
      type: 'ACCIDENT',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      description: 'Motorcycle-truck collision, driver injured',
      address: 'Mactan Circumferential Road, Pusok, Lapu-Lapu City',
      latitude: 10.3195,
      longitude: 123.9505,
      reporterName: 'Carlos Abad',
      reporterPhone: '+639777777777',
      barangayId: barangay3.id,
      createdById: admin.id,
    },
  });

  const incident4 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-004',
      title: 'Child Trapped in Drainage',
      type: 'OTHER',
      priority: 'HIGH',
      status: 'REPORTED',
      description: 'Child fell into drainage canal, needs rescue',
      address: 'Sitio San Vicente, Basak, Lapu-Lapu City',
      latitude: 10.3115,
      longitude: 123.9595,
      reporterName: 'Luz Cruz',
      reporterPhone: '+639888888888',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  const incident5 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-005',
      title: 'Robbery at Sari-Sari Store',
      type: 'CRIME',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      description: 'Hold-up incident at store, suspect fled',
      address: 'Sitio Maharlika, Basak, Lapu-Lapu City',
      latitude: 10.3130,
      longitude: 123.9610,
      reporterName: 'Rosa Fernandez',
      reporterPhone: '+639999999999',
      barangayId: barangay1.id,
      createdById: admin.id,
      resolvedAt: new Date(),
    },
  });

  const incident6 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-006',
      title: 'Grass Fire Near Resort',
      type: 'FIRE',
      priority: 'LOW',
      status: 'DISPATCHED',
      description: 'Small grass fire near beach resort area',
      address: 'Maribago Beach Road, Lapu-Lapu City',
      latitude: 10.3045,
      longitude: 123.9760,
      reporterName: 'Lisa Gonzales',
      reporterPhone: '+639101010101',
      barangayId: barangay2.id,
      createdById: admin.id,
    },
  });

  const incident7 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-007',
      title: 'Worker Fall at Construction Site',
      type: 'MEDICAL',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      description: 'Construction worker fell from scaffolding, severe injuries',
      address: 'New Condo Project, Pusok, Lapu-Lapu City',
      latitude: 10.3210,
      longitude: 123.9510,
      reporterName: 'Engr. David Tan',
      reporterPhone: '+639121212121',
      barangayId: barangay3.id,
      createdById: admin.id,
    },
  });

  const incident8 = await prisma.incident.create({
    data: {
      incidentNumber: 'INC-2024-008',
      title: 'Coastal Flooding - Storm Surge',
      type: 'FLOOD',
      priority: 'HIGH',
      status: 'REPORTED',
      description: 'Coastal flooding due to storm surge, residents need evacuation',
      address: 'Coastal Road, Basak, Lapu-Lapu City',
      latitude: 10.3110,
      longitude: 123.9590,
      reporterName: 'Capt. Roberto Aying',
      reporterPhone: '+639131313131',
      barangayId: barangay1.id,
      createdById: admin.id,
    },
  });

  console.log('✓ Created 8 sample incidents');

  // Create some incident assignments
  await prisma.incidentAssignment.create({
    data: {
      incidentId: incident2.id,
      personnelId: medic1.id,
      assignedAt: new Date(),
    },
  });

  await prisma.incidentAssignment.create({
    data: {
      incidentId: incident3.id,
      personnelId: responder1.id,
      assignedAt: new Date(),
      arrivedAt: new Date(),
    },
  });

  await prisma.incidentAssignment.create({
    data: {
      incidentId: incident7.id,
      personnelId: medic1.id,
      assignedAt: new Date(),
      arrivedAt: new Date(),
    },
  });

  console.log('✓ Created incident assignments');
*/
