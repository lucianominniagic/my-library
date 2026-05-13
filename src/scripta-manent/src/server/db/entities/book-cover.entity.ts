import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BookEntity } from './book.entity';

/**
 * Stores binary cover image data in the database.
 *
 * book_id is nullable to allow uploads before the book row is created:
 * the upload endpoint creates an orphan record (book_id = null), then the
 * book.create / book.update tRPC mutations link it by setting book_id.
 * CASCADE DELETE on the FK ensures covers are auto-deleted with the book.
 */
@Entity('book_covers')
export class BookCoverEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'book_id', type: 'uuid', nullable: true })
  bookId!: string | null;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ type: 'bytea' })
  data!: Buffer;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => BookEntity, { eager: false, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'book_id' })
  book?: BookEntity;
}
