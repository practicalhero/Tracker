import React, { useEffect, useMemo, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "https://tracker-7i1s.onrender.com/api").replace(/\/$/, "");
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const apiFetch = (path, options = {}) => {
  const token = localStorage.getItem("keystone-token");
  return fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
};
const stages = ["Wishlist", "Applied", "Interview", "Offer"];
const sampleJobs = [
  { _id: "demo-1", company: "Veridian", role: "Product Designer", location: "Remote", stage: "Interview", nextStep: "Portfolio review · Friday, 2:00 PM" },
  { _id: "demo-2", company: "Northstar", role: "UX Researcher", location: "Bengaluru", stage: "Applied", nextStep: "Follow up next Tuesday" },
  { _id: "demo-3", company: "Atelier", role: "Design Systems Lead", location: "Remote", stage: "Offer", nextStep: "Review offer details" }
];
const sampleTasks = [
  { _id: "task-1", title: "Morning walk before work", category: "Wellbeing", priority: "Low", completed: true },
  { _id: "task-2", title: "Book dentist appointment", category: "Personal", priority: "High", completed: false },
  { _id: "task-3", title: "Finish portfolio case study", category: "Career", priority: "High", completed: false }
];

function App() {
  const [page, setPage] = useState("overview");
  const [jobs, setJobs] = useState(sampleJobs);
  const [tasks, setTasks] = useState(sampleTasks);
  const [online, setOnline] = useState(false);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("keystone-user") || "null"));
  const [authMode, setAuthMode] = useState(() => localStorage.getItem("keystone-user") ? null : "login");
  const [jobForm, setJobForm] = useState({ company: "", role: "", location: "Remote", stage: "Applied", nextStep: "" });
  const [taskForm, setTaskForm] = useState({ title: "", category: "Personal", priority: "Medium", dueDate: "" });

  // The app works with polished demo data until the API is available, then swaps in saved MongoDB data.
  useEffect(() => {
    if (!user) return;
    Promise.all([apiFetch("/jobs"), apiFetch("/tasks")])
      .then(async ([jobResponse, taskResponse]) => {
        if (!jobResponse.ok || !taskResponse.ok) throw new Error("API unavailable");
        const [savedJobs, savedTasks] = await Promise.all([jobResponse.json(), taskResponse.json()]);
        // Keep the starter view useful for a brand-new (empty) database.
        setJobs(savedJobs.length ? savedJobs : sampleJobs);
        setTasks(savedTasks.length ? savedTasks : sampleTasks);
        setOnline(true);
      }).catch(() => setOnline(false));
  }, [user]);

  const visibleJobs = jobs.filter((job) => !job.deleted);
  const visibleTasks = tasks.filter((task) => !task.deleted);
  const deletedItems = [...jobs.filter((job) => job.deleted).map((job) => ({ ...job, kind: "Job" })), ...tasks.filter((task) => task.deleted).map((task) => ({ ...task, kind: "Task" }))];
  const stats = useMemo(() => ({
    active: visibleJobs.filter((job) => job.stage !== "Offer").length,
    interviews: visibleJobs.filter((job) => job.stage === "Interview").length,
    offers: visibleJobs.filter((job) => job.stage === "Offer").length,
    done: visibleTasks.filter((task) => task.completed).length
  }), [visibleJobs, visibleTasks]);

  async function addJob(event) {
    event.preventDefault();
    if (!jobForm.company || !jobForm.role) return;
    const newJob = { ...jobForm, _id: `demo-${Date.now()}` };
    if (online) newJob._id = (await (await apiFetch("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(jobForm) })).json())._id;
    setJobs((current) => [newJob, ...current]);
    setJobForm({ company: "", role: "", location: "Remote", stage: "Applied", nextStep: "" });
  }

  async function addTask(event) {
    event.preventDefault();
    if (!taskForm.title) return;
    const newTask = { ...taskForm, completed: false, _id: `task-${Date.now()}` };
    if (online) newTask._id = (await (await apiFetch("/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskForm) })).json())._id;
    setTasks((current) => [...current, newTask]);
    setTaskForm({ title: "", category: "Personal", priority: "Medium", dueDate: "" });
  }

  // Update UI immediately for a responsive feel; mirror the change to MongoDB when connected.
  async function toggleTask(task) {
    const completed = !task.completed;
    setTasks((current) => current.map((item) => item._id === task._id ? { ...item, completed } : item));
    if (online) await apiFetch(`/tasks/${task._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed }) });
  }
  async function moveJob(job, stage) {
    setJobs((current) => current.map((item) => item._id === job._id ? { ...item, stage } : item));
    if (online) await apiFetch(`/jobs/${job._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
  }
  // Archived items stay in MongoDB (and in local state) with a deleted flag, so they can be restored.
  async function archiveItem(item, type) {
    const collection = type === "Job" ? "jobs" : "tasks";
    const update = { deleted: true };
    if (online && !item._id.startsWith("demo-") && !item._id.startsWith("task-")) await apiFetch(`/${collection}/${item._id}`, { method: "DELETE" });
    const setter = type === "Job" ? setJobs : setTasks;
    setter((current) => current.map((entry) => entry._id === item._id ? { ...entry, ...update } : entry));
  }
  async function restoreItem(item) {
    const collection = item.kind === "Job" ? "jobs" : "tasks";
    if (online && !item._id.startsWith("demo-") && !item._id.startsWith("task-")) await apiFetch(`/${collection}/${item._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }) });
    const setter = item.kind === "Job" ? setJobs : setTasks;
    setter((current) => current.map((entry) => entry._id === item._id ? { ...entry, deleted: false } : entry));
  }
  function finishAuth(account, token) { localStorage.setItem("keystone-user", JSON.stringify(account)); if (token) localStorage.setItem("keystone-token", token); setUser(account); setAuthMode(null); }

  return <div className="app-shell">
    <header><a className="brand" onClick={() => setPage("overview")}>✦ <span>Keystone</span></a>
      <nav>{[["overview", "Overview"], ["jobs", "Job Tracker"], ["tasks", "Personal Tasks"], ["archive", `Deleted (${deletedItems.length})`]].map(([id, label]) => <button key={id} onClick={() => setPage(id)} className={page === id ? "active" : ""}>{label}</button>)}</nav>
      <div className="header-right"><span className={online ? "connection online" : "connection"}>{online ? "SYNCED" : demoMode ? "DEMO MODE" : "OFFLINE"}</span>{user ? <button className="account-button" onClick={() => { localStorage.removeItem("keystone-user"); localStorage.removeItem("keystone-token"); setUser(null); }}>Hi, {user.name} · Log out</button> : <button className="account-button" onClick={() => setAuthMode("login")}>Log in</button>}<button className="add-button" onClick={() => setPage(page === "tasks" ? "tasks" : "jobs")}>＋ Add</button></div>
    </header>
    <main>
      {page === "overview" && <Overview stats={stats} jobs={visibleJobs} tasks={visibleTasks} setPage={setPage} />}
      {page === "jobs" && <Jobs jobs={visibleJobs} jobForm={jobForm} setJobForm={setJobForm} addJob={addJob} moveJob={moveJob} archiveItem={archiveItem} />}
      {page === "tasks" && <Tasks tasks={visibleTasks} taskForm={taskForm} setTaskForm={setTaskForm} addTask={addTask} toggleTask={toggleTask} archiveItem={archiveItem} />}
      {page === "archive" && <Archive items={deletedItems} restoreItem={restoreItem} />}
    </main>
    {authMode && <Auth mode={authMode} setMode={setAuthMode} finishAuth={finishAuth} online={online} required={!user} />}
  </div>;
}

function Overview({ stats, jobs, tasks, setPage }) {
  return <><section className="hero"><p className="eyebrow"><i /> YOUR INTENTIONAL WORKSPACE</p><h1>Make steady progress.<br/><span>Keep room for life.</span></h1><p className="hero-note">A gentle home for applications, priorities, and your next good step.</p></section>
    <section className="metrics">
      <Metric label="Active applications" value={String(stats.active).padStart(2, "0")} detail="Across your pipeline" icon="⌁" />
      <Metric label="In interview" value={String(stats.interviews).padStart(2, "0")} detail="Focus this week" icon="◫" amber />
      <Metric label="Offers received" value={String(stats.offers).padStart(2, "0")} detail="Worth celebrating" icon="✦" />
      <Metric label="Tasks complete" value={`${stats.done}/${tasks.length}`} detail="Today and beyond" icon="✓" />
    </section>
    <section className="two-column"><div className="panel"><div className="panel-title"><div><p className="eyebrow">CAREER MOMENTUM</p><h2>Application pipeline</h2></div><button className="text-button" onClick={() => setPage("jobs")}>View board →</button></div>
      <div className="job-list">{jobs.slice(0, 4).map((job) => <div className="job-row" key={job._id}><div className="monogram">{job.company.slice(0, 2).toUpperCase()}</div><div><strong>{job.company}</strong><p>{job.role} · {job.location}</p></div><span className={`badge ${job.stage.toLowerCase()}`}>{job.stage}</span></div>)}</div></div>
      <div className="panel focus-panel"><div className="panel-title"><div><p className="eyebrow">TODAY'S RHYTHM</p><h2>Personal focus</h2></div><button className="text-button" onClick={() => setPage("tasks")}>All tasks →</button></div>
        <div className="progress-label"><span>Weekly intentions</span><span>{stats.done} of {tasks.length} complete</span></div><div className="progress"><span style={{ width: `${tasks.length ? (stats.done / tasks.length) * 100 : 0}%` }} /></div>
        {tasks.slice(0, 3).map((task) => <div className="mini-task" key={task._id}><span className={task.completed ? "check done" : "check"}>{task.completed && "✓"}</span><span className={task.completed ? "completed" : ""}>{task.title}</span><em>{task.category}</em></div>)}
      </div></section>
    <section className="quote"><span>✾</span><div><p className="eyebrow">MINDFUL PROMPT · DAILY ANCHOR</p><blockquote>“You are not in a race against anyone else’s timeline.<br/>Purposeful transitions need deliberate stillness.”</blockquote></div></section>
  </>;
}
function Metric({ label, value, detail, icon, amber }) { return <article className="metric"><div className="metric-top"><p className="eyebrow">{label}</p><b className={amber ? "icon amber" : "icon"}>{icon}</b></div><strong>{value}</strong><p>{detail}</p><div className="metric-line"><span className={amber ? "amber-fill" : ""} /></div></article>; }
function Jobs({ jobs, jobForm, setJobForm, addJob, moveJob, archiveItem }) { return <><section className="page-heading"><p className="eyebrow">CAREER PATHWAYS</p><h1>Job Tracker</h1><p>Guide every opportunity from first spark to a confident yes.</p></section><section className="workspace"><form className="quick-form" onSubmit={addJob}><h3>Add an application</h3><input placeholder="Company" value={jobForm.company} onChange={e => setJobForm({ ...jobForm, company: e.target.value })} /><input placeholder="Role" value={jobForm.role} onChange={e => setJobForm({ ...jobForm, role: e.target.value })} /><input placeholder="Location" value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} /><select value={jobForm.stage} onChange={e => setJobForm({ ...jobForm, stage: e.target.value })}>{stages.map(s => <option key={s}>{s}</option>)}</select><input placeholder="Next step (optional)" value={jobForm.nextStep} onChange={e => setJobForm({ ...jobForm, nextStep: e.target.value })} /><button>Add to pipeline</button></form><div className="board">{stages.map(stage => <div className="board-column" key={stage}><div className="column-head"><span>{stage}</span><b>{jobs.filter(j => j.stage === stage).length}</b></div>{jobs.filter(j => j.stage === stage).map(job => <article className="job-card" key={job._id}><p className="eyebrow">{job.location}</p><h3>{job.company}</h3><p>{job.role}</p>{job.nextStep && <div className="next-step">{job.nextStep}</div>}<select value={job.stage} onChange={e => moveJob(job, e.target.value)} aria-label="Move application">{stages.map(s => <option key={s}>{s}</option>)}</select><button type="button" className="archive-button" onClick={() => archiveItem(job, "Job")}>Archive job</button></article>)}</div>)}</div></section></>; }
function Tasks({ tasks, taskForm, setTaskForm, addTask, toggleTask, archiveItem }) { const remaining = tasks.filter(t => !t.completed); return <><section className="page-heading"><p className="eyebrow">LIFE, WITH INTENTION</p><h1>Personal Tasks</h1><p>Small, visible commitments that make space for the life you want.</p></section><section className="tasks-layout"><form className="task-create" onSubmit={addTask}><h3>A new intention</h3><input autoFocus placeholder="What would you like to do?" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /><div className="form-row"><select value={taskForm.category} onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}>{["Personal", "Wellbeing", "Home", "Career", "Learning"].map(c => <option key={c}>{c}</option>)}</select><select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>{["Low", "Medium", "High"].map(p => <option key={p}>{p}</option>)}</select></div><input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /><button>Add task</button></form><div className="task-panel"><div className="panel-title"><div><p className="eyebrow">OPEN LOOP LIST</p><h2>To tend to</h2></div><span className="count">{remaining.length} remaining</span></div>{tasks.map(task => <article className="task-row" key={task._id}><button type="button" className={task.completed ? "round-check checked" : "round-check"} onClick={() => toggleTask(task)}>{task.completed && "✓"}</button><div><h3 className={task.completed ? "completed" : ""}>{task.title}</h3><p>{task.category}{task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}</p></div><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><button type="button" className="archive-button" onClick={() => archiveItem(task, "Task")}>Archive</button></article>)}</div></section></>; }
function Archive({ items, restoreItem }) { return <section><div className="page-heading"><p className="eyebrow">SOFT-DELETED ITEMS</p><h1>Deleted archive</h1><p>Nothing is permanently removed here. Restore an item whenever you need it again.</p></div><div className="archive-list">{items.length ? items.map(item => <article className="archive-row" key={`${item.kind}-${item._id}`}><div><span className="kind-tag">{item.kind}</span><h3>{item.kind === "Job" ? `${item.company} · ${item.role}` : item.title}</h3><p>{item.kind === "Job" ? item.stage : item.category}</p></div><button className="restore-button" onClick={() => restoreItem(item)}>Restore</button></article>) : <div className="empty-state">Your archive is clear. Deleted jobs and tasks will appear here.</div>}</div></section>; }
function Auth({ mode, setMode, finishAuth, online, required }) { const [form, setForm] = useState({ name: "", email: "", password: "" }); const [message, setMessage] = useState(""); async function submit(event) { event.preventDefault(); if (!online && demoMode) return finishAuth({ name: form.name || form.email.split("@")[0] || "Guest", email: form.email }, "demo-token"); try { const response = await fetch(`${API}/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) return setMessage(data.message); finishAuth(data.user, data.token); } catch { setMessage("The service is unavailable. Please try again in a moment."); } } return <div className={required ? "modal-backdrop auth-gate" : "modal-backdrop"}><form className="auth-card" onSubmit={submit}>{!required && <button type="button" className="close" onClick={() => setMode(null)}>×</button>}<p className="eyebrow">YOUR KEYSTONE ACCOUNT</p><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2><p>{mode === "login" ? "Log in to continue your intentional work." : "Save your progress with a simple account."}</p>{mode === "register" && <input required placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}<input required type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input required type="password" minLength="6" placeholder="Password (6+ characters)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />{message && <small>{message}</small>}<button>{mode === "login" ? "Log in" : "Create account"}</button><p className="switch-auth">{mode === "login" ? "New here?" : "Already have an account?"} <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Register" : "Log in"}</button></p></form></div>; }
export default App;
