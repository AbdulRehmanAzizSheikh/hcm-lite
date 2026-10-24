import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

import { Link } from 'react-router-dom';
export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [depts, setDepts] = useState([]);
  const [types, setTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);

  const load = async () => {
    const s = await client.get('/settings'); setSettings(s.data);
    const d = await client.get('/departments'); setDepts(d.data);
    const t = await client.get('/leave-types'); setTypes(t.data);
    const h = await client.get('/holidays'); setHolidays(h.data);
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    try { await client.put('/settings', settings); toast.success('Saved'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const addDept = async () => {
    const name = prompt('Department name'); if (!name) return;
    await client.post('/departments', { name }); load();
  };
  const addType = async () => {
    const name = prompt('Leave type name'); if (!name) return;
    const code = prompt('Code (e.g. CASUAL)'); if (!code) return;
    const quota = Number(prompt('Annual quota') || 0);
    await client.post('/leave-types', { name, code, annualQuota: quota, paid: true }); load();
  };
  const addHoliday = async () => {
    const name = prompt('Holiday name'); if (!name) return;
    const date = prompt('Date YYYY-MM-DD'); if (!date) return;
    await client.post('/holidays', { name, date }); load();
  };

  if (!settings) return <div>Loading...</div>;

  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <form onSubmit={saveSettings} className="bg-white rounded shadow p-4 space-y-3">
        <h2 className="font-semibold">Company settings</h2>
        <input value={settings.companyName || ''} onChange={e => setSettings({ ...settings, companyName: e.target.value })} placeholder="Company name" className="w-full border rounded px-3 py-2" disabled={!isAdmin} />
        <div className="grid grid-cols-3 gap-2">
          <input value={settings.officeStart || ''} onChange={e => setSettings({ ...settings, officeStart: e.target.value })} placeholder="Office start HH:mm" className="border rounded px-3 py-2" disabled={!isAdmin} />
          <input type="number" value={settings.graceMinutes} onChange={e => setSettings({ ...settings, graceMinutes: Number(e.target.value) })} placeholder="Grace min" className="border rounded px-3 py-2" disabled={!isAdmin} />
          <input type="number" value={settings.halfDayHours} onChange={e => setSettings({ ...settings, halfDayHours: Number(e.target.value) })} placeholder="Half day hours" className="border rounded px-3 py-2" disabled={!isAdmin} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={settings.officeLocation?.lat || ''} onChange={e => setSettings({ ...settings, officeLocation: { ...settings.officeLocation, lat: Number(e.target.value) } })} placeholder="Office lat" className="border rounded px-3 py-2" disabled={!isAdmin} />
          <input type="number" value={settings.officeLocation?.lng || ''} onChange={e => setSettings({ ...settings, officeLocation: { ...settings.officeLocation, lng: Number(e.target.value) } })} placeholder="Office lng" className="border rounded px-3 py-2" disabled={!isAdmin} />
          <input type="number" value={settings.officeLocation?.radius || 150} onChange={e => setSettings({ ...settings, officeLocation: { ...settings.officeLocation, radius: Number(e.target.value) } })} placeholder="Radius m" className="border rounded px-3 py-2" disabled={!isAdmin} />
        </div>
        {isAdmin && <button className="bg-blue-600 text-white px-3 py-2 rounded">Save settings</button>}
      </form>

      <div className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Departments</h2>
          {isAdmin && <button onClick={addDept} className="text-blue-600 text-sm">+ Add</button>}
        </div>
        {depts.map(d => <div key={d._id} className="text-sm py-1 border-b">{d.name} ({d.code})</div>)}
      </div>

      <div className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Leave types</h2>
          {isAdmin && <button onClick={addType} className="text-blue-600 text-sm">+ Add</button>}
        </div>
        {types.map(t => <div key={t._id} className="text-sm py-1 border-b">{t.name} ({t.code}) quota {t.annualQuota}</div>)}
      </div>

      <div className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Holidays</h2>
          {isAdmin && <button onClick={addHoliday} className="text-blue-600 text-sm">+ Add</button>}
        </div>
        {holidays.map(h => <div key={h._id} className="text-sm py-1 border-b">{h.name} {h.date?.slice(0, 10)}</div>)}
      </div>
      <div className="text-sm">
        <Link to="/guide" className="text-blue-600">Open User Guide →</Link>
      </div>
    </div>
  );
}
