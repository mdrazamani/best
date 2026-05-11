export type OperationLogEntity = {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  description?: string | null;
  createdAt: Date;
};
