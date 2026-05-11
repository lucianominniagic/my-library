import { router, publicProcedure } from '../init';
import { GenreEntity } from '@/server/db/entities/genre.entity';

export const genreRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.db.getRepository(GenreEntity);
    const genres = await repo.find({ order: { sortOrder: 'ASC' } });
    return genres.map((g) => ({
      id:   g.id,
      name: g.name,
      slug: g.slug,
    }));
  }),
});
