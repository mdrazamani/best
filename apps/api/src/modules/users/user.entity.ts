export type UserEntity = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  status: 'ACTIVE' | 'DISABLED';
  locale: string;
  createdAt: Date;
  updatedAt: Date;
};
