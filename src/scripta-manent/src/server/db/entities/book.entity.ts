import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { BookAuthorEntity } from './book-author.entity';
import { GenreEntity } from './genre.entity';
import { TagEntity } from './tag.entity';

@Entity('books')
export class BookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  subtitle!: string | null;

  @Column({ type: 'text', nullable: true })
  isbn!: string | null;

  @Column({ type: 'text', nullable: true })
  publisher!: string | null;

  @Column({ name: 'published_year', type: 'smallint', nullable: true })
  publishedYear!: number | null;

  @Column({ type: 'char', length: 2, default: 'it' })
  language!: string;

  @Column({ type: 'integer', nullable: true })
  pages!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'title_en', type: 'text', nullable: true })
  titleEn!: string | null;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({ name: 'year_read', type: 'smallint', nullable: true })
  yearRead!: number | null;

  @Column({ type: 'smallint', nullable: true })
  rating!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Generated stored column for full-text search.
   * Populated automatically by PostgreSQL — never write to it directly.
   */
  @Column({
    name: 'fts_vector',
    type: 'tsvector',
    generatedType: 'STORED',
    asExpression:
      "setweight(to_tsvector('italian', f_unaccent(coalesce(title, ''))), 'A') || " +
      "setweight(to_tsvector('italian', f_unaccent(coalesce(subtitle, ''))), 'B') || " +
      "setweight(to_tsvector('italian', f_unaccent(coalesce(description, ''))), 'C')",
    select: false,
    insert: false,
    update: false,
    nullable: true,
  })
  ftsVector!: string;

  @OneToMany(() => BookAuthorEntity, (ba) => ba.book, {
    eager: false,
    cascade: ['insert', 'update'],
  })
  bookAuthors!: Relation<BookAuthorEntity[]>;

  @ManyToMany(() => GenreEntity, { eager: false })
  @JoinTable({
    name: 'book_genres',
    joinColumn: { name: 'book_id' },
    inverseJoinColumn: { name: 'genre_id' },
  })
  genres!: Relation<GenreEntity[]>;

  @ManyToMany(() => TagEntity, { eager: false })
  @JoinTable({
    name: 'book_tags',
    joinColumn: { name: 'book_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: Relation<TagEntity[]>;
}
