import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Attendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [board, setBoard] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    if (user.role === 'employee') {
      const r = await client.get('/attendance', { params: { from: date.slice(0, 7) + '-01', to: date } });
      setRecords(r.data);
    } else {
      const r = await client.get('/attendance/board', { params: { date } });
      setBoard(r.data);
    }
  };
  useEffect(() => { load(); }, [date, user]);

  const checkIn = async () => {
    try { await client.post('/attendance/check-in', { source: 'web' }); toast.success('Checked in'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };
  const checkOut = async () => {
    try { await client.post('/attendance/check-out', {}); toast.success('Checked out'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Attendance</h1>
      <div className="flex gap-2 items-center">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2" />
        {user.role === 'employee' && <>
          <button onClick={checkIn} className="bg-green-600 text-white px-3 py-2 rounded">Check in</button>
          <button onClick={checkOut} className="bg-red-600 text-white px-3 py-2 rounded">Check out</button>
        </>}
      </div>

      {user.role === 'employee' && (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="p-2">Date</th><th className="p-2">Check in</th><th className="p-2">Check out</th><th className="p-2">Status</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r._id} className="border-t">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '-'}</td>
                  <td className="p-2">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '-'}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {board && (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="p-2">Employee</th><th className="p-2">Status</th><th className="p-2">Check in</th><th className="p-2">Check out</th></tr></thead>
            <tbody>
              {board.board?.map(b => (
                <tr key={b.employee._id} className="border-t">
                  <td className="p-2">{b.employee.firstName} {b.employee.lastName}</td>
                  <td className="p-2">{b.onLeave ? 'on_leave' : (b.attendance?.status || 'absent')}</td>
                  <td className="p-2">{b.attendance?.checkIn ? new Date(b.attendance.checkIn).toLocaleTimeString() : '-'}</td>
                  <td className="p-2">{b.attendance?.checkOut ? new Date(b.attendance.checkOut).toLocaleTimeString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
