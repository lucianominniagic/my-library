import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedGenres1710000000002 implements MigrationInterface {
  name = 'SeedGenres1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO genres (name, slug, sort_order) VALUES
        ('Narrativa italiana',       'narrativa-italiana',        10),
        ('Narrativa straniera',      'narrativa-straniera',       20),
        ('Classici',                 'classici',                  30),
        ('Classici italiani',        'classici-italiani',         35),
        ('Romanzo storico',          'romanzo-storico',           40),
        ('Fantascienza',             'fantascienza',              50),
        ('Fantasy',                  'fantasy',                   60),
        ('Giallo',                   'giallo',                    70),
        ('Noir',                     'noir',                      80),
        ('Thriller',                 'thriller',                  90),
        ('Horror',                   'horror',                   100),
        ('Avventura',                'avventura',                110),
        ('Spionaggio',               'spionaggio',               120),
        ('Saggi',                    'saggi',                    130),
        ('Divulgazione scientifica', 'divulgazione-scientifica', 140),
        ('Biografia',                'biografia',                150),
        ('Autobiografia',            'autobiografia',            160),
        ('Religione',                'religione',                170)
      ON CONFLICT (name) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM genres`);
  }
}
