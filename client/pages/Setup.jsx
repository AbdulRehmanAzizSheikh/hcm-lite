import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Setup() {
  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await client.post('/auth/setup', { companyName, adminEmail, adminPassword });
      toast.success('Setup complete. Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-blue-600">First-run Setup</h1>
        <p className="text-sm text-gray-500 mb-6">Create your company and Admin account</p>
        <form onSubmit={submit} className="space-y-4">
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="w-full border rounded px-3 py-2" required />
          <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email" placeholder="Admin email" className="w-full border rounded px-3 py-2" required />
          <input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} type="password" placeholder="Admin password (min 6)" className="w-full border rounded px-3 py-2" required />
          <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">{loading ? 'Creating...' : 'Create'}</button>
        </form>
      </div>
    </div>
  );
}
