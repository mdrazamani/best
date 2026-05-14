export type OrderEntity = {
  id: string;
  orderNumber: string;
  customerId: string;
  collaboratorId?: string | null;
  workType: 'NEW_CONSTRUCTION' | 'REPAIR';
  stage: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
  totalPrice: string;
  expectedCompletionDate?: Date | null;
  lineItems?: Array<{
    id: string;
    width: string;
    height: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
};
