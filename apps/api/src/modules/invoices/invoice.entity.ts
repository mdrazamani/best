export type InvoiceEntity = {
  id: string;
  invoiceNumber: string;
  title?: string | null;
  amount: string;
  discountAmount: string;
  paidAmount: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  orders?: Array<{
    orderId: string;
    order?: {
      id: string;
      orderNumber: string;
    };
  }>;
  payments?: Array<{
    id: string;
    amount: string;
    paidAt: Date;
    note?: string | null;
    createdById: string;
  }>;
};
