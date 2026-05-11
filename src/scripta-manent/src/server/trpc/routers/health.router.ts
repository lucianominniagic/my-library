import { router, publicProcedure } from '../init';

export const healthRouter = router({
  ping: publicProcedure.query(() => 'pong' as const),
});
