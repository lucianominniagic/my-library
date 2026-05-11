import 'reflect-metadata';
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BookEntity } from './book.entity';
import { TagEntity } from './tag.entity';

/**
 * Explicit junction entity for the `book_tags` table.
 *
 * TypeORM auto-generates metadata for ManyToMany junction tables, but under
 * webpack the auto-generated metadata lacks `databaseName`, causing a
 * `TypeError: Cannot read properties of undefined (reading 'databaseName')`
 * when skip/take pagination is combined with ManyToMany joins.
 *
 * Registering this entity explicitly in AppDataSource ensures TypeORM builds
 * full, correct metadata (including `databaseName`) for `book_tags`, making
 * pagination + ManyToMany join safe even under webpack bundling.
 *
 * NOTE: do NOT define `@JoinTable` on both sides — the owning side
 * (@JoinTable on BookEntity.tags) manages the junction. This entity only
 * maps the existing table for metadata completeness.
 */
@Entity('book_tags')
export class BookTagEntity {
  @PrimaryColumn({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  @PrimaryColumn({ name: 'tag_id', type: 'uuid' })
  tagId!: string;

  @ManyToOne(() => BookEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book!: BookEntity;

  @ManyToOne(() => TagEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag!: TagEntity;
}
