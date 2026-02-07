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
    phoneNumbers: ['+213555100101', '+213770111111'],
    busType: 'Minibus',
    seatCount: 18,
    plateNumber: '16-ALG-2026',
    price: 60,
    destinations: ['Alger Centre', 'Bab El Oued', 'Hussein Dey'],
    destinationsPricing: [
      { name: 'Alger Centre', price: 60 },
      { name: 'Bab El Oued', price: 55 },
      { name: 'Hussein Dey', price: 65 },
    ],
    lastLat: 36.7538,
    lastLng: 3.0588,
  },
  {
    email: 'operator.oran@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Yacine',
    lastName: 'Kadi',
    phone: '+213555100102',
    phoneNumbers: ['+213555100102', '+213770222222'],
    busType: 'Coach',
    seatCount: 30,
    plateNumber: '31-ORN-2026',
    price: 80,
    destinations: ['Oran Centre', 'Es Senia', 'Bir El Djir'],
    destinationsPricing: [
      { name: 'Oran Centre', price: 80 },
      { name: 'Es Senia', price: 75 },
      { name: 'Bir El Djir', price: 70 },
    ],
    lastLat: 35.6971,
    lastLng: -0.6308,
  },
  {
    email: 'operator.constantine@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Rania',
    lastName: 'Said',
    phone: '+213555100103',
    phoneNumbers: ['+213555100103', '+213770333333'],
    busType: 'City Bus',
    seatCount: 40,
    plateNumber: '25-CON-2026',
    price: 70,
    destinations: ['City Center', 'Ali Mendjeli', 'Didouche Mourad'],
    destinationsPricing: [
      { name: 'City Center', price: 70 },
      { name: 'Ali Mendjeli', price: 65 },
      { name: 'Didouche Mourad', price: 60 },
    ],
    lastLat: 36.365,
    lastLng: 6.6147,
  },
  {
    email: 'operator.annaba@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Nadia',
    lastName: 'Bensaid',
    phone: '+213555100104',
    phoneNumbers: ['+213555100104', '+213770444444'],
    busType: 'Minibus',
    seatCount: 22,
    plateNumber: '23-ANB-2026',
    price: 65,
    destinations: ['Annaba Centre', 'El Bouni', 'Seraidi'],
    destinationsPricing: [
      { name: 'Annaba Centre', price: 65 },
      { name: 'El Bouni', price: 60 },
      { name: 'Seraidi', price: 75 },
    ],
    lastLat: 36.9,
    lastLng: 7.7667,
  },
  {
    email: 'operator.blida@trackbus.dev',
    password: 'Test1234!',
    firstName: 'Karim',
    lastName: 'Zerrouki',
    phone: '+213555100105',
    phoneNumbers: ['+213555100105', '+213770555555'],
    busType: 'Shuttle',
    seatCount: 16,
    plateNumber: '09-BLD-2026',
    price: 55,
    destinations: ['Blida Centre', 'Soumaa', 'Ouled Yaich'],
    destinationsPricing: [
      { name: 'Blida Centre', price: 55 },
      { name: 'Soumaa', price: 50 },
      { name: 'Ouled Yaich', price: 60 },
    ],
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
              phoneNumbers: operator.phoneNumbers ?? [],
              destinationsPricing: operator.destinationsPricing ?? null,
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
              phoneNumbers: operator.phoneNumbers ?? [],
              destinationsPricing: operator.destinationsPricing ?? null,
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
            phoneNumbers: operator.phoneNumbers ?? [],
            destinationsPricing: operator.destinationsPricing ?? null,
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
