import { FormEvent, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { fullName, money } from '../lib/format';

export function CollaboratorsPage() {
  const { collaborators, collaboratorDetail, createCollaborator, loadCollaboratorDetail } = useBestContext();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', address: '', description: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createCollaborator(form);
    setForm({ firstName: '', lastName: '', phone: '', address: '', description: '' });
  };

  return (
    <section className="grid-2">
      <form onSubmit={submit}>
        <Panel>
          <h2>ثبت همکار</h2>
          <input placeholder="نام" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input placeholder="نام خانوادگی" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input placeholder="شماره" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="آدرس" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button>ثبت همکار</button>
        </Panel>
      </form>

      <Panel>
        <h2>لیست همکاران</h2>
        <table>
          <thead><tr><th>نام</th><th>شماره</th><th>سفارش</th><th>جزئیات</th></tr></thead>
          <tbody>
            {collaborators.map((item) => (
              <tr key={item.id}>
                <td>{fullName(item)}</td>
                <td>{item.phone || '-'}</td>
                <td>{item._count?.orders || 0}</td>
                <td><button type="button" onClick={() => void loadCollaboratorDetail(item.id)}>مشاهده</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        {collaboratorDetail ? (
          <div className="detail-box">
            <h3>{fullName(collaboratorDetail)}</h3>
            <p>جمع سفارشات: {money(collaboratorDetail.summary.totalOrderAmount)}</p>
            <p>مبلغ دریافت شده: {money(collaboratorDetail.summary.totalReceived)}</p>
            <p>طلب باقی‌مانده: {money(collaboratorDetail.summary.totalRemaining)}</p>
            <p>تعداد مشتری معرفی‌شده: {collaboratorDetail.customers?.length || 0}</p>
          </div>
        ) : null}
      </Panel>
    </section>
  );
}
