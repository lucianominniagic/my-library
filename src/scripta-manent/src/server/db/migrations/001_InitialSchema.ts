import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000001 implements MigrationInterface {
  name = 'InitialSchema1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────────────────────────
    // § 0  EXTENSIONS
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);

    // ─────────────────────────────────────────────────────────────────
    // § 1  UTILITY FUNCTIONS
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION f_unaccent(text)
        RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
      AS $$ SELECT unaccent('unaccent', $1) $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql AS
      $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 2  NEXT-AUTH TABLES
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
        id              UUID        NOT NULL DEFAULT uuid_generate_v4(),
        name            TEXT,
        email           TEXT,
        email_verified  TIMESTAMPTZ,
        image           TEXT,
        CONSTRAINT pk_users       PRIMARY KEY (id),
        CONSTRAINT uq_users_email UNIQUE (email)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE accounts (
        id                    UUID   NOT NULL DEFAULT uuid_generate_v4(),
        user_id               UUID   NOT NULL,
        type                  TEXT   NOT NULL,
        provider              TEXT   NOT NULL,
        provider_account_id   TEXT   NOT NULL,
        refresh_token         TEXT,
        access_token          TEXT,
        expires_at            BIGINT,
        token_type            TEXT,
        scope                 TEXT,
        id_token              TEXT,
        session_state         TEXT,
        CONSTRAINT pk_accounts          PRIMARY KEY (id),
        CONSTRAINT fk_accounts_user     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_accounts_provider UNIQUE (provider, provider_account_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id            UUID        NOT NULL DEFAULT uuid_generate_v4(),
        user_id       UUID        NOT NULL,
        expires       TIMESTAMPTZ NOT NULL,
        session_token TEXT        NOT NULL,
        CONSTRAINT pk_sessions       PRIMARY KEY (id),
        CONSTRAINT fk_sessions_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_sessions_token UNIQUE (session_token)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE verification_tokens (
        identifier  TEXT        NOT NULL,
        token       TEXT        NOT NULL,
        expires     TIMESTAMPTZ NOT NULL,
        CONSTRAINT pk_verification_tokens PRIMARY KEY (token),
        CONSTRAINT uq_verif_token_ident   UNIQUE (identifier, token)
      )
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 3  AUTHORS
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE authors (
        id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
        name        TEXT        NOT NULL,
        nationality TEXT,
        aliases     TEXT[]      NOT NULL DEFAULT '{}',
        bio         TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pk_authors PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_authors_updated_at
        BEFORE UPDATE ON authors
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 4  GENRES  (vocabolario fisso, solo seed)
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE genres (
        id          UUID     NOT NULL DEFAULT uuid_generate_v4(),
        name        TEXT     NOT NULL,
        slug        TEXT     NOT NULL,
        sort_order  SMALLINT NOT NULL DEFAULT 0,
        CONSTRAINT pk_genres      PRIMARY KEY (id),
        CONSTRAINT uq_genres_name UNIQUE (name),
        CONSTRAINT uq_genres_slug UNIQUE (slug)
      )
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 5  BOOKS  (entità principale)
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE books (
        id              UUID        NOT NULL DEFAULT uuid_generate_v4(),
        user_id         UUID        NOT NULL,
        title           TEXT        NOT NULL,
        subtitle        TEXT,
        isbn            TEXT,
        publisher       TEXT,
        published_year  SMALLINT,
        language        CHAR(2)     NOT NULL DEFAULT 'it',
        pages           INTEGER,
        description     TEXT,
        cover_url       TEXT,
        year_read       SMALLINT,
        rating          SMALLINT,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fts_vector      TSVECTOR GENERATED ALWAYS AS (
          setweight(to_tsvector('italian', f_unaccent(coalesce(title, ''))),       'A') ||
          setweight(to_tsvector('italian', f_unaccent(coalesce(subtitle, ''))),    'B') ||
          setweight(to_tsvector('italian', f_unaccent(coalesce(description, ''))), 'C')
        ) STORED,
        CONSTRAINT pk_books            PRIMARY KEY (id),
        CONSTRAINT fk_books_user       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_books_rating    CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
        CONSTRAINT chk_books_pub_year  CHECK (published_year IS NULL OR published_year BETWEEN 0 AND 2200),
        CONSTRAINT chk_books_year_read CHECK (year_read IS NULL OR year_read BETWEEN 1800 AND 2200),
        CONSTRAINT chk_books_language  CHECK (language ~ '^[a-z]{2}$')
      )
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_books_updated_at
        BEFORE UPDATE ON books
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 6  BOOK_AUTHORS  (junction con metadati)
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE book_authors (
        book_id     UUID     NOT NULL,
        author_id   UUID     NOT NULL,
        role        TEXT     NOT NULL DEFAULT 'author',
        sort_order  SMALLINT NOT NULL DEFAULT 0,
        CONSTRAINT pk_book_authors PRIMARY KEY (book_id, author_id),
        CONSTRAINT fk_ba_book      FOREIGN KEY (book_id)   REFERENCES books(id)   ON DELETE CASCADE,
        CONSTRAINT fk_ba_author    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT,
        CONSTRAINT chk_ba_role     CHECK (role IN ('author', 'editor', 'translator', 'illustrator', 'other'))
      )
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 7  BOOK_GENRES  (junction semplice)
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE book_genres (
        book_id   UUID NOT NULL,
        genre_id  UUID NOT NULL,
        CONSTRAINT pk_book_genres PRIMARY KEY (book_id, genre_id),
        CONSTRAINT fk_bg_book     FOREIGN KEY (book_id)  REFERENCES books(id)  ON DELETE CASCADE,
        CONSTRAINT fk_bg_genre    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE RESTRICT
      )
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 8  TAGS  (user-defined, free-form)
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tags (
        id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
        user_id     UUID        NOT NULL,
        name        TEXT        NOT NULL,
        slug        TEXT        NOT NULL,
        color       CHAR(7),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pk_tags        PRIMARY KEY (id),
        CONSTRAINT fk_tags_user   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_tags_name   UNIQUE (user_id, name),
        CONSTRAINT uq_tags_slug   UNIQUE (user_id, slug),
        CONSTRAINT chk_tags_color CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
      )
    `);

    // ─────────────────────────────────────────────────────────────────
    // § 9  BOOK_TAGS  (junction semplice)
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE book_tags (
        book_id  UUID NOT NULL,
        tag_id   UUID NOT NULL,
        CONSTRAINT pk_book_tags PRIMARY KEY (book_id, tag_id),
        CONSTRAINT fk_bt_book   FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        CONSTRAINT fk_bt_tag    FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
      )
    `);

    // ─────────────────────────────────────────────────────────────────
    // INDEXES
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX idx_books_title_trgm ON books USING GIN (f_unaccent(title) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_books_subtitle_trgm ON books USING GIN (f_unaccent(subtitle) gin_trgm_ops) WHERE subtitle IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX idx_books_fts ON books USING GIN (fts_vector)`);
    await queryRunner.query(`CREATE INDEX idx_books_user_id ON books (user_id)`);
    await queryRunner.query(
      `CREATE INDEX idx_books_tbr ON books (user_id, created_at DESC) WHERE year_read IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_books_read_by_year ON books (user_id, year_read DESC) WHERE year_read IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_books_rating ON books (user_id, rating) WHERE rating IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_authors_name_trgm ON authors USING GIN (f_unaccent(name) gin_trgm_ops)`,
    );
    await queryRunner.query(`CREATE INDEX idx_authors_aliases_gin ON authors USING GIN (aliases)`);
    await queryRunner.query(
      `CREATE INDEX idx_book_authors_author_id ON book_authors (author_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_book_genres_genre_id ON book_genres (genre_id)`);
    await queryRunner.query(`CREATE INDEX idx_book_tags_tag_id ON book_tags (tag_id)`);
    await queryRunner.query(`CREATE INDEX idx_tags_user_id ON tags (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_user_id ON sessions (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_accounts_user_id ON accounts (user_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // drop junction tables first (FK children)
    await queryRunner.query(`DROP TABLE IF EXISTS book_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS book_genres`);
    await queryRunner.query(`DROP TABLE IF EXISTS book_authors`);
    // drop leaf tables
    await queryRunner.query(`DROP TABLE IF EXISTS tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS books`);
    await queryRunner.query(`DROP TABLE IF EXISTS genres`);
    await queryRunner.query(`DROP TABLE IF EXISTS authors`);
    // drop next-auth tables
    await queryRunner.query(`DROP TABLE IF EXISTS verification_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    // drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS f_unaccent(text)`);
  }
}
