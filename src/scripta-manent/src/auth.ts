import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { TypeORMAdapter } from '@auth/typeorm-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDataSource } from '@/server/db/data-source';
import { UserEntity } from '@/server/db/entities/user.entity';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  /*
   * TypeORMAdapter riceve solo la connection string e usa le proprie entità built-in.
   * Le nostre entità custom (UserEntity, AccountEntity, ecc.) sono usate solo nel
   * DataSource di business logic (getDataSource). Questo evita conflitti di tipo.
   */
  adapter: TypeORMAdapter(process.env.DATABASE_URL!),
  session: { strategy: 'jwt' }, // JWT — con CredentialsProvider non scrive sulla tabella sessions
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ds = await getDataSource();
        const userRepo = ds.getRepository(UserEntity);

        // passwordHash è select:false — va selezionato esplicitamente
        const user = await userRepo
          .createQueryBuilder('user')
          .addSelect('user.passwordHash')
          .where('user.email = :email', { email: parsed.data.email })
          .getOne();

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
