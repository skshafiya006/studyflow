import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utilities ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const SUBJECTS = ["Mathematics", "Physics", "Computer Science", "Chemistry", "English", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];
const QUOTES = [
  "Small steps every day add up to giant leaps.",
  "Focus on progress, not perfection.",
  "The secret of getting ahead is getting started.",
  "Study hard, dream big, achieve more.",
  "Every expert was once a beginner.",
];

const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Computer Science", "Chemistry", "English", "Other"];

const SUBJECT_COLORS = {
  Mathematics: "#6366F1",
  Physics: "#EC4899",
  "Computer Science": "#10B981",
  Chemistry: "#F59E0B",
  English: "#3B82F6",
  Other: "#8B5CF6",
};

function getSubjectColor(subject) {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  const palette = ["#06B6D4", "#F97316", "#84CC16", "#A855F7", "#14B8A6", "#EF4444"];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─── Persistent Store ─────────────────────────────────────────────────────────
const STORAGE_KEY = "spt_data_v2";
const defaultData = {
  profile: { name: "", course: "", semester: "", email: "" },
  tasks: [],
  timetable: [],
  sessions: [],
  notes: [],
  goals: { daily: 120, weekly: 600 },
  theme: "dark",
  streak: { count: 0, lastDate: "" },
  customSubjects: [],
};

function useStore() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed };
      }
    } catch (e) {}
    return defaultData;
  });

  const save = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  return [data, save];
}

// ─── Shared UI Components ────────────────────────────────────────────────────

const css = {
  card: (extra) => ({
    background: "var(--card)",
    borderRadius: 14,
    padding: "20px 22px",
    border: "1px solid var(--border)",
    ...extra,
  }),
};

function Badge({ color, children }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style }) {
  return <div style={css.card(style)}>{children}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          border: "1px solid var(--border)",
          maxHeight: "88vh",
          overflowY: "auto",
          position: "relative",
          zIndex: 10000,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            marginBottom: 5,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function Input({ label, ...props }) {
  return (
    <Field label={label}>
      <input {...props} style={{ ...inputStyle, ...props.style }} />
    </Field>
  );
}

function Textarea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea
        {...props}
        style={{
          ...inputStyle,
          resize: "vertical",
          minHeight: 90,
          fontFamily: "inherit",
          ...props.style,
        }}
      />
    </Field>
  );
}

function Select({ label, options, ...props }) {
  return (
    <Field label={label}>
      <select {...props} style={{ ...inputStyle, cursor: "pointer" }}>
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
      </select>
    </Field>
  );
}

