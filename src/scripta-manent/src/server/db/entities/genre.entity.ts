import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { BookEntity } from './book.entity';

@Entity('genres')
export class GenreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder!: number;

  @ManyToMany(() => BookEntity, (book) => book.genres, { eager: false })
  books!: Relation<BookEntity[]>;
}
