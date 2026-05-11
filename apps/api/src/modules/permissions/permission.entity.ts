export type PermissionEntity = {
  id: string;
  key: string;
  resource: string;
  apiName: string;
  method: string;
  path: string;
  description?: string | null;
};
