import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Archive, Flame } from 'lucide-react';

// ============================================================
// DATA: hardcoded for v1 on purpose. Editing goals in the UI is
// a v2 feature — adding it now would be scope creep before this
// even ships.
// ============================================================
const ACTIVE_GOALS = [
  {
    id: 'ansible',
    title: 'Ansible Training',
    subtitle: 'Red Hat course — hard deadline Sunday',
    unit: 'pages',
    dailyTarget: 8,
    color: '#DC5F3C',
  },
  {
    id: 'umgc',
    title: 'UMGC Cybersecurity',
    subtitle: 'Get 1 unit ahead before course starts',
    unit: 'units',
    dailyTarget: 1,
    color: '#2E6F6B',
  },
];

const BACKLOG = [
  'Raspberry Pi home assistant',
  'Raspberry Pi router build',
  'Learn sign language',
  'Zenoflow',
  'NGC',
  'Read more',
];

const STORAGE_KEY = 'goalTrackerHistory';

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function emptyDay() {
  const day = {};
  ACTIVE_GOALS.forEach((g) => (day[g.id] = 0));
  return day;
}

// Count consecutive days, walking backward from today, where every
// active goal hit its daily target. Stops at the first day that
// doesn't fully qualify (or has no entry at all).
function computeStreak(history) {
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toISOString().split('T')[0];
    const day = history[key];
    const allDone =
      day && ACTIVE_GOALS.every((g) => (day[g.id] || 0) >= g.dailyTarget);
    if (!allDone) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function GoalCard({ goal, progress, onIncrement, onDecrement }) {
  const isDone = progress >= goal.dailyTarget;
  const pct = Math.min(100, Math.round((progress / goal.dailyTarget) * 100));

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
          <p style={{ margin: '4px 0 0', color: '#8E8E93', fontSize: 13 }}>
            {goal.subtitle}
          </p>
        </div>
        {isDone ? (
          <CheckCircle2 size={24} color={goal.color} />
        ) : (
          <Circle size={24} color="#3A3A3C" />
        )}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <span style={{ color: '#8E8E93', fontSize: 13 }}>
          {progress} / {goal.dailyTarget} {goal.unit} today
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

export default function App() {
  // 1. LOAD: on first render, read the whole history object out of
  // localStorage. The lazy initializer function form of useState
  // (the () => ... below) means this read only happens once, not
  // on every re-render.
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      // Corrupt or missing data shouldn't crash the app — just start fresh.
      return {};
    }
  });

  // 2. SAVE: any time `history` changes, write the whole object back
  // out as a JSON string. This fires after every +/- click.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const [showBacklog, setShowBacklog] = useState(false);

  // 3. DERIVE today's progress from history, rather than keeping it
  // as separate state. This is what makes a page refresh safe —
  // there's nothing to lose, because "today" is just a lookup.
  const today = todayKey();
  const progress = history[today] || emptyDay();

  const updateToday = (goalId, delta) => {
    setHistory((prev) => {
      const day = prev[today] || emptyDay();
      const newAmount = Math.max(0, (day[goalId] || 0) + delta);
      return {
        ...prev,
        [today]: { ...day, [goalId]: newAmount },
      };
    });
  };

  const increment = (goalId) => updateToday(goalId, 1);
  const decrement = (goalId) => updateToday(goalId, -1);

  const allDone = ACTIVE_GOALS.every((g) => (progress[g.id] || 0) >= g.dailyTarget);
  const streak = computeStreak(history);

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
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#8E8E93', fontSize: 14, margin: 0 }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <h1 style={{ color: '#F2F2F7', fontSize: 28, margin: '4px 0 0', fontWeight: 700 }}>
            {allDone ? "Done for today" : "Today's targets"}
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#1C1C1E',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 20,
            width: 'fit-content',
          }}
        >
          <Flame size={16} color="#DC5F3C" />
          <span style={{ color: '#F2F2F7', fontSize: 13, fontWeight: 500 }}>
            {streak} day streak
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ACTIVE_GOALS.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={progress[goal.id] || 0}
              onIncrement={increment}
              onDecrement={decrement}
            />
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowBacklog(!showBacklog)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: '#8E8E93',
              fontSize: 13,
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            <Archive size={14} />
            Backlog ({BACKLOG.length}) — not active this week
          </button>
          {showBacklog && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#636366', fontSize: 13, lineHeight: 1.8 }}>
              {BACKLOG.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
