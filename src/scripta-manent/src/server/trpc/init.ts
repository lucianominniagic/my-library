import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Procedure protetta — richiede sessione autenticata.
 * Lancia UNAUTHORIZED se ctx.session è null o mancante.
 * Il tipo restituito garantisce ctx.session non-null ai router figli.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
