import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Announcements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = async () => { const r = await client.get('/announcements'); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const post = async (e) => {
    e.preventDefault();
    try { await client.post('/announcements', { title, body }); setTitle(''); setBody(''); toast.success('Posted'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Announcements</h1>
      {(user.role === 'admin' || user.role === 'hr') && (
        <form onSubmit={post} className="bg-white rounded shadow p-4 space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-3 py-2" required />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Body" className="w-full border rounded px-3 py-2" required />
          <button className="bg-blue-600 text-white px-3 py-2 rounded">Post</button>
        </form>
      )}
      <div className="space-y-2">
        {items.map(a => (
          <div key={a._id} className="bg-white rounded shadow p-4">
            <div className="font-semibold">{a.title}</div>
            <div className="text-sm text-gray-600">{a.body}</div>
            <div className="text-xs text-gray-400 mt-1">{new Date(a.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
