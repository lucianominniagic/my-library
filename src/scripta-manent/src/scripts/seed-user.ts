import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import bcrypt from 'bcryptjs';
import { getDataSource } from '../server/db/data-source';
import { UserEntity } from '../server/db/entities/user.entity';

async function seedUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Luciano';

  if (!email || !password) {
    console.error('❌ ADMIN_EMAIL e ADMIN_PASSWORD devono essere in .env.local');
    process.exit(1);
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Utente ${email} già presente (id: ${existing.id})`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // passwordHash è select:false — va passato direttamente come partial entity
  const user = userRepo.create({ email, name, passwordHash } as Partial<UserEntity>);
  await userRepo.save(user);

  console.log(`✅ Utente creato: ${email} (id: ${user.id})`);
  process.exit(0);
}

seedUser().catch((e) => {
  console.error('❌ Errore:', e);
  process.exit(1);
});
