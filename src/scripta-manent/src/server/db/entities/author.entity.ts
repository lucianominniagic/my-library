import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { BookAuthorEntity } from './book-author.entity';

@Entity('authors')
export class AuthorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  nationality!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  aliases!: string[];

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('BookAuthorEntity', (ba: BookAuthorEntity) => ba.author, { eager: false })
  bookAuthors!: BookAuthorEntity[];
}
