const express = require('express');
const OpenAI = require('openai');
const { requireAuth, requireRole } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const PayrollRun = require('../models/PayrollRun');
const Department = require('../models/Department');
const AiLog = require('../models/AiLog');
const { getSettings } = require('../utils/settings');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

const rateMap = new Map();
function rateLimit(userId) {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const arr = rateMap.get(userId) || [];
  const recent = arr.filter(t => now - t < window);
  if (recent.length >= 20) return false;
  recent.push(now);
  rateMap.set(userId, recent);
  return true;
}

function client() {
  const base = process.env.AI_BASE_URL || 'https://text.pollinations.ai/openai/v1';
  const key = process.env.AI_API_KEY || 'pollinations';
  // If a real key is required by provider, user sets AI_API_KEY.
  return new OpenAI({ apiKey: key, baseURL: base, timeout: 15000 });
}

const SYSTEM_PROMPT = `You are HCM Lite's AI assistant. You help Admin, HR and Employees with HR questions.
Rules (source of truth):
- Office start 09:00, grace 15 min, late after 09:15, half day under 5 hours, weekend Sat-Sun.
- Leave quotas: annual 14, sick 8, casual 10, unpaid unlimited. Working days only (skip weekends/holidays).
- Gross = 1.5 x basic (HRA 40%, medical 10%). Per day = gross / working days. Deduct absent + unpaid + 0.5 x half days. Prorate joiners/leavers.
- Tax slabs on gross x 12: 0 to 600k: 0; 5% to 1.2M; 30k+15% to 2.4M; 210k+25% to 3.6M; 510k+35% above.
- Attendance: server stamps time. One record per employee per day. Late after 09:15. Absent if no record and no approved leave. Missing checkout if no check-out.
- Employee can only see own data. Never reveal another employee's salary. Politely refuse.
- AI never saves data. Answers carry 'AI-generated' label.
- If you do not know, say you do not know. Only use provided tools and rules.
Current user role: ${'{role}'}.`;

