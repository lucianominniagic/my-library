import 'reflect-metadata';
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('verification_tokens')
export class VerificationTokenEntity {
  @Column({ type: 'text' })
  identifier!: string;

  @PrimaryColumn({ type: 'text' })
  token!: string;

  @Column({ type: 'timestamptz' })
  expires!: Date;
}
