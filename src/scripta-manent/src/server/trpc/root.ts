import { router } from './init';
import { healthRouter } from './routers/health.router';
import { bookRouter }   from './routers/book.router';
import { authorRouter } from './routers/author.router';
import { genreRouter }  from './routers/genre.router';
import { tagRouter }    from './routers/tag.router';

export const appRouter = router({
  health: healthRouter,
  book:   bookRouter,
  author: authorRouter,
  genre:  genreRouter,
  tag:    tagRouter,
});

export type AppRouter = typeof appRouter;
