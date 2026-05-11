import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { fullName, shamsiDate } from '../lib/format';

export function ActivityPage() {
  const { activity } = useBestContext();

  return (
    <Panel>
      <h2>لاگ عملیات</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>زمان</th><th>کاربر</th><th>نوع</th><th>عملیات</th><th>شرح</th></tr></thead>
          <tbody>
            {activity.map((item) => (
              <tr key={item.id}>
                <td>{shamsiDate(item.createdAt)}</td>
                <td>{fullName(item.actor)}</td>
                <td>{item.entityType}</td>
                <td>{item.action}</td>
                <td>{item.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
