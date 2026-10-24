import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [basic, setBasic] = useState(0);

  const load = async () => {
    const r = await client.get(`/employees/${id}`);
    setEmp(r.data);
    setBasic(r.data.salary?.basic || 0);
  };
  useEffect(() => { load(); }, [id]);

  const saveSalary = async () => {
    try { await client.put(`/employees/${id}/salary`, { basic }); toast.success('Salary updated'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try { await client.put(`/employees/${id}`, { phone: emp.phone, address: emp.address }); toast.success('Saved'); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  if (!emp) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{emp.firstName} {emp.lastName}</h1>
      <div className="bg-white rounded shadow p-4 grid grid-cols-2 gap-2 text-sm">
        <div><b>Code:</b> {emp.employeeCode}</div>
        <div><b>Email:</b> {emp.email}</div>
        <div><b>Phone:</b> {emp.phone}</div>
        <div><b>Status:</b> {emp.status}</div>
        <div><b>Department:</b> {emp.departmentId?.name}</div>
        <div><b>Designation:</b> {emp.designationId?.name}</div>
        <div><b>Joined:</b> {emp.joinDate?.slice(0, 10)}</div>
      </div>

      {(user.role === 'employee') && (
        <form onSubmit={saveProfile} className="bg-white rounded shadow p-4 space-y-2">
          <h2 className="font-semibold">Edit phone & address</h2>
          <input value={emp.phone || ''} onChange={e => setEmp({ ...emp, phone: e.target.value })} placeholder="Phone" className="w-full border rounded px-3 py-2" />
          <textarea value={emp.address || ''} onChange={e => setEmp({ ...emp, address: e.target.value })} placeholder="Address" className="w-full border rounded px-3 py-2" />
          <button className="bg-blue-600 text-white px-3 py-2 rounded">Save</button>
        </form>
      )}

      {(user.role === 'hr' || user.role === 'admin') && (
        <div className="bg-white rounded shadow p-4 space-y-2">
          <h2 className="font-semibold">Salary structure</h2>
          <div className="text-sm text-gray-600">Basic: {emp.salary?.basic} HRA: {emp.salary?.hra} Medical: {emp.salary?.medical} Allowances: {emp.salary?.allowances}</div>
          <div className="flex gap-2">
            <input type="number" value={basic} onChange={e => setBasic(Number(e.target.value))} className="border rounded px-3 py-2" />
            <button onClick={saveSalary} className="bg-blue-600 text-white px-3 py-2 rounded">Update basic (auto HRA/medical)</button>
          </div>
        </div>
      )}
    </div>
  );
}
