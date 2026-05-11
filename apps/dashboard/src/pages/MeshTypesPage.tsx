import { FormEvent, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';

export function MeshTypesPage() {
  const { meshTypes, createMeshType } = useBestContext();
  const [form, setForm] = useState({ title: '', description: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createMeshType({ ...form, isActive: true });
    setForm({ title: '', description: '' });
  };

  return (
    <section className="grid-2">
      <form onSubmit={submit}>
        <Panel>
          <h2>تعریف نوع توری</h2>
          <input placeholder="عنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea placeholder="توضیح" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button>ثبت</button>
        </Panel>
      </form>
      <Panel>
        <h2>لیست نوع توری</h2>
        <table>
          <thead><tr><th>عنوان</th><th>توضیح</th><th>وضعیت</th></tr></thead>
          <tbody>{meshTypes.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.description || '-'}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td></tr>)}</tbody>
        </table>
      </Panel>
    </section>
  );
}
