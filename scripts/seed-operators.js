const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const operators = [
  {
    email: 'operator.algiers@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Ahmed',
    lastName: 'Benali',
    phone: '+213555100101',
    busType: 'Minibus',
    seatCount: 18,
    plateNumber: '16-ALG-2026',
    price: 60,
    destinations: ['Alger Centre', 'Bab El Oued', 'Hussein Dey'],
    lastLat: 36.7538,
    lastLng: 3.0588,
  },
  {
    email: 'operator.oran@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Yacine',
    lastName: 'Kadi',
    phone: '+213555100102',
    busType: 'Coach',
    seatCount: 30,
    plateNumber: '31-ORN-2026',
    price: 80,
    destinations: ['Oran Centre', 'Es Senia', 'Bir El Djir'],
    lastLat: 35.6971,
    lastLng: -0.6308,
  },
  {
    email: 'operator.constantine@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Rania',
    lastName: 'Said',
    phone: '+213555100103',
    busType: 'City Bus',
    seatCount: 40,
    plateNumber: '25-CON-2026',
    price: 70,
    destinations: ['City Center', 'Ali Mendjeli', 'Didouche Mourad'],
    lastLat: 36.365,
    lastLng: 6.6147,
  },
  {
    email: 'operator.annaba@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Nadia',
    lastName: 'Bensaid',
    phone: '+213555100104',
    busType: 'Minibus',
    seatCount: 22,
    plateNumber: '23-ANB-2026',
    price: 65,
    destinations: ['Annaba Centre', 'El Bouni', 'Seraidi'],
    lastLat: 36.9,
    lastLng: 7.7667,
  },
  {
    email: 'operator.blida@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Karim',
    lastName: 'Zerrouki',
    phone: '+213555100105',
    busType: 'Shuttle',
    seatCount: 16,
    plateNumber: '09-BLD-2026',
    price: 55,
    destinations: ['Blida Centre', 'Soumaa', 'Ouled Yaich'],
    lastLat: 36.47,
    lastLng: 2.829,
  },
];

async function seed() {
  const passwordHash = await bcrypt.hash('Test1234!', 10);
  const now = new Date();

  for (const operator of operators) {
    const user = await prisma.user.upsert({
      where: { email: operator.email },
      update: {
        firstName: operator.firstName,
        lastName: operator.lastName,
        passwordHash,
        role: 'OPERATOR',
        operatorProfile: {
          upsert: {
            create: {
              firstName: operator.firstName,
              lastName: operator.lastName,
              phone: operator.phone,
              busType: operator.busType,
              seatCount: operator.seatCount,
              plateNumber: operator.plateNumber,
              price: operator.price,
              destinations: operator.destinations,
              activationMode: 'MANUAL',
              isActive: true,
              lastLat: operator.lastLat,
              lastLng: operator.lastLng,
              lastLocationAt: now,
            },
            update: {
              firstName: operator.firstName,
              lastName: operator.lastName,
              phone: operator.phone,
              busType: operator.busType,
              seatCount: operator.seatCount,
              plateNumber: operator.plateNumber,
              price: operator.price,
              destinations: operator.destinations,
              activationMode: 'MANUAL',
              isActive: true,
              lastLat: operator.lastLat,
              lastLng: operator.lastLng,
              lastLocationAt: now,
            },
          },
        },
      },
      create: {
        email: operator.email,
        firstName: operator.firstName,
        lastName: operator.lastName,
        passwordHash,
        role: 'OPERATOR',
        operatorProfile: {
          create: {
            firstName: operator.firstName,
            lastName: operator.lastName,
            phone: operator.phone,
            busType: operator.busType,
            seatCount: operator.seatCount,
            plateNumber: operator.plateNumber,
            price: operator.price,
            destinations: operator.destinations,
            activationMode: 'MANUAL',
            isActive: true,
            lastLat: operator.lastLat,
            lastLng: operator.lastLng,
            lastLocationAt: now,
          },
        },
      },
      select: { id: true, email: true },
    });

    // Location history is optional for the map; we keep lastLat/lastLng on profile.
  }
}

seed()
  .then(() => {
    console.log('Seeded 5 operators (password: Test1234!).');
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
