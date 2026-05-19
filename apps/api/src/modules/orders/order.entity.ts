export type OrderEntity = {
  id: string;
  orderNumber: string;
  title?: string | null;
  customerId: string;
  collaboratorId?: string | null;
  workType: 'NEW_CONSTRUCTION' | 'REPAIR';
  stage: 'RECEIVED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
  totalPrice: string;
  discountAmount: string;
  expectedCompletionDate?: Date | null;
  lineItems?: Array<{
    id: string;
    meshTypeId: string;
    meshType?: {
      id: string;
      title: string;
    };
    width: string;
    height: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    description?: string | null;
  }>;
};
