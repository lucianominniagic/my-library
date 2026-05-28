import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { BookEntity } from './book.entity';
import { TagEntity } from './tag.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'email_verified', type: 'timestamptz', nullable: true })
  emailVerified!: Date | null;

  @Column({ type: 'text', nullable: true })
  image!: string | null;

  /**
   * Password hash (bcrypt).
   * select:false → non inclusa nelle query ordinarie.
   * Selezionare esplicitamente con .addSelect('user.passwordHash') solo in authorize().
   */
  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @OneToMany(() => BookEntity, (book) => book.user, { eager: false })
  books!: Relation<BookEntity[]>;

  @OneToMany(() => TagEntity, (tag) => tag.user, { eager: false })
  tags!: Relation<TagEntity[]>;
}
