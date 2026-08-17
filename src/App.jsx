import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Pencil,
  Trash2,
  X,
  Calendar,
} from 'lucide-react';
import { isLoggedIn, logout, fetchRemoteData, pushRemoteData } from './pb';
import LoginScreen from './LoginScreen';

// ============================================================
// DATA: goal *definitions* (title, type, target, subtasks, ...)
// live in localStorage under GOALS_STORAGE_KEY, separate from the
// daily history log. DEFAULT_GOALS below is only the seed used the
// first time the app runs with no saved goals yet.
//
// `status` (active | backlog) only means anything for type 'project':
// it's what the Today/Backlog split and the WIP limit operate on.
// Skills always live on the Skills tab, and habits and logs always
// live on Today, regardless of any stored status.
// ============================================================
const DEFAULT_GOALS = [
  {
    id: 'ansible',
    title: 'Ansible Training',
    subtitle: 'Red Hat course — hard deadline Sunday',
    type: 'skill',
    unit: 'pages',
    dailyTarget: 8,
    color: '#DC5F3C',
  },
  {
    id: 'umgc',
    title: 'UMGC Cybersecurity',
    subtitle: 'Get 1 unit ahead before course starts',
    type: 'project',
    color: '#2E6F6B',
    status: 'active',
    subtasks: [
      { id: 'reading', label: 'Reading', done: false },
      { id: 'assignment', label: 'Assignment', done: false },
      { id: 'discussion', label: 'Discussion', done: false },
    ],
  },
  { id: 'pi-home-assistant', title: 'Raspberry Pi home assistant', type: 'project', status: 'backlog' },
  { id: 'pi-router', title: 'Raspberry Pi router build', type: 'project', status: 'backlog' },
  { id: 'sign-language', title: 'Learn sign language', type: 'skill' },
  { id: 'zenoflow', title: 'Zenoflow', type: 'project', status: 'backlog' },
  { id: 'ngc', title: 'NGC', type: 'project', status: 'backlog' },
  { id: 'read-more', title: 'Read more', type: 'habit' },
  { id: 'notes', title: 'Daily Notes', subtitle: 'Anything worth remembering', type: 'log', color: '#8E6FB5' },
];

const GOALS_STORAGE_KEY = 'goalTrackerGoals';
const HISTORY_STORAGE_KEY = 'goalTrackerHistory';
const WIP_LIMIT = 2;

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'goal'
  );
}

