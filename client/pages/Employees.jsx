import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Employees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', employeeCode: '', joinDate: '', departmentId: '', salary: { basic: 0 } });

  const load = async () => {
    const r = await client.get('/employees', { params: { q, limit: 100 } });
    setItems(r.data.items || []);
  };
  useEffect(() => { load(); }, [q]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const r = await client.post('/employees', form);
      toast.success('Employee created. Temp password: ' + r.data.tempPassword);
      setShowCreate(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const dry = await client.post('/employees/import?dryRun=true', fd);
      if (dry.data.errors?.length) {
        toast.error(`${dry.data.errors.length} errors. Check console.`);
        console.log(dry.data.errors);
      }
      if (!confirm(`Import ${dry.data.valid} valid rows?`)) return;
      const fd2 = new FormData(); fd2.append('file', file);
      const res = await client.post('/employees/import?dryRun=false', fd2);
      toast.success(`Imported ${res.data.created}`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
  };

  const exportCsv = async () => {
    const r = await client.get('/employees/export', { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = 'employees.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Employees</h1>
        <div className="flex gap-2">
          {(user.role === 'hr' || user.role === 'admin') && <>
            <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Add employee</button>
            <label className="bg-gray-200 px-3 py-2 rounded text-sm cursor-pointer">Import CSV<input type="file" accept=".csv" onChange={handleImport} className="hidden" /></label>
            <button onClick={exportCsv} className="bg-gray-200 px-3 py-2 rounded text-sm">Export CSV</button>
          </>}
        </div>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="w-full border rounded px-3 py-2" />
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Code</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Department</th><th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(e => (
              <tr key={e._id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/employees/${e._id}`)}>
                <td className="p-2">{e.employeeCode}</td>
                <td className="p-2">{e.firstName} {e.lastName}</td>
                <td className="p-2">{e.email}</td>
                <td className="p-2">{e.departmentId?.name}</td>
                <td className="p-2">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={create} className="bg-white p-6 rounded shadow w-full max-w-lg space-y-3">
            <h2 className="font-bold text-lg">New employee</h2>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="First name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="border rounded px-3 py-2" required />
              <input placeholder="Last name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="border rounded px-3 py-2" required />
              <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border rounded px-3 py-2" required />
              <input placeholder="Employee code" value={form.employeeCode} onChange={e => setForm({ ...form, employeeCode: e.target.value })} className="border rounded px-3 py-2" required />
              <input type="date" value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })} className="border rounded px-3 py-2" required />
              <input type="number" placeholder="Basic salary" value={form.salary.basic} onChange={e => setForm({ ...form, salary: { basic: Number(e.target.value) } })} className="border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2">Cancel</button>
              <button className="bg-blue-600 text-white px-3 py-2 rounded">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
