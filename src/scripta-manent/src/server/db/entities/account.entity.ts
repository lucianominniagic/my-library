import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ name: 'provider_account_id', type: 'text' })
  providerAccountId!: string;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken!: string | null;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken!: string | null;

  @Column({ name: 'expires_at', type: 'bigint', nullable: true })
  expiresAt!: number | null;

  @Column({ name: 'token_type', type: 'text', nullable: true })
  tokenType!: string | null;

  @Column({ type: 'text', nullable: true })
  scope!: string | null;

  @Column({ name: 'id_token', type: 'text', nullable: true })
  idToken!: string | null;

  @Column({ name: 'session_state', type: 'text', nullable: true })
  sessionState!: string | null;

  @ManyToOne(() => UserEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
