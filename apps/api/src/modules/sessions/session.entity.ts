export type SessionEntity = {
  id: string;
  userId: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  lastActivityAt: Date;
};
