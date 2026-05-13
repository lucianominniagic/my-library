/**
 * Unit tests for GET /api/covers/:id
 *
 * Strategy:
 *  - The real DB is never touched: `initializeDBConnection` is fully mocked.
 *  - `auth` is mocked so we can test both authenticated and unauthenticated paths.
 *  - Route params (Next.js 15 async params) are passed as `{ params: Promise<{ id }> }`.
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
import { GET } from '../route';
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

// ---- constants --------------------------------------------------------------
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ---- repository / DataSource factory helpers --------------------------------
function makeRepo(overrides: { findOne?: jest.Mock } = {}) {
  return {
    findOne: overrides.findOne ?? jest.fn().mockResolvedValue(null),
  };
}

function makeDS(repo: ReturnType<typeof makeRepo>) {
  return { getRepository: jest.fn().mockReturnValue(repo) };
}

// ---- request + route-context builder ----------------------------------------
function buildContext(id: string) {
  const request = new NextRequest(`http://localhost/api/covers/${id}`);
  const routeContext = { params: Promise.resolve({ id }) };
  return { request, routeContext };
}

/** Build a fake BookCoverEntity-like object. */
function fakeCover(id: string, mimeType: string, data: Buffer) {
  return { id, mimeType, data };
}

// =============================================================================
describe('GET /api/covers/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  describe('authentication', () => {
    it('returns 401 when there is no session', async () => {
      mockAuth.mockResolvedValue(null as never);
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
      expect(mockInitDB).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // UUID validation
  // ---------------------------------------------------------------------------
  describe('UUID validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    const invalidIds = [
      'not-a-uuid',
      '12345',
      '550e8400-e29b-41d4-a716',             // too short
      '550e8400-e29b-41d4-a716-4466554400001', // too long
      'gggggggg-gggg-gggg-gggg-gggggggggggg', // invalid hex chars
      '',
      '../etc/passwd',
    ];

    it.each(invalidIds)('returns 400 for invalid id: "%s"', async (id) => {
      const { request, routeContext } = buildContext(id);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/invalid cover id/i);
      // DB must not be touched for malformed ids
      expect(mockInitDB).not.toHaveBeenCalled();
    });

    it('accepts a well-formed UUID in upper-case', async () => {
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(
          fakeCover(VALID_UUID.toUpperCase(), 'image/jpeg', Buffer.from([0xff])),
        ),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(VALID_UUID.toUpperCase());

      const res = await GET(request, routeContext);

      // Should reach the DB (not rejected by UUID regex) — the regex is case-insensitive
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------
  describe('not found', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    it('returns 404 when the cover does not exist in the DB', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(404);
      expect((await res.json()).error).toMatch(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------
  describe('happy path', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    it('returns binary JPEG data with correct Content-Type and Cache-Control', async () => {
      // Mimic a JPEG magic-byte prefix so the test is semantically meaningful
      const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(
          fakeCover(VALID_UUID, 'image/jpeg', imageBytes),
        ),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      expect(res.headers.get('Cache-Control')).toMatch(/immutable/i);

      const body = Buffer.from(await res.arrayBuffer());
      expect(body).toEqual(imageBytes);
    });

    it('returns binary PNG data with correct Content-Type', async () => {
      const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(
          fakeCover(VALID_UUID, 'image/png', imageBytes),
        ),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      const body = Buffer.from(await res.arrayBuffer());
      expect(body).toEqual(imageBytes);
    });

    it('queries the repository with the correct UUID and field selection', async () => {
      const findOneMock = jest.fn().mockResolvedValue(
        fakeCover(ANOTHER_UUID, 'image/webp', Buffer.from([0x52, 0x49])),
      );
      const repo = makeRepo({ findOne: findOneMock });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(ANOTHER_UUID);

      await GET(request, routeContext);

      expect(findOneMock).toHaveBeenCalledTimes(1);
      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: ANOTHER_UUID },
        select: expect.arrayContaining(['id', 'mimeType', 'data']),
      });
    });

    it('includes long-lived Cache-Control header for immutable content', async () => {
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(
          fakeCover(VALID_UUID, 'image/jpeg', Buffer.from([0x01])),
        ),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      const cc = res.headers.get('Cache-Control') ?? '';
      expect(cc).toContain('public');
      expect(cc).toContain('max-age=31536000');
      expect(cc).toContain('immutable');
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(VALID_SESSION as never);
    });

    it('returns 500 when repo.findOne throws', async () => {
      const repo = makeRepo({
        findOne: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      mockInitDB.mockResolvedValue(makeDS(repo) as never);
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(500);
    });

    it('returns 500 when initializeDBConnection throws', async () => {
      mockInitDB.mockRejectedValue(new Error('cannot reach DB'));
      const { request, routeContext } = buildContext(VALID_UUID);

      const res = await GET(request, routeContext);

      expect(res.status).toBe(500);
    });
  });
});
