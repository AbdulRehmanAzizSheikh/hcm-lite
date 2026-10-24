import { useEffect, useState } from 'react';
import client from '../api/client';

export default function Audit() {
  const [items, setItems] = useState([]);
  useEffect(() => { client.get('/audit').then(r => setItems(r.data)).catch(() => {}); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100"><tr><th className="p-2">When</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Entity</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a._id} className="border-t">
                <td className="p-2">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="p-2">{a.actorId?.email} ({a.actorRole})</td>
                <td className="p-2">{a.action}</td>
                <td className="p-2">{a.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
