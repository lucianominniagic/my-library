/**
 * Unit tests for POST /api/upload/cover
 *
 * Strategy:
 *  - The real DB is never touched: `initializeDBConnection` is fully mocked.
 *  - `auth` is mocked so we can test both authenticated and unauthenticated paths.
 *  - Requests are constructed with the native Node 20 FormData / File / NextRequest APIs.
 */

import 'reflect-metadata';
import { NextRequest } from 'next/server';

// ---- module mocks (hoisted by Jest before imports) -------------------------
// Use explicit factory functions so Jest never loads the real modules
// (next-auth ships as pure ESM and would cause "Cannot use import statement"
// if Jest tried to auto-inspect it for auto-mocking).
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/server/db/data-source', () => ({ initializeDBConnection: jest.fn() }));

// ---- import the SUT and its dependencies after mocking ---------------------
import { POST } from '../route';
import { auth } from '@/auth';
import { initializeDBConnection } from '@/server/db/data-source';

// ---- typed mock helpers -----------------------------------------------------
const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockInitDB = initializeDBConnection as jest.MockedFunction<
  typeof initializeDBConnection
>;

// ---- fake session -----------------------------------------------------------
const VALID_SESSION = {
  user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
};

// ---- repository / DataSource factory helpers --------------------------------
function makeRepo(overrides: {
  create?: jest.Mock;
  save?: jest.Mock;
} = {}) {
  return {
    create: overrides.create ?? jest.fn().mockImplementation((d) => d),
    save: overrides.save ?? jest.fn().mockResolvedValue(undefined),
  };
}

function makeDS(repo: ReturnType<typeof makeRepo>) {
  return { getRepository: jest.fn().mockReturnValue(repo) };
}

// ---- request builder --------------------------------------------------------
function buildRequest(file?: File): NextRequest {
  const fd = new FormData();
  if (file) fd.append('file', file);
  return new NextRequest('http://localhost/api/upload/cover', {
    method: 'POST',
    body: fd,
  });
}

/** Build a File of the given size (bytes) and MIME type. */
function makeFile(sizeBytes: number, type: string, name = 'upload'): File {
  const buf = Buffer.alloc(sizeBytes, 0xab);
  return new File([buf], name, { type });
}

const MB = 1024 * 1024;

// =============================================================================
describe('POST /api/upload/cover', () => {
  beforeEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  describe('authentication', () => {
    it('returns 401 when there is no session', async () => {
      mockAuth.mockResolvedValue(null as never);

      const res = await POST(buildRequest(makeFile(100, 'image/jpeg')));

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
      // DB must never be touched
      expect(mockInitDB).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Multipart validation
  // ---------------------------------------------------------------------------
  describe('request validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    it('returns 400 when formData() throws (malformed multipart body)', async () => {
      // Craft a request that claims to be multipart but has a body that will
      // fail to parse — NextRequest.formData() must throw in this case.
      const req = new NextRequest('http://localhost/api/upload/cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=----boundary',
        },
        body: 'this is not a valid multipart payload',
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/invalid multipart/i);
    });

    it('returns 400 when the "file" field is missing', async () => {
      // Send a FormData without the "file" key
      const fd = new FormData();
      const req = new NextRequest('http://localhost/api/upload/cover', {
        method: 'POST',
        body: fd,
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringMatching(/missing file/i) });
    });

    it('returns 400 for an unsupported MIME type (text/plain)', async () => {
      const res = await POST(buildRequest(makeFile(512, 'text/plain', 'doc.txt')));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/unsupported file type/i);
      expect(body.error).toContain('text/plain');
    });

    it('returns 400 for an unsupported MIME type (application/pdf)', async () => {
      const res = await POST(buildRequest(makeFile(512, 'application/pdf', 'doc.pdf')));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/unsupported file type/i);
    });

    it('returns 400 when the file exceeds 2 MB', async () => {
      const tooBig = makeFile(2 * MB + 1, 'image/jpeg', 'big.jpg');
      const res = await POST(buildRequest(tooBig));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/too large/i);
    });

    it('accepts a file exactly at the 2 MB limit (boundary check)', async () => {
      const atLimit = makeFile(2 * MB, 'image/jpeg', 'limit.jpg');
      const repo = makeRepo();
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      const res = await POST(buildRequest(atLimit));

      // Should NOT be rejected for size
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------
  describe('happy path', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    it('stores a JPEG and returns a cover URL (200)', async () => {
      const repo = makeRepo();
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      const res = await POST(buildRequest(makeFile(1024, 'image/jpeg', 'cover.jpg')));

      expect(res.status).toBe(200);
      const body = await res.json();
      // URL must be /api/covers/<uuid>
      expect(body.url).toMatch(
        /^\/api\/covers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('stores a PNG and returns a cover URL (200)', async () => {
      const repo = makeRepo();
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      const res = await POST(buildRequest(makeFile(2048, 'image/png', 'cover.png')));

      expect(res.status).toBe(200);
      expect((await res.json()).url).toMatch(/^\/api\/covers\//);
    });

    it('stores a WebP and returns a cover URL (200)', async () => {
      const repo = makeRepo();
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      const res = await POST(buildRequest(makeFile(512, 'image/webp', 'cover.webp')));

      expect(res.status).toBe(200);
    });

    it('calls repo.create with the correct shape and saves to DB', async () => {
      const repo = makeRepo();
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      await POST(buildRequest(makeFile(1024, 'image/jpeg', 'cover.jpg')));

      expect(repo.create).toHaveBeenCalledTimes(1);
      const createdArg = (repo.create as jest.Mock).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(createdArg).toMatchObject({
        bookId: null,
        mimeType: 'image/jpeg',
        data: expect.any(Buffer),
      });
      // The UUID in 'id' must match the URL that was returned
      expect(typeof createdArg.id).toBe('string');

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('returned URL contains the same UUID that was persisted', async () => {
      let persistedId: string | undefined;
      const repo = makeRepo({
        create: jest.fn().mockImplementation((d) => {
          persistedId = d.id as string;
          return d;
        }),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      const res = await POST(buildRequest(makeFile(1024, 'image/jpeg', 'cover.jpg')));
      const { url } = await res.json();

      expect(url).toBe(`/api/covers/${persistedId}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    it('returns 500 when the DB save throws', async () => {
      const repo = makeRepo({
        save: jest.fn().mockRejectedValue(new Error('connection lost')),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);

      const res = await POST(buildRequest(makeFile(1024, 'image/jpeg')));

      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/failed to save/i);
    });

    it('returns 500 when initializeDBConnection itself throws', async () => {
      mockInitDB.mockRejectedValue(new Error('cannot reach DB'));

      const res = await POST(buildRequest(makeFile(1024, 'image/jpeg')));

      expect(res.status).toBe(500);
    });
  });
});
