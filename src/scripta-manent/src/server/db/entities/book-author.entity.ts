import 'reflect-metadata';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BookEntity } from './book.entity';
import { AuthorEntity } from './author.entity';

export type AuthorRole = 'author' | 'editor' | 'translator' | 'illustrator' | 'other';

@Entity('book_authors')
export class BookAuthorEntity {
  @PrimaryColumn({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  @PrimaryColumn({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @Column({ type: 'text', default: 'author' })
  role!: AuthorRole;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder!: number;

  @ManyToOne(() => BookEntity, (book) => book.bookAuthors, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'book_id' })
  book!: BookEntity;

  @ManyToOne(() => AuthorEntity, (author) => author.bookAuthors, {
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'author_id' })
  author!: AuthorEntity;
}
