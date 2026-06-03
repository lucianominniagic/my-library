import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLettoToBooks1780479914379 implements MigrationInterface {
    name = 'AddLettoToBooks1780479914379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "FK_dc378b8311ff85f0dd38f163090"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "FK_4d06db2d11048c09ca05de823d6"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "FK_fb495c7e106e0c1c6332797d684"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc378b8311ff85f0dd38f16309"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43ff7d87d7506e768ca6491a1d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d06db2d11048c09ca05de823d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb495c7e106e0c1c6332797d68"`);
        await queryRunner.query(`ALTER TABLE "books" ADD "letto" boolean`);
        await queryRunner.query(`CREATE INDEX "IDX_dc378b8311ff85f0dd38f16309" ON "book_genres" ("book_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_43ff7d87d7506e768ca6491a1d" ON "book_genres" ("genre_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d06db2d11048c09ca05de823d" ON "book_tags" ("book_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fb495c7e106e0c1c6332797d68" ON "book_tags" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "FK_dc378b8311ff85f0dd38f163090" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "FK_4d06db2d11048c09ca05de823d6" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "FK_fb495c7e106e0c1c6332797d684" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`UPDATE "books" SET "letto" = false WHERE "year_purchase" IS NULL`);
        await queryRunner.query(`UPDATE "books" SET "letto" = true WHERE "year_purchase" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "FK_fb495c7e106e0c1c6332797d684"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "FK_4d06db2d11048c09ca05de823d6"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "FK_dc378b8311ff85f0dd38f163090"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb495c7e106e0c1c6332797d68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d06db2d11048c09ca05de823d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43ff7d87d7506e768ca6491a1d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc378b8311ff85f0dd38f16309"`);
        await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "letto"`);
        await queryRunner.query(`CREATE INDEX "IDX_fb495c7e106e0c1c6332797d68" ON "book_tags" ("tag_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d06db2d11048c09ca05de823d" ON "book_tags" ("book_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_43ff7d87d7506e768ca6491a1d" ON "book_genres" ("genre_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dc378b8311ff85f0dd38f16309" ON "book_genres" ("book_id") `);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "FK_fb495c7e106e0c1c6332797d684" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "FK_4d06db2d11048c09ca05de823d6" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "FK_dc378b8311ff85f0dd38f163090" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