// SubjectSelect: shows dropdown of all subjects; when "Other" is chosen reveals a
// text input so the user can type a custom subject name.
function SubjectSelect({ label, value, onChange, customSubjects = [] }) {
  const builtIn = DEFAULT_SUBJECTS.filter((s) => s !== "Other");
  const allOptions = [...builtIn, ...customSubjects, "Other"];
  const isCustom = value && !DEFAULT_SUBJECTS.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customVal, setCustomVal] = useState(isCustom ? value : "");

  const handleSelectChange = (e) => {
    if (e.target.value === "Other") {
      setShowCustom(true);
      // Keep existing value until user types something
    } else {
      setShowCustom(false);
      setCustomVal("");
      onChange(e.target.value);
    }
  };

  const handleCustomInput = (e) => {
    const v = e.target.value;
    setCustomVal(v);
    if (v.trim()) onChange(v.trim());
  };

  return (
    <Field label={label}>
      <select
        value={showCustom ? "Other" : value}
        onChange={handleSelectChange}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        {allOptions.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {showCustom && (
        <div style={{ marginTop: 8 }}>
          <input
            autoFocus
            value={customVal}
            onChange={handleCustomInput}
            placeholder="Type your subject name (e.g. Economics)…"
            style={{
              ...inputStyle,
              borderColor: customVal.trim() ? "#6366F1" : "#F59E0B",
              boxShadow: customVal.trim() ? "0 0 0 2px #6366F122" : "0 0 0 2px #F59E0B22",
            }}
          />
          {!customVal.trim() && (
            <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 4 }}>
              Please type a subject name to continue.
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

function Btn({ children, variant = "primary", ...props }) {
  const variants = {
    primary: { background: "#6366F1", color: "#fff", border: "none" },
    ghost: {
      background: "transparent",
      color: "var(--muted)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "#EF444418",
      color: "#EF4444",
      border: "1px solid #EF444440",
    },
    success: { background: "#10B98118", color: "#10B981", border: "1px solid #10B98140" },
  };
  return (
    <button
      {...props}
      style={{
        padding: "9px 18px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "opacity 0.15s",
        fontFamily: "inherit",
        ...variants[variant],
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      {onEdit && (
        <button
          onClick={onEdit}
          title="Edit"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: 15,
            padding: "2px 5px",
            borderRadius: 6,
          }}
        >
          ✏️
        </button>
      )}
      <button
        onClick={onDelete}
        title="Delete"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#EF4444",
          fontSize: 15,
          padding: "2px 5px",
          borderRadius: 6,
        }}
      >
        🗑️
      </button>
    </div>
  );
}

// ─── TASK FORM (reused in Dashboard + Tasks page) ─────────────────────────────
function TaskForm({ initial, onSave, onCancel, customSubjects = [], onAddCustomSubject }) {
  const [form, setForm] = useState(
    initial || {
      title: "",
      subject: "Computer Science",
      priority: "Medium",
      date: todayStr(),
      notes: "",
    }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubjectChange = (subject) => {
    set("subject", subject);
    // Persist custom subject if it's new
    if (
      subject &&
      !DEFAULT_SUBJECTS.includes(subject) &&
      !customSubjects.includes(subject) &&
      onAddCustomSubject
    ) {
      onAddCustomSubject(subject);
    }
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (!form.subject || form.subject === "Other") return; // must resolve custom
    onSave(form);
  };

  return (
    <div>
      <Input
        label="Task Title *"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="What needs to be done?"
        autoFocus
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SubjectSelect
          label="Subject"
          value={form.subject}
          onChange={handleSubjectChange}
          customSubjects={customSubjects}
        />
        <Select
          label="Priority"
          options={PRIORITIES}
          value={form.priority}
          onChange={(e) => set("priority", e.target.value)}
        />
      </div>
      <Input
        label="Due Date"
        type="date"
        value={form.date}
        onChange={(e) => set("date", e.target.value)}
      />
      <Textarea
        label="Notes (optional)"
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Any extra details..."
        style={{ minHeight: 70 }}
      />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
        {onCancel && (
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        )}
        <Btn onClick={handleSave}>{initial ? "Save Changes" : "Add Task"}</Btn>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data, save, setPage }) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [logSubject, setLogSubject] = useState("Computer Science");
  const [logMins, setLogMins] = useState(30);
  const [showLogStudy, setShowLogStudy] = useState(false);

  const todayTasks = data.tasks.filter((t) => t.date === todayStr());
  const done = todayTasks.filter((t) => t.done).length;
  const total = todayTasks.length;

  const todaySessions = data.sessions.filter((s) => s.date === todayStr());
  const todayMins = todaySessions.reduce((a, s) => a + s.duration, 0);

  const weekSessions = data.sessions.filter((s) => {
    const diff = (Date.now() - new Date(s.date).getTime()) / 86400000;
    return diff <= 7;
  });
  const weekMins = weekSessions.reduce((a, s) => a + s.duration, 0);

  const pendingHigh = data.tasks.filter((t) => !t.done && t.priority === "High").length;
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  const subjectMins = {};
  data.sessions.forEach((s) => {
    subjectMins[s.subject] = (subjectMins[s.subject] || 0) + s.duration;
  });
  const maxSubjectMins = Math.max(...Object.values(subjectMins), 1);

  const addTask = (form) => {
    save((d) => ({
      ...d,
      tasks: [...d.tasks, { id: uid(), done: false, ...form }],
    }));
    setShowAddTask(false);
  };

  const addCustomSubject = (subject) => {
    save((d) => ({
      ...d,
      customSubjects: d.customSubjects.includes(subject)
        ? d.customSubjects
        : [...d.customSubjects, subject],
    }));
  };

  const toggleTask = (id) => {
    save((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  };

  const logStudy = () => {
    const today = todayStr();
    save((d) => {
      const newStreak = (() => {
        if (d.streak.lastDate === today) return d.streak;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split("T")[0];
        return {
          count: d.streak.lastDate === yStr ? d.streak.count + 1 : 1,
          lastDate: today,
        };
      })();
      return {
        ...d,
        sessions: [...d.sessions, { id: uid(), subject: logSubject, duration: logMins, date: today }],
        streak: newStreak,
      };
    });
    setShowLogStudy(false);
  };

  return (
    <div>
      {/* Quote banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 20,
          position: "relative",
          overflow: "hidden",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, opacity: 0.7, marginBottom: 6 }}>
          TODAY'S MOTIVATION
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, maxWidth: "80%" }}>
          "{quote}"
        </div>
        {data.streak.count > 0 && (
          <div
            style={{
              position: "absolute",
              right: 24,
              top: "50%",
              transform: "translateY(-50%)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32 }}>🔥</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{data.streak.count}d streak</div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Tasks Today",
            value: `${done}/${total}`,
            sub: total === 0 ? "No tasks yet" : done === total && total > 0 ? "All done! 🎉" : `${total - done} remaining`,
            color: "#6366F1",
          },
          {
            label: "Studied Today",
            value: `${Math.floor(todayMins / 60)}h ${todayMins % 60}m`,
            sub: `Goal: ${Math.floor(data.goals.daily / 60)}h`,
            color: "#10B981",
          },
          {
            label: "This Week",
            value: `${Math.floor(weekMins / 60)}h`,
            sub: `Goal: ${Math.floor(data.goals.weekly / 60)}h`,
            color: "#F59E0B",
          },
          {
            label: "High Priority",
            value: pendingHigh,
            sub: "tasks pending",
            color: "#EF4444",
          },
        ].map((s) => (
          <Card key={s.label} style={{ borderTop: `3px solid ${s.color}` }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Today's tasks */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>Today's Tasks</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge color="#6366F1">{total}</Badge>
              <Btn
                onClick={() => setShowAddTask(true)}
                style={{ padding: "5px 12px", fontSize: 12 }}
              >
                + Add
              </Btn>
            </div>
          </div>

          {showAddTask && (
            <div
              style={{
                background: "var(--bg)",
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
                border: "1px solid var(--border)",
              }}
            >
              <TaskForm
                onSave={addTask}
                onCancel={() => setShowAddTask(false)}
                customSubjects={data.customSubjects || []}
                onAddCustomSubject={addCustomSubject}
              />
            </div>
          )}

          {todayTasks.length === 0 && !showAddTask ? (
            <div
              style={{
                color: "var(--muted)",
                fontSize: 13,
                textAlign: "center",
                padding: "24px 0",
              }}
            >
              No tasks for today.
              <br />
              <span
                onClick={() => setShowAddTask(true)}
                style={{ color: "#6366F1", cursor: "pointer", fontWeight: 600 }}
              >
                Add your first task →
              </span>
            </div>
          ) : (
            <>
              {todayTasks.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                    style={{ accentColor: "#6366F1", width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      textDecoration: t.done ? "line-through" : "none",
                      opacity: t.done ? 0.5 : 1,
                    }}
                  >
                    {t.title}
                  </span>
                  <Badge color={getSubjectColor(t.subject)}>
                    {t.subject.split(" ")[0]}
                  </Badge>
                  {!t.done && (
                    <button
                      onClick={() => toggleTask(t.id)}
                      title="Mark as done"
                      style={{
                        background: "#10B98118",
                        border: "1px solid #10B98140",
                        color: "#10B981",
                        borderRadius: 6,
                        padding: "2px 9px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      ✓ Done
                    </button>
                  )}
                </div>
              ))}
              {todayTasks.length > 6 && (
                <div
                  onClick={() => setPage("tasks")}
                  style={{
                    fontSize: 12,
                    color: "#6366F1",
                    cursor: "pointer",
                    marginTop: 8,
                    fontWeight: 600,
                  }}
                >
                  +{todayTasks.length - 6} more tasks →
                </div>
              )}
            </>
          )}
        </Card>

        {/* Study breakdown */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>Study Breakdown</div>
            <Btn
              onClick={() => setShowLogStudy(true)}
              variant="success"
              style={{ padding: "5px 12px", fontSize: 12 }}
            >
              + Log Study
            </Btn>
          </div>

          {showLogStudy && (
            <div
              style={{
                background: "var(--bg)",
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
                border: "1px solid var(--border)",
              }}
            >
              <Select
                label="Subject"
                options={SUBJECTS}
                value={logSubject}
                onChange={(e) => setLogSubject(e.target.value)}
              />
              <Field label={`Duration — ${logMins} minutes`}>
                <input
                  type="range"
                  min={5}
                  max={240}
                  step={5}
                  value={logMins}
                  onChange={(e) => setLogMins(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#10B981" }}
                />
              </Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={() => setShowLogStudy(false)} style={{ padding: "7px 14px" }}>
                  Cancel
                </Btn>
                <Btn variant="success" onClick={logStudy} style={{ padding: "7px 14px" }}>
                  Save Session
                </Btn>
              </div>
            </div>
          )}

          {Object.keys(subjectMins).length === 0 && !showLogStudy ? (
            <div
              style={{
                color: "var(--muted)",
                fontSize: 13,
                textAlign: "center",
                padding: "24px 0",
              }}
            >
              No study sessions yet.
              <br />
              <span
                onClick={() => setShowLogStudy(true)}
                style={{ color: "#10B981", cursor: "pointer", fontWeight: 600 }}
              >
                Log your first session →
              </span>
            </div>
          ) : (
            Object.entries(subjectMins)
              .sort((a, b) => b[1] - a[1])
              .map(([subj, mins]) => {
                const pct = Math.round((mins / maxSubjectMins) * 100);
                return (
                  <div key={subj} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{subj}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {Math.floor(mins / 60)}h {mins % 60}m
                      </span>
                    </div>
                    <div
                      style={{ background: "var(--border)", borderRadius: 4, height: 7 }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: SUBJECT_COLORS[subj] || "#6366F1",
                          borderRadius: 4,
                          transition: "width 0.4s",
                        }}
                      />
                    </div>
                  </div>
                );
              })
          )}
        </Card>
      </div>

      {/* Add task modal (from other nav paths) */}
    </div>
  );
}

// ─── TASKS PAGE ───────────────────────────────────────────────────────────────
function Tasks({ data, save }) {
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filter, setFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("All");

  const customSubjects = data.customSubjects || [];
  const allSubjectOptions = [
    ...DEFAULT_SUBJECTS.filter((s) => s !== "Other"),
    ...customSubjects,
    "Other",
  ];

  const pending = data.tasks.filter((t) => !t.done);
  const done = data.tasks.filter((t) => t.done);

  const applyFilters = (list) =>
    list
      .filter((t) => {
        if (filter === "today") return t.date === todayStr();
        return true;
      })
      .filter((t) => subjectFilter === "All" || t.subject === subjectFilter)
      .sort((a, b) => {
        const p = { High: 0, Medium: 1, Low: 2 };
        return p[a.priority] - p[b.priority] || a.date.localeCompare(b.date);
      });

  const filteredPending = filter === "done" ? [] : applyFilters(pending);
  const filteredDone = filter === "pending" ? [] : applyFilters(done);

  const addCustomSubject = (subject) => {
    save((d) => ({
      ...d,
      customSubjects: (d.customSubjects || []).includes(subject)
        ? d.customSubjects
        : [...(d.customSubjects || []), subject],
    }));
  };

  const addOrEdit = (form) => {
    if (editTask) {
      save((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === editTask.id ? { ...t, ...form } : t)),
      }));
    } else {
      save((d) => ({
        ...d,
        tasks: [...d.tasks, { id: uid(), done: false, ...form }],
      }));
    }
    setShowModal(false);
    setEditTask(null);
  };

  const deleteTask = (id) => {
    save((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  };

  const markDone = (id) => {
    save((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)),
    }));
  };

  const markUndone = (id) => {
    save((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: false } : t)),
    }));
  };

  const openEdit = (t) => {
    setEditTask(t);
    setShowModal(true);
  };

  const TaskCard = ({ t, isDone }) => (
    <Card
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        opacity: isDone ? 0.7 : 1,
        transition: "opacity 0.2s",
        borderLeft: isDone ? "3px solid #10B981" : `3px solid ${getSubjectColor(t.subject)}`,
      }}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => (isDone ? markUndone(t.id) : markDone(t.id))}
        style={{
          accentColor: "#6366F1",
          width: 18,
          height: 18,
          marginTop: 3,
          flexShrink: 0,
          cursor: "pointer",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            textDecoration: isDone ? "line-through" : "none",
            color: isDone ? "var(--muted)" : "var(--text)",
          }}
        >
          {t.title}
        </div>
        {t.notes && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            {t.notes}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Badge color={getSubjectColor(t.subject)}>{t.subject}</Badge>
          <Badge
            color={
              t.priority === "High" ? "#EF4444" : t.priority === "Medium" ? "#F59E0B" : "#10B981"
            }
          >
            {t.priority}
          </Badge>
          <Badge color="#8B5CF6">📅 {t.date}</Badge>
          {isDone && <Badge color="#10B981">✓ Completed</Badge>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {!isDone && (
          <button
            onClick={() => markDone(t.id)}
            title="Mark as done"
            style={{
              background: "#10B98118",
              border: "1px solid #10B98140",
              color: "#10B981",
              borderRadius: 7,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            ✓ Done
          </button>
        )}
        {isDone && (
          <button
            onClick={() => markUndone(t.id)}
            title="Mark as pending"
            style={{
              background: "#6366F118",
              border: "1px solid #6366F140",
              color: "#6366F1",
              borderRadius: 7,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            ↩ Undo
          </button>
        )}
        <RowActions onEdit={() => openEdit(t)} onDelete={() => deleteTask(t.id)} />
      </div>
    </Card>
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tasks</h2>
        <Btn onClick={() => { setEditTask(null); setShowModal(true); }}>+ Add Task</Btn>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { id: "all", label: "All" },
          { id: "today", label: "Due Today" },
          { id: "pending", label: `Pending (${pending.length})` },
          { id: "done", label: `Done (${done.length})` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: filter === f.id ? "#6366F1" : "var(--card)",
              color: filter === f.id ? "#fff" : "var(--muted)",
              border: `1px solid ${filter === f.id ? "#6366F1" : "var(--border)"}`,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, width: "auto" }}
          >
            <option value="All">All Subjects</option>
            {allSubjectOptions.filter((s) => s !== "Other").map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pending section */}
      {filter !== "done" && (
        <div style={{ marginBottom: 24 }}>
          {filter === "all" && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>
              Pending — {filteredPending.length}
            </div>
          )}
          {filteredPending.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              {filter === "today" ? "No tasks due today!" : "No pending tasks."}{" "}
              <span onClick={() => setShowModal(true)} style={{ color: "#6366F1", cursor: "pointer", fontWeight: 600 }}>
                Add one!
              </span>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredPending.map((t) => <TaskCard key={t.id} t={t} isDone={false} />)}
            </div>
          )}
        </div>
      )}

      {/* Done section */}
      {filter !== "pending" && filter !== "today" && filteredDone.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>
            Completed — {filteredDone.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredDone.map((t) => <TaskCard key={t.id} t={t} isDone={true} />)}
          </div>
        </div>
      )}
      {filter === "done" && filteredDone.length === 0 && (
        <Card style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          No completed tasks yet. Mark tasks as done to see them here!
        </Card>
      )}

      {showModal && (
        <Modal
          title={editTask ? "Edit Task" : "New Task"}
          onClose={() => { setShowModal(false); setEditTask(null); }}
        >
          <TaskForm
            initial={
              editTask
                ? { title: editTask.title, subject: editTask.subject, priority: editTask.priority, date: editTask.date, notes: editTask.notes || "" }
                : null
            }
            onSave={addOrEdit}
            onCancel={() => { setShowModal(false); setEditTask(null); }}
            customSubjects={customSubjects}
            onAddCustomSubject={addCustomSubject}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── STUDY TRACKER / POMODORO ─────────────────────────────────────────────────
function StudyTracker({ data, save }) {
  const MODES = { pomodoro: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const [mode, setMode] = useState("pomodoro");
  const [timeLeft, setTimeLeft] = useState(MODES.pomodoro);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState("Computer Science");
  const allSubjects = [...DEFAULT_SUBJECTS.filter((s) => s !== "Other"), ...(data.customSubjects || [])];
  const intervalRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    setTimeLeft(MODES[mode]);
    setRunning(false);
  }, [mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            const mins = Math.round(MODES[modeRef.current] / 60);
            const today = todayStr();
            save((d) => {
              const newStreak = (() => {
                if (d.streak.lastDate === today) return d.streak;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yStr = yesterday.toISOString().split("T")[0];
                return {
                  count: d.streak.lastDate === yStr ? d.streak.count + 1 : 1,
                  lastDate: today,
                };
              })();
              return {
                ...d,
                sessions: [
                  ...d.sessions,
                  { id: uid(), subject: subject, duration: mins, date: today },
                ],
                streak: newStreak,
              };
            });
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const total = MODES[mode];
  const pct = (total - timeLeft) / total;
  const r = 90;
  const circ = 2 * Math.PI * r;

  const todaySessions = data.sessions.filter((s) => s.date === todayStr());
  const todayMins = todaySessions.reduce((a, s) => a + s.duration, 0);
  const goalPct = Math.min(100, (todayMins / data.goals.daily) * 100);

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Study Timer</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Timer */}
        <Card style={{ textAlign: "center" }}>
          {/* Mode tabs */}
          <div
            style={{
              display: "flex",
              gap: 6,
              justifyContent: "center",
              marginBottom: 24,
              background: "var(--bg)",
              padding: 4,
              borderRadius: 10,
            }}
          >
            {[
              ["pomodoro", "🍅 Focus 25"],
              ["short", "☕ Short 5"],
              ["long", "🧘 Long 15"],
            ].map(([m, l]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: "7px 6px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: mode === m ? "#6366F1" : "transparent",
                  color: mode === m ? "#fff" : "var(--muted)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* SVG ring */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            <svg
              width={220}
              height={220}
              style={{ transform: "rotate(-90deg)", display: "block" }}
            >
              <circle
                cx={110}
                cy={110}
                r={r}
                fill="none"
                stroke="var(--border)"
                strokeWidth={12}
              />
              <circle
                cx={110}
                cy={110}
                r={r}
                fill="none"
                stroke={running ? "#6366F1" : "#8B5CF6"}
                strokeWidth={12}
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  letterSpacing: -2,
                  color: running ? "#6366F1" : "var(--text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtTime(timeLeft)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  fontWeight: 700,
                  letterSpacing: 1,
                  marginTop: 4,
                }}
              >
                {mode === "pomodoro" ? "FOCUS" : "BREAK"}
              </div>
            </div>
          </div>

          <Select
            label="Studying"
            options={SUBJECTS}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ maxWidth: 220, margin: "0 auto 18px" }}
          />

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Btn
              onClick={() => setRunning((r) => !r)}
              style={{ minWidth: 110, padding: "11px 20px", fontSize: 15 }}
            >
              {running ? "⏸ Pause" : timeLeft < MODES[mode] ? "▶ Resume" : "▶ Start"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                setTimeLeft(MODES[mode]);
                setRunning(false);
              }}
              style={{ padding: "11px 16px" }}
            >
              ↺
            </Btn>
          </div>
        </Card>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Daily goal */}
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Today's Progress</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              <span>Daily goal</span>
              <span style={{ color: "var(--muted)" }}>
                {todayMins} / {data.goals.daily} min
              </span>
            </div>
            <div
              style={{ background: "var(--border)", borderRadius: 6, height: 10, marginBottom: 14 }}
            >
              <div
                style={{
                  width: `${goalPct}%`,
                  height: "100%",
                  background: "#10B981",
                  borderRadius: 6,
                  transition: "width 0.4s",
                }}
              />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#10B981" }}>
              {Math.floor(todayMins / 60)}h {todayMins % 60}m
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              across {todaySessions.length} session{todaySessions.length !== 1 ? "s" : ""} today
            </div>
          </Card>

          {/* Session log */}
          <Card style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Recent Sessions</div>
            {data.sessions.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                No sessions yet. Hit Start!
              </div>
            ) : (
              [...data.sessions]
                .reverse()
                .slice(0, 6)
                .map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.subject}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.date}</div>
                    </div>
                    <Badge color={SUBJECT_COLORS[s.subject] || "#6366F1"}>{s.duration}m</Badge>
                  </div>
                ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── TIMETABLE ────────────────────────────────────────────────────────────────
