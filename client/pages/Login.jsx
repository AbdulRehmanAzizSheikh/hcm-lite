import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-blue-600">HCM Lite</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to continue</p>
        <form onSubmit={submit} className="space-y-4">
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full border rounded px-3 py-2" required />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full border rounded px-3 py-2" required />
          <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <div className="mt-4 text-sm text-gray-500">
          First time? <Link to="/setup" className="text-blue-600">Run setup</Link>
        </div>
      </div>
    </div>
  );
}
