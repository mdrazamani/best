import { FormEvent, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { INVOICE_STATUS, money, shamsiDate } from '../lib/format';

export function InvoicesPage() {
  const { orders, invoices, createInvoice, downloadProtected } = useBestContext();
  const [form, setForm] = useState({ orderId: '', amount: '', paidAmount: '', status: 'UNPAID', description: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createInvoice({
      orderId: form.orderId,
      amount: Number(form.amount || 0),
      paidAmount: Number(form.paidAmount || 0),
      status: form.status,
      description: form.description || undefined
    });
    setForm({ orderId: '', amount: '', paidAmount: '', status: 'UNPAID', description: '' });
  };

  return (
    <section className="grid-2">
      <form onSubmit={submit}>
        <Panel>
          <h2>ثبت فاکتور</h2>
          <select required value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}>
            <option value="">انتخاب سفارش</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}
          </select>
          <input placeholder="مبلغ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input placeholder="مبلغ پرداختی" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {INVOICE_STATUS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <textarea placeholder="توضیح" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button>ثبت فاکتور</button>
        </Panel>
      </form>

      <Panel>
        <h2>لیست فاکتورها</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شماره فاکتور</th>
                <th>سفارش</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{invoice.order.orderNumber}</td>
                  <td>{money(invoice.paidAmount)} / {money(invoice.amount)}</td>
                  <td>{INVOICE_STATUS.find((item) => item.value === invoice.status)?.label || invoice.status}</td>
                  <td>{shamsiDate(invoice.createdAt)}</td>
                  <td><button type="button" onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}>دانلود</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
