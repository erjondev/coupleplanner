/**
 * Seed de démonstration :
 *  - 1 couple : Alice & Bob (mot de passe : "password123")
 *  - 3 environnements : privé Alice, privé Bob, commun
 *  - Quelques tâches, dont une tâche PRIVÉE de Bob samedi prochain (10h-12h)
 *    pour tester la détection de conflit lors de la création d'une tâche SHARED.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Retourne le prochain jour de la semaine demandé (0 = dimanche ... 6 = samedi). */
function nextWeekday(day: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let diff = (day - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function at(base: Date, hours: number, minutes = 0): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function main() {
  // Nettoyage (idempotent)
  await prisma.task.deleteMany();
  await prisma.notificationToken.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.couple.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  const couple = await prisma.couple.create({ data: {} });

  const alice = await prisma.user.create({
    data: { email: 'alice@demo.fr', name: 'Alice', passwordHash, coupleId: couple.id },
  });
  const bob = await prisma.user.create({
    data: { email: 'bob@demo.fr', name: 'Bob', passwordHash, coupleId: couple.id },
  });

  const envAlice = await prisma.environment.create({
    data: { coupleId: couple.id, userId: alice.id, type: 'PRIVATE' },
  });
  const envBob = await prisma.environment.create({
    data: { coupleId: couple.id, userId: bob.id, type: 'PRIVATE' },
  });
  const envShared = await prisma.environment.create({
    data: { coupleId: couple.id, userId: null, type: 'SHARED' },
  });

  const saturday = nextWeekday(6);

  await prisma.task.createMany({
    data: [
      // Tâche privée d'Alice
      {
        environmentId: envAlice.id,
        title: 'Séance de yoga',
        status: 'TODO',
        createdBy: alice.id,
        assignedTo: alice.id,
        startDatetime: at(saturday, 8),
        endDatetime: at(saturday, 9),
      },
      // Tâche privée de Bob -> déclenche le conflit si Alice crée une tâche
      // SHARED samedi entre 10h et 12h
      {
        environmentId: envBob.id,
        title: 'Rendez-vous surprise (secret)',
        status: 'TODO',
        createdBy: bob.id,
        assignedTo: bob.id,
        startDatetime: at(saturday, 10),
        endDatetime: at(saturday, 12),
      },
      // Tâches communes
      {
        environmentId: envShared.id,
        title: 'Faire les courses de la semaine',
        status: 'TODO',
        createdBy: alice.id,
        isAllDay: true,
        startDatetime: saturday,
        endDatetime: at(saturday, 23, 59),
      },
      {
        environmentId: envShared.id,
        title: 'Appeler le plombier',
        status: 'IN_PROGRESS',
        createdBy: alice.id,
        assignedTo: bob.id, // apparaît dans "Son Espace" côté Alice
      },
    ],
  });

  console.log('✅ Seed terminé.');
  console.log('   Comptes : alice@demo.fr / bob@demo.fr — mot de passe : password123');
  console.log(`   Conflit de démo : Bob est occupé (privé) samedi ${saturday.toLocaleDateString('fr-FR')} de 10h à 12h`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