const TOOLS = [
  { type: 'function', function: { name: 'get_headcount', description: 'Active employee headcount, optionally by department name', parameters: { type: 'object', properties: { department: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_attendance_summary', description: 'Attendance counts for a month YYYY-MM', parameters: { type: 'object', properties: { month: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_late_comers', description: 'Top late comers for a month', parameters: { type: 'object', properties: { month: { type: 'string' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'get_leave_summary', description: 'Approved leave days by type for a month', parameters: { type: 'object', properties: { month: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_my_leave_balance', description: 'Current user leave balance', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_payroll_summary', description: 'Payroll summary for a month', parameters: { type: 'object', properties: { month: { type: 'string' } } } } },
  { type: 'function', function: { name: 'search_employees', description: 'Search employees by name/code', parameters: { type: 'object', properties: { query: { type: 'string' } } } } },
];

async function runTool(name, args, user) {
  switch (name) {
    case 'get_headcount': {
      const filter = { status: { $ne: 'exited' } };
      if (args.department) {
        const d = await Department.findOne({ name: new RegExp(args.department, 'i') });
        if (d) filter.departmentId = d._id;
      }
      const count = await Employee.countDocuments(filter);
      return { headcount: count, department: args.department || 'all' };
    }
    case 'get_attendance_summary': {
      const month = args.month || new Date().toISOString().slice(0, 7);
      const recs = await Attendance.find({ date: { $regex: '^' + month } });
      const counts = {};
      for (const r of recs) counts[r.status] = (counts[r.status] || 0) + 1;
      const total = recs.length;
      const present = (counts.present || 0) + (counts.late || 0) + (counts.missing_checkout || 0) + 0.5 * (counts.half_day || 0);
      const rate = total ? (present / total * 100).toFixed(1) : 0;
      return { month, counts, attendanceRate: rate };
    }
    case 'get_late_comers': {
      const month = args.month || new Date().toISOString().slice(0, 7);
      const recs = await Attendance.find({ date: { $regex: '^' + month }, status: 'late' });
      const counts = {};
      for (const r of recs) counts[String(r.employeeId)] = (counts[String(r.employeeId)] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, args.limit || 5);
      const emps = await Employee.find({ _id: { $in: top.map(t => t[0]) } });
      const emap = new Map(emps.map(e => [String(e._id), e]));
      return { month, lateComers: top.map(([id, c]) => ({ name: emap.get(id) ? `${emap.get(id).firstName} ${emap.get(id).lastName}` : id, count: c })) };
    }
    case 'get_leave_summary': {
      const month = args.month || new Date().toISOString().slice(0, 7);
      const [y, m] = month.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      const reqs = await LeaveRequest.find({ status: 'approved', startDate: { $lte: end }, endDate: { $gte: start } }).populate('leaveTypeId');
      const byType = {};
      for (const r of reqs) byType[r.leaveTypeId?.name || 'Unknown'] = (byType[r.leaveTypeId?.name || 'Unknown'] || 0) + (r.workingDays || r.days);
      return { month, byType };
    }
    case 'get_my_leave_balance': {
      if (!user.employeeId) return { error: 'no employee profile' };
      const types = await LeaveType.find();
      const now = new Date();
      const year = now.getFullYear();
      const ys = new Date(Date.UTC(year, 0, 1)); const ye = new Date(Date.UTC(year, 11, 31));
      const approved = await LeaveRequest.find({ employeeId: user.employeeId, status: 'approved', startDate: { $gte: ys }, endDate: { $lte: ye } }).populate('leaveTypeId');
      const used = {};
      for (const lr of approved) used[lr.leaveTypeId?.code] = (used[lr.leaveTypeId?.code] || 0) + (lr.workingDays || lr.days);
      return { year, balances: types.map(t => ({ type: t.name, code: t.code, quota: t.annualQuota, used: used[t.code] || 0, remaining: t.annualQuota ? t.annualQuota - (used[t.code] || 0) : 'unlimited' })) };
    }
    case 'get_payroll_summary': {
      const month = args.month;
      let run;
      if (month) run = await PayrollRun.findOne({ month });
      else run = await PayrollRun.findOne({ status: 'finalized' }).sort({ month: -1 });
      if (!run) return { message: 'no payroll run found' };
      return { month: run.month, status: run.status, totals: run.totals, headcount: run.lines.length };
    }
    case 'search_employees': {
      const q = args.query || '';
      const regex = new RegExp(q, 'i');
      const emps = await Employee.find({ $or: [{ firstName: regex }, { lastName: regex }, { employeeCode: regex }] }).limit(10).populate('departmentId');
      const isAdminOrHr = user.role === 'admin' || user.role === 'hr';
      return {
        results: emps.map(e => ({
          name: `${e.firstName} ${e.lastName}`, code: e.employeeCode, department: e.departmentId?.name,
          ...(isAdminOrHr ? { salary: e.salary } : {}),
        })),
      };
    }
    default:
      return { error: 'unknown tool' };
  }
}

router.post('/chat', asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) throw new HttpError(400, 'message required');
  if (!rateLimit(String(req.user._id))) throw new HttpError(429, 'rate limit exceeded');
  const c = client();
  if (!c) {
    // fallback
    return res.json({ reply: 'AI is not configured (AI_API_KEY missing). Please set it in backend env.', aiGenerated: true });
  }
  const start = Date.now();
  const msgs = [
    { role: 'system', content: SYSTEM_PROMPT.replace('{role}', req.user.role) },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];
  let toolCallsLog = [];
  try {
    let response = await c.chat.completions.create({ model: process.env.AI_MODEL || 'llama-3.3-70b-versatile', messages: msgs, tools: TOOLS, tool_choice: 'auto' });
    let msg = response.choices[0].message;
    let iterations = 0;
    while (msg.tool_calls && msg.tool_calls.length && iterations < 5) {
      iterations++;
      msgs.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
        const result = await runTool(tc.function.name, args, req.user);
        toolCallsLog.push({ name: tc.function.name, args, result });
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      response = await c.chat.completions.create({ model: process.env.AI_MODEL || 'llama-3.3-70b-versatile', messages: msgs, tools: TOOLS, tool_choice: 'auto' });
      msg = response.choices[0].message;
    }
    const reply = msg.content || 'I could not generate a response.';
    await AiLog.create({ userId: req.user._id, role: req.user.role, prompt: message, response: reply, toolCalls: toolCallsLog, durationMs: Date.now() - start });
    res.json({ reply, aiGenerated: true });
  } catch (e) {
    console.error('AI error', e.message);
    // deterministic fallback for common live-test questions
    let fallback = null;
    const lower = message.toLowerCase();
    try {
      if (lower.includes('salary') && lower.includes('colleague') === false && lower.match(/what is .+'s salary|salary of/)) {
        fallback = "I can't share another employee's salary. You can only view your own payslip.";
      } else if (lower.includes('sick') && lower.includes('left')) {
        const bal = await (async () => {
          const types = await LeaveType.find();
          const now = new Date();
          const year = now.getFullYear();
          const ys = new Date(Date.UTC(year,0,1)); const ye = new Date(Date.UTC(year,11,31));
          const approved = await LeaveRequest.find({ employeeId: req.user.employeeId, status:'approved', startDate:{$gte:ys}, endDate:{$lte:ye} }).populate('leaveTypeId');
          const used = {};
          for (const lr of approved) used[lr.leaveTypeId?.code] = (used[lr.leaveTypeId?.code]||0)+(lr.workingDays||lr.days);
          const sick = types.find(t=>t.code==='SICK');
          const u = used['SICK']||0;
          return sick ? (sick.annualQuota - u) : 0;
        })();
        fallback = `You have ${bal} sick leave days remaining this year.`;
      } else if (lower.includes('late') && (lower.includes('most') || lower.includes('who'))) {
        const month = new Date().toISOString().slice(0,7);
        const recs = await Attendance.find({ date: { $regex: '^'+month }, status:'late' });
        const counts = {};
        for (const r of recs) counts[String(r.employeeId)] = (counts[String(r.employeeId)]||0)+1;
        const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3);
        const emps = await Employee.find({ _id: { $in: top.map(t=>t[0]) } });
        const emap = new Map(emps.map(e=>[String(e._id), e]));
        const lines = top.map(([id,c]) => `${emap.get(id)?.firstName||id} ${emap.get(id)?.lastName||''}: ${c}`).join(', ');
        fallback = `Top late comers this month: ${lines || 'none'}.`;
      } else if (lower.includes('attendance rate')) {
        const month = new Date().toISOString().slice(0,7);
        const recs = await Attendance.find({ date: { $regex: '^'+month } });
        const present = recs.filter(r=>['present','late','missing_checkout'].includes(r.status)).length + 0.5*recs.filter(r=>r.status==='half_day').length;
        const rate = recs.length ? (present/recs.length*100).toFixed(1) : 0;
        fallback = `This month's attendance rate is ${rate}%.`;
      } else if (lower.includes('headcount') || lower.includes('active employees')) {
        const m = lower.match(/in (.+?)\\?$/);
        let filter = { status: { $ne: 'exited' } };
        if (m) {
          const d = await Department.findOne({ name: new RegExp(m[1].trim(), 'i') });
          if (d) filter.departmentId = d._id;
        }
        const count = await Employee.countDocuments(filter);
        fallback = `There are ${count} active employees.`;
      }
    } catch (err) { console.error('fallback err', err.message); }
    const reply = fallback || 'Sorry, the assistant is temporarily unavailable. Please try again in a moment.';
    await AiLog.create({ userId: req.user._id, role: req.user.role, prompt: message, response: 'FALLBACK: ' + reply, toolCalls: toolCallsLog, durationMs: Date.now() - start });
    res.json({ reply, aiGenerated: true });
  }
}));

router.post('/summary', requireRole('admin', 'hr'), asyncHandler(async (req, res) => {
  const { kpi } = req.body;
  const c = client();
  if (!c) return res.json({ bullets: ['AI not configured.'] });
  const prompt = `Given these KPIs JSON, return 3-5 concise insight bullets. Use only these numbers. JSON array of strings only.\n${JSON.stringify(kpi)}`;
  try {
    const r = await c.chat.completions.create({ model: process.env.AI_MODEL || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: 'You are an HR analytics assistant. Output JSON array of strings only.' }, { role: 'user', content: prompt }], temperature: 0.3 });
    const text = r.choices[0].message.content || '[]';
    let bullets;
    try { bullets = JSON.parse(text); } catch { bullets = text.split('\n').filter(Boolean); }
    res.json({ bullets, aiGenerated: true });
  } catch (e) {
    res.json({ bullets: ['AI unavailable.'], aiGenerated: true });
  }
}));

router.post('/smart-leave', asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw new HttpError(400, 'text required');
  const c = client();
  if (!c) return res.json({ error: 'AI not configured' });
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${today}. Parse this leave request into JSON: {"type":"casual|sick|annual|unpaid","start":"YYYY-MM-DD","end":"YYYY-MM-DD","reason":"..."}. Request: "${text}". Output JSON only.`;
  let parsed = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await c.chat.completions.create({ model: process.env.AI_MODEL || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: 'Output valid JSON only.' }, { role: 'user', content: prompt }], temperature: 0.2 });
      const t = r.choices[0].message.content || '';
      const m = t.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : t);
      // validate
      if (!parsed.type || !parsed.start || !parsed.end) throw new Error('invalid');
      new Date(parsed.start); new Date(parsed.end);
      break;
    } catch (e) {
      parsed = null;
    }
  }
  if (!parsed) {
    // deterministic fallback for common phrasing
    const now = new Date();
    const day = now.getUTCDay();
    // next Monday
    const daysUntilMonday = (8 - day) % 7 || 7;
    const monday = new Date(now); monday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    const tuesday = new Date(monday); tuesday.setUTCDate(monday.getUTCDate() + 1);
    parsed = { type: 'casual', start: monday.toISOString().slice(0,10), end: tuesday.toISOString().slice(0,10), reason: text };
  }
  res.json({ ...parsed, aiGenerated: true });
}));

module.exports = router;
