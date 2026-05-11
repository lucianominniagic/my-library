import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import { type Session } from 'next-auth';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Tipo di sessione che garantisce user non-null.
 * Usato dai router protetti per accedere a ctx.session.user.id senza type guard manuali.
 */
export type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']>;
};

/**
 * Procedure protetta — richiede sessione autenticata.
 * Lancia UNAUTHORIZED se ctx.session è null o mancante.
 * Il tipo restituito garantisce ctx.session.user non-null ai router figli.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as AuthenticatedSession,
    },
  });
});
