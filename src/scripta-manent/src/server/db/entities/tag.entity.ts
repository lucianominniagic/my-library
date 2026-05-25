import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import type { BookEntity } from './book.entity';

@Entity('tags')
export class TagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'char', length: 7, nullable: true })
  color!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToMany(
    () => {
      // require() via il barrel garantisce la STESSA istanza di classe usata
      // da data-source.ts e dai router — evita EntityMetadataNotFoundError.
      // Il lazy require() evita il problema circular-dep al momento del caricamento.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return (require('@/server/db/entities') as typeof import('@/server/db/entities')).BookEntity;
    },
    (book: BookEntity) => book.tags,
    { eager: false }
  )
  books!: BookEntity[];
}