function Timetable({ data, save }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    day: "Mon",
    hour: 9,
    subject: "Computer Science",
    title: "",
  });

  const submit = () => {
    if (!form.title.trim()) return;
    save((d) => ({
      ...d,
      timetable: [
        ...d.timetable,
        {
          id: uid(),
          ...form,
          hour: Number(form.hour),
          color: SUBJECT_COLORS[form.subject] || "#6366F1",
        },
      ],
    }));
    setShowModal(false);
    setForm({ day: "Mon", hour: 9, subject: "Computer Science", title: "" });
  };

  const getSlots = (day, hour) =>
    data.timetable.filter((e) => e.day === day && Number(e.hour) === hour);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Weekly Timetable</h2>
        <Btn onClick={() => setShowModal(true)}>+ Add Class</Btn>
      </div>

      <Card style={{ overflowX: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontWeight: 700,
                  borderBottom: "1px solid var(--border)",
                  minWidth: 54,
                }}
              >
                TIME
              </th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  style={{
                    padding: "10px 8px",
                    textAlign: "center",
                    color: "var(--text)",
                    fontWeight: 700,
                    borderBottom: "1px solid var(--border)",
                    minWidth: 90,
                  }}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h} style={{ borderBottom: "1px solid var(--border)" }}>
                <td
                  style={{
                    padding: "6px 14px",
                    color: "var(--muted)",
                    fontWeight: 600,
                    fontSize: 11,
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
                </td>
                {DAYS.map((d) => {
                  const slots = getSlots(d, h);
                  return (
                    <td key={d} style={{ padding: 3, verticalAlign: "top" }}>
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          title="Click to remove"
                          onClick={() =>
                            save((d2) => ({
                              ...d2,
                              timetable: d2.timetable.filter((x) => x.id !== s.id),
                            }))
                          }
                          style={{
                            background: s.color + "20",
                            border: `1px solid ${s.color}50`,
                            borderLeft: `3px solid ${s.color}`,
                            borderRadius: 6,
                            padding: "4px 7px",
                            cursor: "pointer",
                            marginBottom: 2,
                          }}
                        >
                          <div
                            style={{ fontWeight: 700, color: s.color, fontSize: 11 }}
                          >
                            {s.title}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 10 }}>
                            {s.subject.split(" ")[0]}
                          </div>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        Click on a class block to remove it.
      </div>

      {showModal && (
        <Modal title="Add Class" onClose={() => setShowModal(false)}>
          <Input
            label="Class Name *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Data Structures Lecture"
            autoFocus
          />
          <Select
            label="Subject"
            options={SUBJECTS}
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select
              label="Day"
              options={DAYS}
              value={form.day}
              onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
            />
            <Select
              label="Time"
              options={HOURS.map((h) => ({
                value: h,
                label: h > 12 ? `${h - 12}:00 PM` : h === 12 ? "12:00 PM" : `${h}:00 AM`,
              }))}
              value={form.hour}
              onChange={(e) => setForm((f) => ({ ...f, hour: Number(e.target.value) }))}
            />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Btn>
            <Btn onClick={submit}>Add Class</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function Analytics({ data }) {
  const subjectMins = {};
  data.sessions.forEach((s) => {
    subjectMins[s.subject] = (subjectMins[s.subject] || 0) + s.duration;
  });
  const totalMins = Object.values(subjectMins).reduce((a, b) => a + b, 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const str = d.toISOString().split("T")[0];
    const mins = data.sessions
      .filter((s) => s.date === str)
      .reduce((a, s) => a + s.duration, 0);
    return {
      date: str,
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],
      mins,
    };
  });
  const maxDayMins = Math.max(...last7.map((d) => d.mins), 1);

  const completedTasks = data.tasks.filter((t) => t.done).length;
  const totalTasks = data.tasks.length;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Analytics</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Total Study Time",
            value: `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`,
            color: "#6366F1",
          },
          { label: "Task Completion", value: `${completionRate}%`, color: "#10B981" },
          {
            label: "Study Streak",
            value: `${data.streak.count} days 🔥`,
            color: "#F59E0B",
          },
        ].map((s) => (
          <Card key={s.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Bar chart */}
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 18 }}>Study Time — Last 7 Days</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
            {last7.map((d) => (
              <div
                key={d.date}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                {d.mins > 0 && (
                  <div style={{ fontSize: 9, color: "var(--muted)" }}>{d.mins}m</div>
                )}
                <div
                  style={{
                    width: "100%",
                    background:
                      d.date === todayStr() ? "#6366F1" : "#6366F133",
                    borderRadius: "4px 4px 0 0",
                    height: `${Math.max(3, Math.round((d.mins / maxDayMins) * 90))}px`,
                    minHeight: d.mins > 0 ? 4 : 0,
                    transition: "height 0.4s",
                  }}
                />
                <div
                  style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}
                >
                  {d.label}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Subject breakdown */}
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 18 }}>Subject Distribution</div>
          {Object.keys(subjectMins).length === 0 ? (
            <div
              style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 24 }}
            >
              No study data yet!
            </div>
          ) : (
            Object.entries(subjectMins)
              .sort((a, b) => b[1] - a[1])
              .map(([subj, mins]) => {
                const pct = totalMins ? Math.round((mins / totalMins) * 100) : 0;
                return (
                  <div key={subj} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{subj}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {pct}% · {Math.floor(mins / 60)}h {mins % 60}m
                      </span>
                    </div>
                    <div
                      style={{ background: "var(--border)", borderRadius: 4, height: 7 }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: SUBJECT_COLORS[subj] || "#6366F1",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                );
              })
          )}
        </Card>

        {/* Tasks by subject */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Tasks by Subject</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {SUBJECTS.map((subj) => {
              const subTasks = data.tasks.filter((t) => t.subject === subj);
              const done = subTasks.filter((t) => t.done).length;
              if (subTasks.length === 0) return null;
              const color = SUBJECT_COLORS[subj];
              return (
                <div
                  key={subj}
                  style={{
                    background: "var(--bg)",
                    borderRadius: 10,
                    padding: 14,
                    border: `1px solid ${color}33`,
                  }}
                >
                  <div
                    style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}
                  >
                    {subj}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {done}/{subTasks.length}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>tasks done</div>
                  <div
                    style={{
                      background: "var(--border)",
                      borderRadius: 3,
                      height: 4,
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        width: `${subTasks.length ? (done / subTasks.length) * 100 : 0}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {SUBJECTS.every((s) => data.tasks.filter((t) => t.subject === s).length === 0) && (
              <div style={{ color: "var(--muted)", fontSize: 13, gridColumn: "1/-1" }}>
                Add tasks to see subject breakdowns here.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── NOTES ────────────────────────────────────────────────────────────────────
function Notes({ data, save }) {
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    subject: "Computer Science",
    tags: "",
  });
  const [search, setSearch] = useState("");

  const filtered = data.notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.subject.toLowerCase().includes(search.toLowerCase()) ||
      (n.content || "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (n) => {
    setForm({
      title: n.title,
      content: n.content,
      subject: n.subject,
      tags: (n.tags || []).join(", "),
    });
    setEditNote(n);
    setShowModal(true);
  };

  const submit = () => {
    if (!form.title.trim()) return;
    const note = {
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      date: todayStr(),
    };
    if (editNote) {
      save((d) => ({
        ...d,
        notes: d.notes.map((n) => (n.id === editNote.id ? { ...n, ...note } : n)),
      }));
    } else {
      save((d) => ({ ...d, notes: [...d.notes, { id: uid(), ...note }] }));
    }
    setForm({ title: "", content: "", subject: "Computer Science", tags: "" });
    setEditNote(null);
    setShowModal(false);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Notes</h2>
        <Btn
          onClick={() => {
            setEditNote(null);
            setForm({ title: "", content: "", subject: "Computer Science", tags: "" });
            setShowModal(true);
          }}
        >
          + New Note
        </Btn>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍  Search notes by title, subject or content..."
        style={{
          ...inputStyle,
          marginBottom: 18,
          borderRadius: 10,
          padding: "10px 14px",
        }}
      />

      {filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          {search ? "No notes match your search." : "No notes yet. Create your first one!"}
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((n) => (
            <Card
              key={n.id}
              style={{
                borderTop: `3px solid ${SUBJECT_COLORS[n.subject] || "#6366F1"}`,
                cursor: "pointer",
                position: "relative",
              }}
              onClick={() => openEdit(n)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, flex: 1, paddingRight: 8 }}>
                  {n.title}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    save((d) => ({
                      ...d,
                      notes: d.notes.filter((x) => x.id !== n.id),
                    }));
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#EF4444",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  🗑️
                </button>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                {(n.content || "").slice(0, 100)}
                {(n.content || "").length > 100 ? "…" : ""}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge color={SUBJECT_COLORS[n.subject] || "#6366F1"}>{n.subject}</Badge>
                {(n.tags || []).map((tag) => (
                  <Badge key={tag} color="#8B5CF6">
                    #{tag}
                  </Badge>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>{n.date}</div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editNote ? "Edit Note" : "New Note"}
          onClose={() => {
            setShowModal(false);
            setEditNote(null);
          }}
        >
          <Input
            label="Title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Note title"
            autoFocus
          />
          <Select
            label="Subject"
            options={SUBJECTS}
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
          <Textarea
            label="Content"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Write your notes here..."
            style={{ minHeight: 130 }}
          />
          <Input
            label="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="exam, important, chapter-3"
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn
              variant="ghost"
              onClick={() => {
                setShowModal(false);
                setEditNote(null);
              }}
            >
              Cancel
            </Btn>
            <Btn onClick={submit}>{editNote ? "Save Changes" : "Add Note"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ data, save }) {
  const [profile, setProfile] = useState({ ...data.profile });
  const [goals, setGoals] = useState({ ...data.goals });
  const [saved, setSaved] = useState(false);

  const saveAll = () => {
    save((d) => ({ ...d, profile, goals }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studyflow-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (window.confirm("This will delete ALL your data permanently. Are you sure?")) {
      save(() => defaultData);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Settings</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Profile */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>👤 Profile</div>
          <Input
            label="Full Name"
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your name"
          />
          <Input
            label="Course / Branch"
            value={profile.course}
            onChange={(e) => setProfile((p) => ({ ...p, course: e.target.value }))}
            placeholder="B.Tech Computer Science"
          />
          <Input
            label="Semester"
            value={profile.semester}
            onChange={(e) => setProfile((p) => ({ ...p, semester: e.target.value }))}
            placeholder="5th Semester"
          />
          <Input
            label="Email"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            placeholder="you@college.edu"
          />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Goals */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🎯 Study Goals</div>
            <Field label={`Daily Goal — ${Math.floor(goals.daily / 60)}h ${goals.daily % 60}m`}>
              <input
                type="range"
                min={15}
                max={480}
                step={15}
                value={goals.daily}
                onChange={(e) => setGoals((g) => ({ ...g, daily: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#6366F1" }}
              />
            </Field>
            <Field label={`Weekly Goal — ${Math.floor(goals.weekly / 60)}h`}>
              <input
                type="range"
                min={60}
                max={3000}
                step={30}
                value={goals.weekly}
                onChange={(e) => setGoals((g) => ({ ...g, weekly: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#10B981" }}
              />
            </Field>
          </Card>

          {/* Appearance */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🎨 Appearance</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                ["dark", "🌙 Dark"],
                ["light", "☀️ Light"],
              ].map(([t, l]) => (
                <button
                  key={t}
                  onClick={() => save((d) => ({ ...d, theme: t }))}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                    background: data.theme === t ? "#6366F1" : "var(--bg)",
                    color: data.theme === t ? "#fff" : "var(--muted)",
                    border: `1px solid ${data.theme === t ? "#6366F1" : "var(--border)"}`,
                    fontFamily: "inherit",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </Card>

          {/* Data */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>💾 Data</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Btn variant="ghost" onClick={exportData}>
                📤 Export Backup
              </Btn>
              <Btn variant="danger" onClick={clearAll}>
                🗑️ Clear All Data
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14 }}>
        {saved && (
          <span style={{ color: "#10B981", fontWeight: 600, fontSize: 13 }}>
            ✓ Saved!
          </span>
        )}
        <Btn onClick={saveAll} style={{ minWidth: 140, padding: "11px 24px" }}>
          Save Settings
        </Btn>
      </div>
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    course: "",
    semester: "",
  });
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.email.trim() || !form.password.trim()) {
      setError("Please enter email and password.");
      return;
    }
    setError("");
    onLogin({
      name: form.name || "Student",
      email: form.email,
      course: form.course,
      semester: form.semester,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>📚</div>
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: 30,
              fontWeight: 900,
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            StudyFlow
          </h1>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            Your personal productivity companion
          </div>
        </div>

        <Card>
          {/* Toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--bg)",
              borderRadius: 10,
              padding: 4,
              marginBottom: 22,
            }}
          >
            {["Login", "Sign Up"].map((l, i) => (
              <button
                key={l}
                onClick={() => {
                  setIsLogin(i === 0);
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  background: isLogin === (i === 0) ? "#6366F1" : "transparent",
                  color: isLogin === (i === 0) ? "#fff" : "var(--muted)",
                  border: "none",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {!isLogin && (
            <Input
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Arjun Sharma"
            />
          )}
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@college.edu"
          />
          <Input
            label="Password *"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
          />
          {!isLogin && (
            <>
              <Input
                label="Course / Branch"
                value={form.course}
                onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
                placeholder="B.Tech Computer Science"
              />
              <Input
                label="Semester"
                value={form.semester}
                onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                placeholder="5th Semester"
              />
            </>
          )}

          {error && (
            <div
              style={{
                color: "#EF4444",
                fontSize: 13,
                marginBottom: 12,
                padding: "8px 12px",
                background: "#EF444415",
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}

          <Btn
            onClick={submit}
            style={{ width: "100%", padding: "12px", fontSize: 15, marginTop: 2 }}
          >
            {isLogin ? "Login →" : "Create Account →"}
          </Btn>

          <div
            style={{
              textAlign: "center",
              marginTop: 14,
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            Demo mode — any email & password works
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "tasks", label: "Tasks", icon: "✅" },
  { id: "study", label: "Study Timer", icon: "⏱️" },
  { id: "timetable", label: "Timetable", icon: "📅" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "notes", label: "Notes", icon: "📝" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, save] = useStore();
  const [page, setPage] = useState("dashboard");
  const [loggedIn, setLoggedIn] = useState(() => {
    try {
      return !!localStorage.getItem("spt_auth");
    } catch {
      return false;
    }
  });

  const isDark = data.theme !== "light";

  const themeVars = isDark
    ? {
        "--bg": "#0F172A",
        "--card": "#1E293B",
        "--border": "#334155",
        "--text": "#F1F5F9",
        "--muted": "#94A3B8",
      }
    : {
        "--bg": "#F1F5F9",
        "--card": "#FFFFFF",
        "--border": "#E2E8F0",
        "--text": "#0F172A",
        "--muted": "#64748B",
      };

  const handleLogin = (profile) => {
    save((d) => ({ ...d, profile: { ...d.profile, ...profile } }));
    try {
      localStorage.setItem("spt_auth", "1");
    } catch (e) {}
    setLoggedIn(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("spt_auth");
    } catch (e) {}
    setLoggedIn(false);
  };

  const pendingTasks = data.tasks.filter(
    (t) => !t.done && t.date === todayStr()
  ).length;

  const pageComponents = {
    dashboard: <Dashboard data={data} save={save} setPage={setPage} />,
    tasks: <Tasks data={data} save={save} />,
    study: <StudyTracker data={data} save={save} />,
    timetable: <Timetable data={data} save={save} />,
    analytics: <Analytics data={data} />,
    notes: <Notes data={data} save={save} />,
    settings: <Settings data={data} save={save} />,
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        input[type=range] { cursor: pointer; }
        button { font-family: inherit; }
        select option { background: #1E293B; color: #F1F5F9; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          color: "var(--text)",
          ...themeVars,
        }}
      >
        {!loggedIn ? (
          <Auth onLogin={handleLogin} />
        ) : (
          <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar */}
            <div
              style={{
                width: 220,
                background: "var(--card)",
                borderRight: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                position: "sticky",
                top: 0,
                flexShrink: 0,
              }}
            >
              {/* Logo */}
              <div
                style={{
                  padding: "22px 20px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 26 }}>📚</span>
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                        background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      StudyFlow
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                      {data.profile.name || "Student"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
                {NAV.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setPage(n.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      marginBottom: 2,
                      textAlign: "left",
                      background: page === n.id ? "#6366F122" : "transparent",
                      color: page === n.id ? "#6366F1" : "var(--muted)",
                      fontWeight: page === n.id ? 700 : 500,
                      fontSize: 14,
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{n.icon}</span>
                    <span style={{ flex: 1 }}>{n.label}</span>
                    {n.id === "tasks" && pendingTasks > 0 && (
                      <span
                        style={{
                          background: "#EF4444",
                          color: "#fff",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "1px 6px",
                          flexShrink: 0,
                        }}
                      >
                        {pendingTasks}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {/* Logout */}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            </div>

            {/* Main content */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                minHeight: "100vh",
              }}
            >
              {/* Topbar */}
              <div
                style={{
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 24px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--card)",
                  gap: 14,
                  position: "sticky",
                  top: 0,
                  zIndex: 100,
                  flexShrink: 0,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>
                  {NAV.find((n) => n.id === page)?.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                {data.streak.count > 0 && (
                  <Badge color="#F59E0B">🔥 {data.streak.count}d streak</Badge>
                )}
              </div>

              {/* Page content */}
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  overflowY: "auto",
                  maxWidth: 1100,
                  width: "100%",
                }}
              >
                {pageComponents[page]}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