function makeUniqueId(base, existingIds) {
  if (!existingIds.includes(base)) return base;
  let i = 2;
  while (existingIds.includes(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

// Progress for a goal on a given day's history entry. Goals with
// subtasks derive progress from how many are checked (current state,
// not a per-day snapshot); everything else falls back to the
// manually-entered amount vs. dailyTarget (habits default to a
// target of 1 — a plain done/not-done toggle — since their form
// never collects a number). Not used for type 'log' — logs have no
// target/done concept, just a running list of entries.
function goalProgress(goal, dayEntry) {
  if (goal.subtasks && goal.subtasks.length) {
    const amount = goal.subtasks.filter((s) => s.done).length;
    const target = goal.subtasks.length;
    return { amount, target, isDone: amount === target };
  }
  const amount = (dayEntry && dayEntry[goal.id]) || 0;
  const target = goal.dailyTarget || 1;
  return { amount, target, isDone: amount >= target };
}

// Count consecutive days, walking backward from today, where every
// item in `items` was fully met. Stops at the first day that doesn't
// fully qualify (or has no entry at all).
function computeStreak(items, history) {
  if (!items.length) return 0;
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toISOString().split('T')[0];
    const day = history[key];
    const allDone = items.every((g) => goalProgress(g, day).isDone);
    if (!allDone) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Every log-type goal's entries across every date, newest date first
// and newest entry first within a date. Reads straight from the
// history log — entries for a log goal are stored as an array under
// history[date][goalId], instead of the number used by other types.
function buildLogHistory(goals, history) {
  const logGoals = goals.filter((g) => g.type === 'log');
  if (!logGoals.length) return [];
  const dates = Object.keys(history).sort((a, b) => b.localeCompare(a));
  const grouped = [];
  for (const date of dates) {
    const day = history[date];
    const entries = [];
    for (const goal of logGoals) {
      const dayEntries = day[goal.id];
      if (!Array.isArray(dayEntries)) continue;
      for (const entry of dayEntries) {
        entries.push({ ...entry, goalTitle: goal.title, goalColor: goal.color });
      }
    }
    if (entries.length) {
      entries.sort((a, b) => new Date(b.time) - new Date(a.time));
      grouped.push({ date, entries });
    }
  }
  return grouped;
}

function formatDeadline(deadline) {
  return new Date(`${deadline}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function iconBtnStyle() {
  return {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  };
}

function GoalCard({ goal, dayEntry, onIncrement, onDecrement, onToggleSubtask, onToggleHabit, onEdit, onDelete }) {
  const { amount, target, isDone } = goalProgress(goal, dayEntry);
  const pct = target > 0 ? Math.min(100, Math.round((amount / target) * 100)) : 0;
  const hasSubtasks = Boolean(goal.subtasks && goal.subtasks.length);
  const isHabitToggle = !hasSubtasks && goal.type === 'habit';

  return (
    <div
      style={{
        background: '#1C1C1E',
        borderRadius: 16,
        padding: 20,
        border: `1px solid ${isDone ? goal.color : '#2C2C2E'}`,
        transition: 'border-color 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, color: '#F2F2F7', fontSize: 17, fontWeight: 600 }}>
            {goal.title}
          </h3>
          {goal.subtitle && (
            <p style={{ margin: '4px 0 0', color: '#8E8E93', fontSize: 13 }}>
              {goal.subtitle}
            </p>
          )}
          {goal.deadline && (
            <p style={{ margin: '4px 0 0', color: '#8E8E93', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> Due {formatDeadline(goal.deadline)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => onEdit(goal)} style={iconBtnStyle()} aria-label="Edit goal">
            <Pencil size={15} color="#636366" />
          </button>
          <button onClick={() => onDelete(goal)} style={iconBtnStyle()} aria-label="Delete goal">
            <Trash2 size={15} color="#636366" />
          </button>
          {isDone ? (
            <CheckCircle2 size={22} color={goal.color} />
          ) : (
            <Circle size={22} color="#3A3A3C" />
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, background: '#2C2C2E', borderRadius: 8, height: 8, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: goal.color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {hasSubtasks ? (
        <>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goal.subtasks.map((st) => (
              <button
                key={st.id}
                onClick={() => onToggleSubtask(goal.id, st.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {st.done ? (
                  <CheckCircle2 size={18} color={goal.color} />
                ) : (
                  <Circle size={18} color="#3A3A3C" />
                )}
                <span
                  style={{
                    color: st.done ? '#8E8E93' : '#F2F2F7',
                    fontSize: 14,
                    textDecoration: st.done ? 'line-through' : 'none',
                  }}
                >
                  {st.label}
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, color: '#8E8E93', fontSize: 13 }}>
            {amount} / {target} subtasks
          </div>
        </>
      ) : isHabitToggle ? (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => onToggleHabit(goal.id)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: 'none',
              background: isDone ? goal.color : '#2C2C2E',
              color: isDone ? '#FFF' : '#F2F2F7',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isDone ? 'Done today' : 'Mark done'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ color: '#8E8E93', fontSize: 13 }}>
            {amount} / {target} {goal.unit}
            {goal.type === 'skill' ? ' today' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onDecrement(goal.id)} style={btnStyle('#2C2C2E', '#F2F2F7')}>
              −
            </button>
            <button onClick={() => onIncrement(goal.id)} style={btnStyle(goal.color, '#FFF')}>
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogCard({ goal, entries, onAddEntry, onDeleteEntry, onEdit, onDelete }) {
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAddEntry(goal.id, text);
    setText('');
  };

  return (
    <div
      style={{
        background: '#1C1C1E',
        borderRadius: 16,
        padding: 20,
        border: `1px solid ${goal.color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, color: '#F2F2F7', fontSize: 17, fontWeight: 600 }}>
            {goal.title}
          </h3>
          {goal.subtitle && (
            <p style={{ margin: '4px 0 0', color: '#8E8E93', fontSize: 13 }}>
              {goal.subtitle}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => onEdit(goal)} style={iconBtnStyle()} aria-label="Edit goal">
            <Pencil size={15} color="#636366" />
          </button>
          <button onClick={() => onDelete(goal)} style={iconBtnStyle()} aria-label="Delete goal">
            <Trash2 size={15} color="#636366" />
          </button>
        </div>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          style={inputStyle}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an entry…"
        />
        <button type="submit" style={smallIconBtnStyle} aria-label="Add entry">
          <Plus size={16} color="#F2F2F7" />
        </button>
      </form>

      {entries.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
              >
                <span style={{ color: '#F2F2F7', fontSize: 13, flex: 1 }}>{entry.text}</span>
                <span style={{ color: '#636366', fontSize: 11, flexShrink: 0 }}>{formatTime(entry.time)}</span>
                <button onClick={() => onDeleteEntry(goal.id, entry.id)} style={iconBtnStyle()} aria-label="Delete entry">
                  <X size={13} color="#636366" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function BacklogRow({ goal, onActivate, onEdit, onDelete }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1C1C1E',
        borderRadius: 12,
        padding: '12px 16px',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 600 }}>{goal.title}</div>
        {goal.subtitle && (
          <div style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }}>{goal.subtitle}</div>
        )}
        {goal.deadline && (
          <div style={{ color: '#8E8E93', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} /> Due {formatDeadline(goal.deadline)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => onActivate(goal)}
          style={{
            background: '#2C2C2E',
            border: 'none',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#F2F2F7',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Activate
        </button>
        <button onClick={() => onEdit(goal)} style={iconBtnStyle()} aria-label="Edit goal">
          <Pencil size={14} color="#636366" />
        </button>
        <button onClick={() => onDelete(goal)} style={iconBtnStyle()} aria-label="Delete goal">
          <Trash2 size={14} color="#636366" />
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: bg,
    color,
    fontSize: 18,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: '#2C2C2E', borderRadius: 8, padding: 4, gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: '8px 6px',
            borderRadius: 6,
            border: 'none',
            background: value === opt.value ? '#F2F2F7' : 'transparent',
            color: value === opt.value ? '#000' : '#8E8E93',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TabBar({ tab, onChange, counts }) {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'skills', label: 'Skills' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'history', label: 'History' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, background: '#1C1C1E', borderRadius: 12, padding: 4, marginBottom: 20 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '10px 4px',
            borderRadius: 8,
            border: 'none',
            background: tab === t.id ? '#2C2C2E' : 'transparent',
            color: tab === t.id ? '#F2F2F7' : '#8E8E93',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.label}
          {counts[t.id] != null ? ` (${counts[t.id]})` : ''}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return <p style={{ color: '#636366', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{text}</p>;
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#2C2C2E',
  border: 'none',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#F2F2F7',
  fontSize: 14,
};

const labelStyle = {
  display: 'block',
  color: '#8E8E93',
  fontSize: 12,
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const fieldWrap = { marginBottom: 16 };

const smallIconBtnStyle = {
  width: 40,
  height: 40,
  borderRadius: 8,
  border: 'none',
  background: '#2C2C2E',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

// `defaults` seeds a brand-new goal's type/status based on which tab
// it was opened from; `initialGoal` (when editing) always wins.
function GoalFormModal({ initialGoal, defaults, allGoals, existingIds, onSave, onCancel }) {
  const isEdit = Boolean(initialGoal);
  const seed = initialGoal || defaults || {};
  const [title, setTitle] = useState(seed.title || '');
  const [subtitle, setSubtitle] = useState(seed.subtitle || '');
  const [type, setType] = useState(seed.type || 'habit');
  const [status, setStatus] = useState(seed.status || 'active');
  const [color, setColor] = useState(seed.color || '#DC5F3C');
  const [unit, setUnit] = useState(seed.unit || '');
  const [target, setTarget] = useState(seed.dailyTarget != null ? String(seed.dailyTarget) : '');
  const [deadline, setDeadline] = useState(seed.deadline || '');
  const [subtasks, setSubtasks] = useState(seed.subtasks || []);
  const [newSubtask, setNewSubtask] = useState('');
  const [swapOutId, setSwapOutId] = useState('');

  const addSubtask = () => {
    const label = newSubtask.trim();
    if (!label) return;
    const id = makeUniqueId(slugify(label), subtasks.map((s) => s.id));
    setSubtasks([...subtasks, { id, label, done: false }]);
    setNewSubtask('');
  };
  const removeSubtask = (id) => setSubtasks(subtasks.filter((s) => s.id !== id));
  const editSubtaskLabel = (id, label) =>
    setSubtasks(subtasks.map((s) => (s.id === id ? { ...s, label } : s)));

  const targetNum = Number(target);
  const hasValidTarget = target !== '' && targetNum > 0;

  // The WIP limit only governs projects entering Active status.
  const otherActiveProjects = allGoals.filter(
    (g) => g.type === 'project' && g.status === 'active' && g.id !== initialGoal?.id
  );
  const needsSwap = type === 'project' && status === 'active' && otherActiveProjects.length >= WIP_LIMIT;

  const canSave =
    title.trim().length > 0 &&
    (type !== 'skill' || (hasValidTarget && unit.trim().length > 0)) &&
    (type !== 'project' || hasValidTarget || subtasks.length > 0) &&
    (!needsSwap || swapOutId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    const id = initialGoal?.id || makeUniqueId(slugify(title), existingIds);
    const goalData = { id, title: title.trim(), type, color };
    if (subtitle.trim()) goalData.subtitle = subtitle.trim();
    if (type === 'skill') {
      goalData.dailyTarget = targetNum;
      goalData.unit = unit.trim();
    } else if (type === 'project') {
      goalData.status = status;
      if (hasValidTarget) {
        goalData.dailyTarget = targetNum;
        goalData.unit = unit.trim() || 'units';
      }
      if (deadline) goalData.deadline = deadline;
      if (subtasks.length) goalData.subtasks = subtasks;
    }
    onSave(goalData, needsSwap ? swapOutId : null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1C1C1E',
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid #2C2C2E',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#F2F2F7', fontSize: 18, fontWeight: 700 }}>
            {isEdit ? 'Edit goal' : 'New goal'}
          </h2>
          <button onClick={onCancel} style={iconBtnStyle()} aria-label="Close">
            <X size={18} color="#8E8E93" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={fieldWrap}>
            <label style={labelStyle}>Type</label>
            <SegmentedControl
              value={type}
              onChange={setType}
              options={[
                { value: 'project', label: 'Project' },
                { value: 'skill', label: 'Skill' },
                { value: 'habit', label: 'Habit' },
                { value: 'log', label: 'Log' },
              ]}
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" autoFocus />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Subtitle (optional)</label>
            <input style={inputStyle} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Short context" />
          </div>

          {type === 'skill' && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Daily target</label>
                <input type="number" min="1" style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="8" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Unit</label>
                <input style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pages" />
              </div>
            </div>
          )}

          {type === 'project' && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Target (optional)</label>
                  <input type="number" min="1" style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 5" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Unit</label>
                  <input style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="units" />
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Deadline (optional)</label>
                <input type="date" style={inputStyle} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Subtasks (optional)</label>
                {subtasks.map((st) => (
                  <div key={st.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input style={inputStyle} value={st.label} onChange={(e) => editSubtaskLabel(st.id, e.target.value)} />
                    <button type="button" onClick={() => removeSubtask(st.id)} style={smallIconBtnStyle}>
                      <X size={16} color="#8E8E93" />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={inputStyle}
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add a subtask"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                  />
                  <button type="button" onClick={addSubtask} style={smallIconBtnStyle}>
                    <Plus size={16} color="#F2F2F7" />
                  </button>
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Status</label>
                <SegmentedControl
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'backlog', label: 'Backlog' },
                  ]}
                />
              </div>

              {needsSwap && (
                <div style={fieldWrap}>
                  <label style={{ ...labelStyle, color: '#DC5F3C' }}>
                    Active is full ({WIP_LIMIT}/{WIP_LIMIT}) — swap out
                  </label>
                  <select style={inputStyle} value={swapOutId} onChange={(e) => setSwapOutId(e.target.value)}>
                    <option value="">Choose a project to move to backlog…</option>
                    {otherActiveProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div style={fieldWrap}>
            <label style={labelStyle}>Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 48, height: 32, border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: '#2C2C2E', color: '#F2F2F7', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 8,
                border: 'none',
                background: canSave ? color : '#2C2C2E',
                color: canSave ? '#FFF' : '#636366',
                fontSize: 14,
                fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {isEdit ? 'Save changes' : 'Add goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NEW_GOAL_DEFAULTS_BY_TAB = {
  today: { type: 'project', status: 'active' },
  skills: { type: 'skill' },
  backlog: { type: 'project', status: 'backlog' },
};

export default function App() {
  // Goal definitions: loaded once from localStorage (or seeded from
  // DEFAULT_GOALS on first run), then persisted back on every change.
  const [goals, setGoals] = useState(() => {
    try {
      const saved = localStorage.getItem(GOALS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  });

  useEffect(() => {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  // History log: daily amounts per goal id, kept as its own object,
  // separate from the goal definitions above. For type 'log' goals,
  // the per-day value is an array of entries instead of a number.
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  // 'idle' | 'syncing' | 'synced' | 'offline'
  const [syncStatus, setSyncStatus] = useState('idle');
  // Guards the push effect below from firing (and clobbering the server)
  // before the initial pull/seed on login has resolved.
  const hasHydrated = useRef(false);

  // Pull on login: remote data (if any) replaces local state; if the user
  // has no record yet, current localStorage contents become the seed.
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    (async () => {
      setSyncStatus('syncing');
      try {
        const remote = await fetchRemoteData();
        if (cancelled) return;
        if (remote) {
          setGoals(remote.goals && remote.goals.length ? remote.goals : DEFAULT_GOALS);
          setHistory(remote.history || {});
        } else {
          await pushRemoteData(goals, history);
        }
        if (!cancelled) setSyncStatus('synced');
      } catch {
        if (!cancelled) setSyncStatus('offline');
      } finally {
        hasHydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Push on change, debounced so rapid +/- taps don't spam the network.
  useEffect(() => {
    if (!loggedIn || !hasHydrated.current) return;
    setSyncStatus('syncing');
    const timeout = setTimeout(async () => {
      try {
        await pushRemoteData(goals, history);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [goals, history, loggedIn]);

  const handleLogout = () => {
    logout();
    hasHydrated.current = false;
    setSyncStatus('idle');
    setLoggedIn(false);
  };

  const [activeTab, setActiveTab] = useState('today');
  // null = closed, 'new' = add form, otherwise the id of the goal being edited.
  const [formMode, setFormMode] = useState(null);

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }

  const today = todayKey();
  const todayEntry = history[today] || {};

  const projects = goals.filter((g) => g.type === 'project');
  const skills = goals.filter((g) => g.type === 'skill');
  const habits = goals.filter((g) => g.type === 'habit');
  const logs = goals.filter((g) => g.type === 'log');
  const activeProjects = projects.filter((g) => g.status === 'active');
  const backlogProjects = projects.filter((g) => g.status !== 'active');
  const todayItems = [...activeProjects, ...habits];
  const logHistory = buildLogHistory(goals, history);

  const editingGoal = formMode && formMode !== 'new' ? goals.find((g) => g.id === formMode) : null;

  const updateToday = (goalId, delta) => {
    setHistory((prev) => {
      const day = prev[today] || {};
      const newAmount = Math.max(0, (day[goalId] || 0) + delta);
      return {
        ...prev,
        [today]: { ...day, [goalId]: newAmount },
      };
    });
  };

  const increment = (goalId) => updateToday(goalId, 1);
  const decrement = (goalId) => updateToday(goalId, -1);

  const toggleHabit = (goalId) => {
    setHistory((prev) => {
      const day = prev[today] || {};
      const cur = day[goalId] || 0;
      return { ...prev, [today]: { ...day, [goalId]: cur > 0 ? 0 : 1 } };
    });
  };

  const toggleSubtask = (goalId, subtaskId) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id !== goalId
          ? g
          : {
              ...g,
              subtasks: g.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, done: !s.done } : s
              ),
            }
      )
    );
  };

  const addLogEntry = (goalId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const day = prev[today] || {};
      const entries = Array.isArray(day[goalId]) ? day[goalId] : [];
      const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: trimmed, time: new Date().toISOString() };
      return { ...prev, [today]: { ...day, [goalId]: [...entries, entry] } };
    });
  };

  const deleteLogEntry = (goalId, entryId) => {
    setHistory((prev) => {
      const day = prev[today] || {};
      const entries = Array.isArray(day[goalId]) ? day[goalId] : [];
      return { ...prev, [today]: { ...day, [goalId]: entries.filter((e) => e.id !== entryId) } };
    });
  };

  const saveGoal = (goalData, swapOutId) => {
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === goalData.id);
      let next = exists ? prev.map((g) => (g.id === goalData.id ? goalData : g)) : [...prev, goalData];
      if (swapOutId) {
        next = next.map((g) => (g.id === swapOutId ? { ...g, status: 'backlog' } : g));
      }
      return next;
    });
    setFormMode(null);
  };

  const deleteGoal = (goal) => {
    if (!window.confirm(`Delete "${goal.title}"? This can't be undone.`)) return;
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
  };

  // Direct one-click promote when there's room; otherwise hand off to
  // the edit form, where the WIP swap picker takes over.
  const activateProject = (goal) => {
    const otherActive = activeProjects.filter((g) => g.id !== goal.id);
    if (otherActive.length < WIP_LIMIT) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: 'active' } : g)));
    } else {
      setFormMode(goal.id);
    }
  };

  const allDone = todayItems.length > 0 && todayItems.every((g) => goalProgress(g, todayEntry).isDone);
  const streak = computeStreak(todayItems, history);

  const openNewGoal = () => setFormMode('new');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: '32px 16px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ color: '#8E8E93', fontSize: 14, margin: 0 }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#636366', fontSize: 12 }}>
              {syncStatus === 'syncing' && 'Syncing…'}
              {syncStatus === 'synced' && 'Synced'}
              {syncStatus === 'offline' && 'Offline'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#636366',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Log out
            </button>
          </div>
        </div>

        <TabBar
          tab={activeTab}
          onChange={setActiveTab}
          counts={{ skills: skills.length, backlog: backlogProjects.length }}
        />

        {activeTab === 'today' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h1 style={{ color: '#F2F2F7', fontSize: 28, margin: 0, fontWeight: 700 }}>
                {allDone ? 'Done for today' : "Today's targets"}
              </h1>
              <button onClick={openNewGoal} style={newGoalBtnStyle}>
                <Plus size={16} />
                New
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={pillStyle}>
                <Flame size={16} color="#DC5F3C" />
                <span style={pillTextStyle}>{streak} day streak</span>
              </div>
              <div style={pillStyle}>
                <span style={pillTextStyle}>
                  Active projects {activeProjects.length}/{WIP_LIMIT}
                </span>
              </div>
            </div>

            {todayItems.length === 0 && logs.length === 0 ? (
              <EmptyState text="No active projects, habits, or logs yet — add one to get started." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeProjects.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    dayEntry={todayEntry}
                    onIncrement={increment}
                    onDecrement={decrement}
                    onToggleSubtask={toggleSubtask}
                    onToggleHabit={toggleHabit}
                    onEdit={(g) => setFormMode(g.id)}
                    onDelete={deleteGoal}
                  />
                ))}
                {habits.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    dayEntry={todayEntry}
                    onIncrement={increment}
                    onDecrement={decrement}
                    onToggleSubtask={toggleSubtask}
                    onToggleHabit={toggleHabit}
                    onEdit={(g) => setFormMode(g.id)}
                    onDelete={deleteGoal}
                  />
                ))}
                {logs.map((goal) => (
                  <LogCard
                    key={goal.id}
                    goal={goal}
                    entries={Array.isArray(todayEntry[goal.id]) ? todayEntry[goal.id] : []}
                    onAddEntry={addLogEntry}
                    onDeleteEntry={deleteLogEntry}
                    onEdit={(g) => setFormMode(g.id)}
                    onDelete={deleteGoal}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'skills' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h1 style={{ color: '#F2F2F7', fontSize: 28, margin: 0, fontWeight: 700 }}>Skills</h1>
              <button onClick={openNewGoal} style={newGoalBtnStyle}>
                <Plus size={16} />
                New
              </button>
            </div>
            {skills.length === 0 ? (
              <EmptyState text="No skills yet — add one to start tracking a daily cadence." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {skills.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    dayEntry={todayEntry}
                    onIncrement={increment}
                    onDecrement={decrement}
                    onToggleSubtask={toggleSubtask}
                    onToggleHabit={toggleHabit}
                    onEdit={(g) => setFormMode(g.id)}
                    onDelete={deleteGoal}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'backlog' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h1 style={{ color: '#F2F2F7', fontSize: 28, margin: 0, fontWeight: 700 }}>Backlog</h1>
              <button onClick={openNewGoal} style={newGoalBtnStyle}>
                <Plus size={16} />
                New
              </button>
            </div>
            {backlogProjects.length === 0 ? (
              <EmptyState text="Nothing in the backlog." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {backlogProjects.map((goal) => (
                  <BacklogRow
                    key={goal.id}
                    goal={goal}
                    onActivate={activateProject}
                    onEdit={(g) => setFormMode(g.id)}
                    onDelete={deleteGoal}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            <h1 style={{ color: '#F2F2F7', fontSize: 28, margin: '0 0 16px', fontWeight: 700 }}>History</h1>
            {logHistory.length === 0 ? (
              <EmptyState text="No log entries yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {logHistory.map(({ date, entries }) => (
                  <div key={date}>
                    <h2 style={{ color: '#8E8E93', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, margin: '0 0 8px' }}>
                      {formatFullDate(date)}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: '#1C1C1E',
                            borderRadius: 10,
                            padding: '10px 14px',
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: entry.goalColor, flexShrink: 0 }} />
                          <span style={{ color: '#F2F2F7', fontSize: 13, flex: 1 }}>{entry.text}</span>
                          <span style={{ color: '#636366', fontSize: 11, flexShrink: 0 }}>
                            {entry.goalTitle} · {formatTime(entry.time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {formMode && (
        <GoalFormModal
          initialGoal={editingGoal}
          defaults={formMode === 'new' ? NEW_GOAL_DEFAULTS_BY_TAB[activeTab] : null}
          allGoals={goals}
          existingIds={goals.map((g) => g.id)}
          onSave={saveGoal}
          onCancel={() => setFormMode(null)}
        />
      )}
    </div>
  );
}

const newGoalBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: '#1C1C1E',
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  color: '#F2F2F7',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
};

const pillStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: '#1C1C1E',
  borderRadius: 12,
  padding: '10px 14px',
  width: 'fit-content',
};

const pillTextStyle = { color: '#F2F2F7', fontSize: 13, fontWeight: 500 };
