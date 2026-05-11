import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { initializeDBConnection } from '@/server/db/data-source';
import { UserEntity } from '@/server/db/entities';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  /*
   * Nessun adapter: usiamo JWT puro con CredentialsProvider.
   * L'adapter TypeORM non è necessario con strategy: 'jwt' — le sessioni
   * sono self-contained nel token, zero accessi al DB per la verifica.
   */
  session: { strategy: 'jwt' },
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

        const ds = await initializeDBConnection();
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
