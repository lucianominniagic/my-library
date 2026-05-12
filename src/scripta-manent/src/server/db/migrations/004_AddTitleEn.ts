import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTitleEn1710000000004 implements MigrationInterface {
  name = 'AddTitleEn1710000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE books ADD COLUMN IF NOT EXISTS title_en TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE books DROP COLUMN IF EXISTS title_en
    `);
  }
}
