import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Payroll() {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const r = await client.get('/payroll');
    setRuns(r.data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const r = await client.post('/payroll', { month });
      toast.success('Payroll draft created');
      setSelected(r.data);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const finalize = async (id) => {
    try { await client.patch(`/payroll/${id}/finalize`); toast.success('Finalized'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const downloadPayslip = async (runId, empId) => {
    const r = await client.get(`/payroll/${runId}/payslip/${empId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = 'payslip.pdf'; a.click();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payroll</h1>
      {(user.role === 'hr' || user.role === 'admin') && (
        <div className="flex gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded px-3 py-2" />
          <button onClick={create} className="bg-blue-600 text-white px-3 py-2 rounded">Create draft</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {runs.map(run => (
          <div key={run._id} className="bg-white rounded shadow p-4 space-y-2">
            <div className="flex justify-between">
              <div className="font-semibold">{run.month}</div>
              <span className={`text-xs px-2 py-1 rounded ${run.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{run.status}</span>
            </div>
            <div className="text-sm">Gross: {run.totals?.gross} Net: {run.totals?.net}</div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(run)} className="text-blue-600 text-sm">View</button>
              {user.role === 'admin' && run.status !== 'finalized' && <button onClick={() => finalize(run._id)} className="text-green-600 text-sm">Finalize</button>}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">{selected.month} lines</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="p-2">Employee</th><th className="p-2">Gross</th><th className="p-2">Deduction</th><th className="p-2">Tax</th><th className="p-2">Net</th><th className="p-2">Payslip</th></tr></thead>
            <tbody>
              {selected.lines.map(l => (
                <tr key={l.employeeId} className="border-t">
                  <td className="p-2">{l.employeeName}</td>
                  <td className="p-2">{l.gross}</td>
                  <td className="p-2">{l.deduction}</td>
                  <td className="p-2">{l.tax}</td>
                  <td className="p-2">{l.net}</td>
                  <td className="p-2">
                    {(user.role !== 'employee' || String(user.employeeId) === String(l.employeeId)) && (
                      <button onClick={() => downloadPayslip(selected._id, l.employeeId)} className="text-blue-600 text-sm">PDF</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
