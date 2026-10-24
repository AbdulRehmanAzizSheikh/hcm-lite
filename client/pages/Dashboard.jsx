import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Users, ClipboardCheck, Calendar, Wallet, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const url = user.role === 'admin' ? '/dashboard/admin' : user.role === 'hr' ? '/dashboard/hr' : '/dashboard/employee';
    client.get(url).then(r => {
      setData(r.data);
      // AI summary for admin/hr
      if (user.role !== 'employee') {
        client.post('/ai/summary', { kpi: r.data }).then(s => setSummary(s.data.bullets)).catch(() => {});
      }
    }).catch(() => {});
  }, [user]);

  if (!data) return <div>Loading dashboard...</div>;

  if (user.role === 'employee') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Hours this week" value={`${data.hoursThisWeek}h / 40h`} icon={ClipboardCheck} />
          <Card title="Late this month" value={data.lateCountThisMonth} icon={TrendingUp} />
          <Card title="Last payslip" value={data.lastPayslip ? `${data.lastPayslip.month}: ${data.lastPayslip.net}` : 'None'} icon={Wallet} />
        </div>
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Leave balance</h2>
          {data.balances?.map(b => (
            <div key={b.code} className="flex justify-between text-sm py-1 border-b">
              <span>{b.name}</span><span>{b.remaining === null ? '∞' : b.remaining} / {b.quota}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Announcements</h2>
          {data.announcements?.map(a => <div key={a._id} className="py-2 border-b"><div className="font-medium">{a.title}</div><div className="text-sm text-gray-600">{a.body}</div></div>)}
        </div>
      </div>
    );
  }

  // admin/hr
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{user.role === 'admin' ? 'Admin Dashboard' : 'HR Dashboard'}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {user.role === 'admin' && <>
          <Card title="Headcount" value={data.headcount} icon={Users} />
          <Card title="Exits YTD" value={data.exitsYTD} icon={TrendingUp} />
          <Card title="Payroll cost" value={data.payrollCost} icon={Wallet} />
          <Card title="Avg salary" value={Math.round(data.avgSalary)} icon={Wallet} />
        </>}
        {user.role === 'hr' && <>
          <Card title="Headcount" value={data.headcount} icon={Users} />
          <Card title="Present today" value={data.presentToday} icon={ClipboardCheck} />
          <Card title="On leave today" value={data.onLeaveToday} icon={Calendar} />
          <Card title="Late today" value={data.lateToday} icon={TrendingUp} />
          <Card title="Pending approvals" value={data.pendingApprovals} icon={Calendar} />
        </>}
      </div>
      {summary && (
        <div className="bg-blue-50 rounded p-4">
          <h2 className="font-semibold mb-2">AI Summary <span className="ai-label">(AI-generated)</span></h2>
          <ul className="list-disc ml-5 text-sm">{summary.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}
      {user.role === 'hr' && data.topLate && (
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Top late comers this month</h2>
          {data.topLate.map((t, i) => <div key={i} className="flex justify-between text-sm py-1 border-b"><span>{t.name}</span><span>{t.count}</span></div>)}
        </div>
      )}
      {user.role === 'hr' && data.leaveByType && (
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Leave by type (days)</h2>
          {Object.entries(data.leaveByType).map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1 border-b"><span>{k}</span><span>{v}</span></div>)}
        </div>
      )}
      {user.role === 'admin' && data.byDept && (
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Headcount by department</h2>
          {Object.entries(data.byDept).map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1 border-b"><span>{k}</span><span>{v}</span></div>)}
        </div>
      )}
    </div>
  );
}

function Card({ title, value, icon: Icon }) {
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        {Icon && <Icon className="text-blue-500" size={24} />}
      </div>
    </div>
  );
}
