export type InvoiceEntity = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  amount: string;
  paidAmount: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
};
