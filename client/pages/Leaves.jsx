import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Leaves() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [balance, setBalance] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [smartText, setSmartText] = useState('');
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });

  const load = async () => {
    const r = await client.get('/leaves');
    setItems(r.data);
    if (user.role === 'employee' && user.employeeId) {
      const t = await client.get('/leave-types'); setTypes(t.data);
      const b = await client.get(`/leaves/balance/${user.employeeId}`); setBalance(b.data);
    } else {
      const t = await client.get('/leave-types'); setTypes(t.data);
    }
  };
  useEffect(() => { load(); }, []);

  const apply = async (e) => {
    e.preventDefault();
    try {
      await client.post('/leaves', { ...form, employeeId: user.employeeId });
      toast.success('Leave applied');
      setShowApply(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const smart = async () => {
    try {
      const r = await client.post('/ai/smart-leave', { text: smartText });
      if (r.data.error) { toast.error('Could not parse'); return; }
      const lt = types.find(t => t.code.toLowerCase() === String(r.data.type).toLowerCase() || t.name.toLowerCase().includes(String(r.data.type).toLowerCase()));
      setForm({ leaveTypeId: lt?._id || '', startDate: r.data.start, endDate: r.data.end, reason: r.data.reason || smartText });
      setShowApply(true);
    } catch (e) { toast.error('Smart leave failed'); }
  };

  const decide = async (id, status) => {
    try {
      await client.patch(`/leaves/${id}/${status}`, { comment: '' });
      toast.success(`Leave ${status}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const cancel = async (id) => {
    try { await client.patch(`/leaves/${id}/cancel`); toast.success('Cancelled'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaves</h1>
      {user.role === 'employee' && (
        <div className="bg-white rounded shadow p-4 space-y-2">
          <div className="flex gap-2">
            <input value={smartText} onChange={e => setSmartText(e.target.value)} placeholder="Type a sentence e.g. Need next Monday off for wedding" className="flex-1 border rounded px-3 py-2" />
            <button onClick={smart} className="bg-purple-600 text-white px-3 py-2 rounded">Smart leave</button>
            <button onClick={() => setShowApply(true)} className="bg-blue-600 text-white px-3 py-2 rounded">Apply leave</button>
          </div>
          {balance && (
            <div className="text-sm">
              {balance.balances?.map(b => <span key={b.leaveType?._id || b.code} className="mr-4">{b.leaveType?.name || b.code}: {b.remaining ?? '∞'}</span>)}
            </div>
          )}
        </div>
      )}

      {showApply && (
        <form onSubmit={apply} className="bg-white rounded shadow p-4 space-y-2">
          <select value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })} className="w-full border rounded px-3 py-2" required>
            <option value="">Select type</option>
            {types.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="border rounded px-3 py-2" required />
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="border rounded px-3 py-2" required />
          </div>
          <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason" className="w-full border rounded px-3 py-2" />
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white px-3 py-2 rounded">Submit</button>
            <button type="button" onClick={() => setShowApply(false)} className="px-3 py-2">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr><th className="p-2">Employee</th><th className="p-2">Type</th><th className="p-2">Dates</th><th className="p-2">Days</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr>
          </thead>
          <tbody>
            {items.map(l => (
              <tr key={l._id} className="border-t">
                <td className="p-2">{l.employeeId?.firstName} {l.employeeId?.lastName}</td>
                <td className="p-2">{l.leaveTypeId?.name}</td>
                <td className="p-2">{l.startDate?.slice(0, 10)} → {l.endDate?.slice(0, 10)}</td>
                <td className="p-2">{l.workingDays}</td>
                <td className="p-2">{l.status}</td>
                <td className="p-2 space-x-1">
                  {(user.role === 'hr' || user.role === 'admin') && l.status === 'pending' && <>
                    <button onClick={() => decide(l._id, 'approve')} className="text-green-600">Approve</button>
                    <button onClick={() => decide(l._id, 'reject')} className="text-red-600">Reject</button>
                  </>}
                  {user.role === 'employee' && l.status === 'pending' && <button onClick={() => cancel(l._id)} className="text-gray-600">Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
