import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GUIDE_T, LANGS } from '../i18n/translations';

const guides = {
  admin: [
    ['First-run setup', 'Go to /setup (or Settings) → company name, admin email/password.'],
    ['Company settings', 'Settings → office hours, grace, weekend, office lat/lng/radius.'],
    ['Departments/Designations/Leave types/Holidays', 'Settings → add departments, leave types (Casual/Sick/Annual), holidays.'],
    ['Create HR login', 'Users → email, temp password, role HR.'],
    ['Register employee', 'Employees → Add employee (creates login with temp password Temp@1234).'],
    ['Finalize payroll', 'Payroll → create draft (HR) → review → Finalize (locks month).'],
    ['Audit log', 'Audit Log → view all actions with before/after JSON.'],
    ['Announcements', 'Announcements → post for all roles.'],
    ['AI assistant', 'Chat panel → ask headcount, late comers, attendance rate. Dashboard → Summarize.'],
  ],
  hr: [
    ['Employees', 'Employees → add/edit, CSV import (dry run), export.'],
    ['Attendance board', 'Attendance → daily board, approve corrections.'],
    ['Leave approval', 'Leaves → approve/reject with comment.'],
    ['Payroll draft', 'Payroll → create draft for month, review lines.'],
    ['Salary structure', 'Employee detail → update basic (HRA/medical auto).'],
    ['Announcements', 'Post announcements.'],
    ['AI', 'Chat + dashboard summary.'],
  ],
  employee: [
    ['Login', 'Use temp password, then change password.'],
    ['Check in/out', 'Attendance → Check in / Check out (web).'],
    ['Leave apply', 'Leaves → Apply leave or Smart leave (type a sentence).'],
    ['Payslip', 'Payroll → download PDF after finalize.'],
    ['Profile', 'Employee detail → edit phone & address.'],
    ['AI', 'Ask own leave balance, attendance; colleague salary refused.'],
  ],
};

export default function Guide() {
  const { user } = useAuth();
  const role = user?.role || 'employee';
  const [tab, setTab] = useState(role === 'hr' ? 'hr' : role === 'admin' ? 'admin' : 'employee');
  const [guideLang, setGuideLang] = useState('en');
  const G = GUIDE_T[guideLang] || GUIDE_T.en;
  const tabKeys = ['admin', 'hr', 'employee'];
  const tabLabels = G.tabs;
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{G.title}</h1>
        <select value={guideLang} onChange={e => setGuideLang(e.target.value)} className="border rounded px-2 py-1 text-sm">
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        {tabKeys.map((t, i) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded text-sm ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{tabLabels[i]}</button>
        ))}
      </div>
      <div className="bg-white rounded shadow p-4">
        <ul className="space-y-2">
          {(G[tab] || []).map(([title, desc], i) => (
            <li key={i} className="border-b pb-2">
              <div className="font-medium">{title}</div>
              <div className="text-sm text-gray-600">{desc}</div>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-blue-50 rounded p-4 text-sm">
        <b>{G.smartExample}</b>
        <br /><b>{G.refuseExample}</b>
      </div>
    </div>
  );
}
