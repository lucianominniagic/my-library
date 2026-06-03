import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameyearReadToYearPurchase1780477298496 implements MigrationInterface {
    name = 'RenameyearReadToYearPurchase1780477298496'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "fk_accounts_user"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "fk_sessions_user"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "fk_tags_user"`);
        await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT "fk_books_user"`);
        await queryRunner.query(`ALTER TABLE "book_authors" DROP CONSTRAINT "fk_ba_author"`);
        await queryRunner.query(`ALTER TABLE "book_authors" DROP CONSTRAINT "fk_ba_book"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "fk_bg_book"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "fk_bg_genre"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "fk_bt_book"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "fk_bt_tag"`);
        await queryRunner.query(`ALTER TABLE "book_covers" DROP CONSTRAINT "fk_book_covers_book"`);
        await queryRunner.query(`DROP INDEX "public"."idx_accounts_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sessions_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tags_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_books_fts"`);
        await queryRunner.query(`DROP INDEX "public"."idx_books_rating"`);
        await queryRunner.query(`DROP INDEX "public"."idx_books_read_by_year"`);
        await queryRunner.query(`DROP INDEX "public"."idx_books_tbr"`);
        await queryRunner.query(`DROP INDEX "public"."idx_books_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_book_authors_author_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_authors_aliases_gin"`);
        await queryRunner.query(`DROP INDEX "public"."idx_book_genres_genre_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_book_tags_tag_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_book_covers_book_id"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "chk_tags_color"`);
        await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT "chk_books_language"`);
        await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT "chk_books_pub_year"`);
        await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT "chk_books_rating"`);
        await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT "chk_books_year_read"`);
        await queryRunner.query(`ALTER TABLE "book_authors" DROP CONSTRAINT "chk_ba_role"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "uq_accounts_provider"`);
        await queryRunner.query(`ALTER TABLE "verification_tokens" DROP CONSTRAINT "uq_verif_token_ident"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "uq_tags_name"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "uq_tags_slug"`);
        await queryRunner.query(`ALTER TABLE "books" RENAME COLUMN "year_read" TO "year_purchase"`);
        await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "fts_vector"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","fts_vector","scripta_manent","public","books"]);
        await queryRunner.query(`ALTER TABLE "books" ADD "fts_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('italian', f_unaccent(coalesce(title, ''))), 'A') || setweight(to_tsvector('italian', f_unaccent(coalesce(subtitle, ''))), 'B') || setweight(to_tsvector('italian', f_unaccent(coalesce(description, ''))), 'C')) STORED`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["scripta_manent","public","books","GENERATED_COLUMN","fts_vector","setweight(to_tsvector('italian', f_unaccent(coalesce(title, ''))), 'A') || setweight(to_tsvector('italian', f_unaccent(coalesce(subtitle, ''))), 'B') || setweight(to_tsvector('italian', f_unaccent(coalesce(description, ''))), 'C')"]);
        await queryRunner.query(`CREATE INDEX "IDX_dc378b8311ff85f0dd38f16309" ON "book_genres" ("book_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_43ff7d87d7506e768ca6491a1d" ON "book_genres" ("genre_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d06db2d11048c09ca05de823d" ON "book_tags" ("book_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fb495c7e106e0c1c6332797d68" ON "book_tags" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_3000dad1da61b29953f07476324" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_authors" ADD CONSTRAINT "FK_1d68802baf370cd6818cad7a503" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_authors" ADD CONSTRAINT "FK_6fb8ac32a0a0bbca076b2cf7c5a" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "FK_dc378b8311ff85f0dd38f163090" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "FK_4d06db2d11048c09ca05de823d6" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "FK_fb495c7e106e0c1c6332797d684" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_covers" ADD CONSTRAINT "FK_96e1755fe5921390ea84f4da4f3" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "book_covers" DROP CONSTRAINT "FK_96e1755fe5921390ea84f4da4f3"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "FK_fb495c7e106e0c1c6332797d684"`);
        await queryRunner.query(`ALTER TABLE "book_tags" DROP CONSTRAINT "FK_4d06db2d11048c09ca05de823d6"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd"`);
        await queryRunner.query(`ALTER TABLE "book_genres" DROP CONSTRAINT "FK_dc378b8311ff85f0dd38f163090"`);
        await queryRunner.query(`ALTER TABLE "book_authors" DROP CONSTRAINT "FK_6fb8ac32a0a0bbca076b2cf7c5a"`);
        await queryRunner.query(`ALTER TABLE "book_authors" DROP CONSTRAINT "FK_1d68802baf370cd6818cad7a503"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_3000dad1da61b29953f07476324"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb495c7e106e0c1c6332797d68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d06db2d11048c09ca05de823d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43ff7d87d7506e768ca6491a1d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc378b8311ff85f0dd38f16309"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","fts_vector","scripta_manent","public","books"]);
        await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "fts_vector"`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["scripta_manent","public","books","GENERATED_COLUMN","fts_vector",""]);
        await queryRunner.query(`ALTER TABLE "books" ADD "fts_vector" tsvector`);
        await queryRunner.query(`ALTER TABLE "books" RENAME COLUMN "year_purchase" TO "year_read"`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "uq_tags_slug" UNIQUE ("user_id", "slug")`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "uq_tags_name" UNIQUE ("user_id", "name")`);
        await queryRunner.query(`ALTER TABLE "verification_tokens" ADD CONSTRAINT "uq_verif_token_ident" UNIQUE ("identifier", "token")`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "uq_accounts_provider" UNIQUE ("provider", "provider_account_id")`);
        await queryRunner.query(`ALTER TABLE "book_authors" ADD CONSTRAINT "chk_ba_role" CHECK ((role = ANY (ARRAY['author'::text, 'editor'::text, 'translator'::text, 'illustrator'::text, 'other'::text])))`);
        await queryRunner.query(`ALTER TABLE "books" ADD CONSTRAINT "chk_books_year_read" CHECK (((year_read IS NULL) OR ((year_read >= 1800) AND (year_read <= 2200))))`);
        await queryRunner.query(`ALTER TABLE "books" ADD CONSTRAINT "chk_books_rating" CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))))`);
        await queryRunner.query(`ALTER TABLE "books" ADD CONSTRAINT "chk_books_pub_year" CHECK (((published_year IS NULL) OR ((published_year >= 0) AND (published_year <= 2200))))`);
        await queryRunner.query(`ALTER TABLE "books" ADD CONSTRAINT "chk_books_language" CHECK ((language ~ '^[a-z]{2}$'::text))`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "chk_tags_color" CHECK (((color IS NULL) OR (color ~ '^#[0-9A-Fa-f]{6}$'::text)))`);
        await queryRunner.query(`CREATE INDEX "idx_book_covers_book_id" ON "book_covers" ("book_id") `);
        await queryRunner.query(`CREATE INDEX "idx_book_tags_tag_id" ON "book_tags" ("tag_id") `);
        await queryRunner.query(`CREATE INDEX "idx_book_genres_genre_id" ON "book_genres" ("genre_id") `);
        await queryRunner.query(`CREATE INDEX "idx_authors_aliases_gin" ON "authors" ("aliases") `);
        await queryRunner.query(`CREATE INDEX "idx_book_authors_author_id" ON "book_authors" ("author_id") `);
        await queryRunner.query(`CREATE INDEX "idx_books_user_id" ON "books" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_books_tbr" ON "books" ("created_at", "user_id") WHERE (year_purchase IS NULL)`);
        await queryRunner.query(`CREATE INDEX "idx_books_read_by_year" ON "books" ("user_id", "year_purchase") WHERE (year_purchase IS NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "idx_books_rating" ON "books" ("rating", "user_id") WHERE (rating IS NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "idx_books_fts" ON "books" ("fts_vector") `);
        await queryRunner.query(`CREATE INDEX "idx_tags_user_id" ON "tags" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sessions_user_id" ON "sessions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_accounts_user_id" ON "accounts" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "book_covers" ADD CONSTRAINT "fk_book_covers_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "fk_bt_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_tags" ADD CONSTRAINT "fk_bt_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "fk_bg_genre" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_genres" ADD CONSTRAINT "fk_bg_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_authors" ADD CONSTRAINT "fk_ba_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_authors" ADD CONSTRAINT "fk_ba_author" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "books" ADD CONSTRAINT "fk_books_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "fk_tags_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "fk_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
