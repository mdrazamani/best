export type CustomerEntity = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  createdById: string;
};
