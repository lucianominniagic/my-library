import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookCovers1710000000005 implements MigrationInterface {
  name = 'AddBookCovers1710000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE book_covers (
        id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
        book_id     UUID,
        mime_type   TEXT        NOT NULL,
        data        BYTEA       NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pk_book_covers        PRIMARY KEY (id),
        CONSTRAINT fk_book_covers_book   FOREIGN KEY (book_id)
          REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_book_covers_book_id ON book_covers (book_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS book_covers`);
  }
}
