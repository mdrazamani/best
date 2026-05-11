import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { fullName } from '../lib/format';

export function UsersPage() {
  const { users, roles, permissions, createUser, updateRolePermissions } = useBestContext();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    roleKey: 'manager'
  });

  const editableRoles = useMemo(() => roles.filter((role) => role.key !== 'super_admin'), [roles]);
  const [selectedRoleKey, setSelectedRoleKey] = useState('manager');

  const selectedRolePermissionKeys = useMemo(() => {
    const role = roles.find((item) => item.key === selectedRoleKey);
    return new Set((role?.rolePermissions ?? []).map((item) => item.permission.key));
  }, [roles, selectedRoleKey]);

  const [pendingPermissionKeys, setPendingPermissionKeys] = useState<string[]>([]);

  useEffect(() => {
    setPendingPermissionKeys([]);
  }, [selectedRoleKey]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createUser(form);
    setForm({ firstName: '', lastName: '', username: '', password: '', roleKey: 'manager' });
  };

  const saveRolePermissions = async () => {
    await updateRolePermissions(selectedRoleKey, pendingPermissionKeys);
    setPendingPermissionKeys([]);
  };

  const effectivePermissionSet = pendingPermissionKeys.length
    ? new Set(pendingPermissionKeys)
    : selectedRolePermissionKeys;

  return (
    <section className="grid-2">
      <form onSubmit={submit}>
        <Panel>
          <h2>{'\u062a\u0639\u0631\u06cc\u0641 \u06a9\u0627\u0631\u0628\u0631 \u0645\u062f\u06cc\u0631\u06cc\u062a\u06cc'}</h2>
          <input
            required
            placeholder={'\u0646\u0627\u0645'}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            required
            placeholder={'\u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc'}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <input
            required
            placeholder={'\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc'}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            required
            minLength={6}
            type="password"
            placeholder={'\u0631\u0645\u0632 \u0639\u0628\u0648\u0631'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}>
            {roles.map((role) => (
              <option key={role.id} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
          <button>{'\u062b\u0628\u062a \u06a9\u0627\u0631\u0628\u0631'}</button>
        </Panel>
      </form>

      <Panel>
        <h2>{'\u0644\u06cc\u0633\u062a \u06a9\u0627\u0631\u0628\u0631\u0627\u0646'}</h2>
        <table>
          <thead>
            <tr>
              <th>{'\u0646\u0627\u0645'}</th>
              <th>{'\u06a9\u0627\u0631\u0628\u0631\u06cc'}</th>
              <th>{'\u0646\u0642\u0634\u200c\u0647\u0627'}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{fullName(item)}</td>
                <td>{item.username}</td>
                <td>{item.userRoles?.map((role) => role.role?.name).join('\u060c ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />

        <h2>{'\u062a\u0646\u0638\u06cc\u0645 \u062f\u0633\u062a\u0631\u0633\u06cc \u0646\u0642\u0634\u200c\u0647\u0627'}</h2>
        <select value={selectedRoleKey} onChange={(e) => setSelectedRoleKey(e.target.value)}>
          {editableRoles.map((role) => (
            <option key={role.id} value={role.key}>
              {role.name}
            </option>
          ))}
        </select>

        <div className="checks">
          {permissions.map((permission) => (
            <label key={permission.id}>
              <input
                type="checkbox"
                checked={effectivePermissionSet.has(permission.key)}
                onChange={(e) => {
                  const current = new Set(effectivePermissionSet);
                  if (e.target.checked) {
                    current.add(permission.key);
                  } else {
                    current.delete(permission.key);
                  }
                  setPendingPermissionKeys(Array.from(current));
                }}
              />
              {permission.key}
            </label>
          ))}
        </div>

        <button type="button" onClick={() => void saveRolePermissions()}>
          {'\u0630\u062e\u06cc\u0631\u0647 \u062f\u0633\u062a\u0631\u0633\u06cc\u200c\u0647\u0627'}
        </button>
      </Panel>
    </section>
  );
}
