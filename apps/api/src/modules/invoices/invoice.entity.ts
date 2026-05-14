export type InvoiceEntity = {
  id: string;
  invoiceNumber: string;
  title?: string | null;
  orderId: string;
  amount: string;
  paidAmount: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
};
