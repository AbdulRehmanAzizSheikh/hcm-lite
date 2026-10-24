import { useEffect, useState } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Users() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ email: '', password: 'Temp@1234', role: 'hr' });

  const load = async () => { const r = await client.get('/users'); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try { await client.post('/users', form); toast.success('Created'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const reset = async (id) => {
    try { const r = await client.patch(`/users/${id}/reset-password`, {}); toast.success('Temp password: ' + r.data.tempPassword); }
    catch (e) { toast.error('Failed'); }
  };
  const deactivate = async (id) => {
    try { await client.patch(`/users/${id}/deactivate`); toast.success('Deactivated'); load(); }
    catch (e) { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <form onSubmit={create} className="bg-white rounded shadow p-4 flex gap-2">
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="border rounded px-3 py-2" required />
        <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Temp password" className="border rounded px-3 py-2" required />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="border rounded px-3 py-2">
          <option value="hr">hr</option><option value="admin">admin</option>
        </select>
        <button className="bg-blue-600 text-white px-3 py-2 rounded">Create</button>
      </form>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100"><tr><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Active</th><th className="p-2">Actions</th></tr></thead>
          <tbody>
            {items.map(u => (
              <tr key={u._id} className="border-t">
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">{u.active ? 'yes' : 'no'}</td>
                <td className="p-2 space-x-2">
                  <button onClick={() => reset(u._id)} className="text-blue-600">Reset pwd</button>
                  {u.active && <button onClick={() => deactivate(u._id)} className="text-red-600">Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
