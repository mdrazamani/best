import { FormEvent, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { money, ORDER_STAGES, shamsiDate, WORK_TYPES, fullName } from '../lib/format';

export function OrdersPage() {
  const { customers, collaborators, meshTypes, orders, createOrder, updateOrder } = useBestContext();
  const [form, setForm] = useState({ customerId: '', collaboratorId: '', workType: 'NEW_CONSTRUCTION', meshTypeId: '', totalPrice: '', description: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createOrder({
      customerId: form.customerId,
      collaboratorId: form.collaboratorId || null,
      workType: form.workType,
      meshTypeId: form.meshTypeId,
      totalPrice: Number(form.totalPrice || 0),
      description: form.description || undefined
    });
    setForm({ customerId: '', collaboratorId: '', workType: 'NEW_CONSTRUCTION', meshTypeId: '', totalPrice: '', description: '' });
  };

  return (
    <section className="grid-2">
      <form onSubmit={submit}>
        <Panel>
          <h2>ثبت سفارش</h2>
          <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">انتخاب مشتری</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{fullName(customer)}</option>)}
          </select>
          <select value={form.collaboratorId} onChange={(e) => setForm({ ...form, collaboratorId: e.target.value })}>
            <option value="">بدون همکار</option>
            {collaborators.map((collaborator) => <option key={collaborator.id} value={collaborator.id}>{fullName(collaborator)}</option>)}
          </select>
          <select value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })}>
            {WORK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={form.meshTypeId} onChange={(e) => setForm({ ...form, meshTypeId: e.target.value })}>
            <option value="">نوع توری</option>
            {meshTypes.filter((mesh) => mesh.isActive).map((mesh) => <option key={mesh.id} value={mesh.id}>{mesh.title}</option>)}
          </select>
          <input placeholder="قیمت کل" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
          <textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button>ثبت سفارش</button>
        </Panel>
      </form>

      <Panel>
        <h2>لیست سفارشات</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>مشتری</th>
                <th>همکار</th>
                <th>نوع/توری</th>
                <th>مرحله</th>
                <th>وضعیت مالی</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{fullName(order.customer)}</td>
                  <td>{fullName(order.collaborator || undefined)}</td>
                  <td>{WORK_TYPES.find((item) => item.value === order.workType)?.label} / {order.meshType?.title || '-'}</td>
                  <td>
                    <select value={order.stage} onChange={(e) => void updateOrder(order.id, { stage: e.target.value })}>
                      {ORDER_STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                    </select>
                  </td>
                  <td>{money(order.paymentSummary.paidAmount)} / {money(order.paymentSummary.total)}<br /><small>{order.paymentSummary.percent}%</small></td>
                  <td>{shamsiDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
