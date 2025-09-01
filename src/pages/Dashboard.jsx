// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase, useAuth } from "../supabase.jsx";
import BounceBackModal from "../components/BounceBackModal.jsx";

export default function Dashboard() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [moodStreak, setMoodStreak] = useState(0);
  const [recoStreak, setRecoStreak] = useState(0);
  const [comebackCount, setComebackCount] = useState(0);
  const [hobbies, setHobbies] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const [newHobby, setNewHobby] = useState({
    name: "",
    target_sessions_per_week: 3,
    target_minutes_per_session: 20,
  });
  const [newTask, setNewTask] = useState({
    title: "",
    category: "academic",
    priority: "medium",
    due_at: "",
  });

  // delete confirm state
  const [deleteHobbyId, setDeleteHobbyId] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);

  // Bounce Back state
  const [challenge, setChallenge] = useState(null);

  // Streak calculator
  const calcStreak = (records) => {
    if (!records?.length) return 0;
    const dates = [...new Set(
      records.map((r) => new Date(r.created_at).toISOString().split("T")[0])
    )];
    let streak = 0;
    let today = new Date();
    for (let i = 0; i < dates.length; i++) {
      let expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (dates.includes(expected.toISOString().split("T")[0])) streak++;
      else break;
    }
    return streak;
  };

  // Fetch dashboard data
  async function fetchData() {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: moods } = await supabase
        .from("mood_checkins")
        .select("created_at")
        .eq("user_id", userId)
        .eq("is_deleted", false);

      const { data: recos } = await supabase
        .from("recommendation_actions")
        .select("created_at")
        .eq("user_id", userId)
        .eq("status", "done");

      setMoodStreak(calcStreak(moods));
      setRecoStreak(calcStreak(recos));

      const { data: hobbiesData } = await supabase
        .from("hobbies")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      setHobbies(hobbiesData || []);

      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .neq("status", "done")
        .order("due_at", { ascending: true, nullsFirst: true });
      setTasks(taskData || []);

      const { data, error } = await supabase
        .from("v_weekly_report")
        .select("*")
        .eq("user_id", userId);
      if (error) {
        console.error("Weekly report fetch error:", error);
      } else {
        setReport(data?.[0] || null);
      }

      // Count completed comeback challenges for "Streaks Saved"
      const { data: challenges } = await supabase
        .from("comeback_challenges")
        .select("id")
        .eq("user_id", userId)
        .eq("completed", true);
      setComebackCount(challenges?.length || 0);
    } catch (err) {
      console.error("⚠️ Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  // Add hobby
  async function addHobby(e) {
    e.preventDefault();
    if (!newHobby.name) return;
    await supabase.from("hobbies").insert([{ user_id: userId, ...newHobby }]);
    setNewHobby({
      name: "",
      target_sessions_per_week: 3,
      target_minutes_per_session: 20,
    });
    fetchData();
  }

  // Add task
  async function addTask(e) {
    e.preventDefault();
    if (!newTask.title) return;
    await supabase.from("tasks").insert([{ user_id: userId, ...newTask }]);
    setNewTask({
      title: "",
      category: "academic",
      priority: "medium",
      due_at: "",
    });
    fetchData();
  }

  // Log hobby session
  async function logHobbySession(hobbyId, minutes, note) {
    const { error } = await supabase.from("hobby_logs").insert([
      {
        user_id: userId,
        hobby_id: hobbyId,
        started_at: new Date().toISOString(),
        duration_minutes: minutes || null,
        note: note || null,
        source: "manual",
      },
    ]);

    if (error) {
      console.error("Insert failed:", error.message, error.details, error.hint);
    } else {
      await supabase.rpc("refresh_weekly_report_rpc");
      fetchData();
    }
  }

  // Complete task + Bounce Back logic
  async function completeTask(id) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error completing task:", error.message);
    } else {
      // Recalculate streak
      const { data: tasksDone } = await supabase
        .from("tasks")
        .select("completed_at")
        .eq("user_id", userId)
        .eq("status", "done");
      const taskStreak = calcStreak(tasksDone);

      // Offer a comeback challenge if the task streak seems broken
      if (taskStreak === 0) {
        const challenges = [
          "Do 5 deep breaths and refocus.",
          "Write down one thing you’re grateful for.",
          "Stand up and stretch for 2 minutes.",
          "Quick win: Tidy your desk for 3 minutes.",
          "Think of one small goal for tomorrow.",
        ];
        const randomChallenge =
          challenges[Math.floor(Math.random() * challenges.length)];

        const { data: cData, error: cErr } = await supabase
          .from("comeback_challenges")
          .insert([
            {
              user_id: userId,
              type: "task",
              challenge_text: randomChallenge,
            },
          ])
          .select()
          .single();

        if (cErr) console.error("⚠️ Failed to insert challenge:", cErr);
        else setChallenge(cData);
      }

      await supabase.rpc("refresh_weekly_report_rpc");
      fetchData();
    }
  }

  // Mark comeback challenge complete
  async function handleChallengeComplete() {
    if (!challenge) return;

    const { error } = await supabase
      .from("comeback_challenges")
      .update({ completed: true })
      .eq("id", challenge.id)
      .eq("user_id", userId);

    if (error) {
      console.error("⚠️ Failed to complete comeback challenge:", error);
    } else {
      // refresh streaks after comeback
      fetchData();
    }
    setChallenge(null);
  }

  // Delete (soft)
  async function deleteHobby(id) {
    await supabase
      .from("hobbies")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("user_id", userId);
    setDeleteHobbyId(null);
    fetchData();
  }

  async function deleteTask(id) {
    await supabase
      .from("tasks")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("user_id", userId);
    setDeleteTaskId(null);
    fetchData();
  }

  // Priority colors
  const getPriorityClass = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-600 font-semibold";
      case "medium":
        return "text-yellow-600 font-semibold";
      case "low":
        return "text-green-600 font-semibold";
      default:
        return "text-gray-600";
    }
  };

  if (!session) return <p className="p-6">Please log in to see dashboard.</p>;
  if (loading) return <p className="p-6">Loading dashboard...</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-purple-700 mb-6">👋 Welcome Back!</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl items-stretch">
        {/* Streaks */}
        <div className="bg-white shadow-md rounded-xl p-6 flex flex-col min-h-[220px]">
          <h2 className="text-lg font-semibold mb-3">🔥 Streaks</h2>

          <p className="text-gray-700">
            Mood Check-in Streak:{" "}
            <span className="font-bold text-purple-600">{moodStreak} days</span>
          </p>
          <p className="text-gray-700">
            Recommendations Done:{" "}
            <span className="font-bold text-green-600">{recoStreak} days</span>
          </p>

          {/* Highlighted streaks saved */}
          <div className="mt-3">
            <p className="text-gray-700 flex items-center gap-2">
              ⚡ Streaks Saved:{" "}
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                {comebackCount}
              </span>
            </p>

            {/* Progress bar visualizing comebacks (cycles every 10) */}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((comebackCount % 10) * 10, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {10 - (comebackCount % 10)} more saves until next milestone 🎯
            </p>
          </div>
        </div>

        {/* Hobbies */}
        <div className="bg-white shadow-md rounded-xl p-6 flex flex-col min-h-[220px]">
          <h2 className="text-lg font-semibold mb-3">🎨 My Hobbies</h2>

          {/* Scroll only the list so the card height stays tidy */}
          <div className="flex-1 overflow-y-auto max-h-40 md:max-h-48 pr-1">
            {hobbies.length > 0 ? (
              hobbies.map((h) => (
                <div key={h.id} className="mb-4 border-b pb-3">
                  <p className="font-medium text-gray-800">{h.name}</p>
                  <p className="text-sm text-gray-500">
                    🎯 Target: {h.target_sessions_per_week} sessions/week • {h.target_minutes_per_session} min/session
                  </p>
                  <p className="text-sm text-gray-600">
                    📊 Progress: (future: show sessions & minutes logged this week)
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => logHobbySession(h.id, h.target_minutes_per_session, "")}
                      className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Log Session
                    </button>
                    <button
                      onClick={() => setDeleteHobbyId(h.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 mb-3">No hobbies yet.</p>
            )}
          </div>

          {/* Add hobby form */}
          <form onSubmit={addHobby} className="space-y-2 mt-4">
            <input
              type="text"
              placeholder="New hobby name"
              value={newHobby.name}
              onChange={(e) => setNewHobby({ ...newHobby, name: e.target.value })}
              className="w-full border rounded p-2"
              required
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newHobby.target_sessions_per_week}
                onChange={(e) => setNewHobby({ ...newHobby, target_sessions_per_week: Number(e.target.value) })}
                className="w-1/2 border rounded p-2"
                placeholder="Sessions/week"
                min="1"
              />
              <input
                type="number"
                value={newHobby.target_minutes_per_session}
                onChange={(e) => setNewHobby({ ...newHobby, target_minutes_per_session: Number(e.target.value) })}
                className="w-1/2 border rounded p-2"
                placeholder="Minutes/session"
                min="1"
              />
            </div>
            <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700">
              ➕ Add Hobby
            </button>
          </form>
        </div>

        {/* Tasks (Pending Only) */}
        <div className="bg-white shadow-md rounded-xl p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-3">✅ Pending Tasks</h2>
          {tasks.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="p-2">Title</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2">Due</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-b last:border-none">
                      <td className="p-2">{t.title}</td>
                      <td className="p-2 capitalize">{t.category}</td>
                      <td className={`p-2 capitalize ${getPriorityClass(t.priority)}`}>
                        {t.priority}
                      </td>
                      <td className="p-2">
                        {t.due_at ? new Date(t.due_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-2 flex gap-2">
                        <button
                          onClick={() => completeTask(t.id)}
                          className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Mark Done
                        </button>
                        <button
                          onClick={() => setDeleteTaskId(t.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 mb-4">No pending tasks 🎉</p>
          )}

          {/* Add task form */}
          <form onSubmit={addTask} className="space-y-2 mt-4">
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full border rounded p-2"
              required
            />
            <div className="flex gap-2">
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="w-1/3 border rounded p-2"
              >
                <option value="academic">Academic</option>
                <option value="personal_dev">Personal Dev</option>
                <option value="wellbeing">Wellbeing</option>
                <option value="other">Other</option>
              </select>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-1/3 border rounded p-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={newTask.due_at}
                onChange={(e) => setNewTask({ ...newTask, due_at: e.target.value })}
                className="w-1/3 border rounded p-2"
              />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
              ➕ Add Task
            </button>
          </form>
        </div>

        {/* Weekly Report */}
        <div className="bg-white shadow-md rounded-xl p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-3">📅 Weekly Report</h2>
          {report ? (
            <ul className="space-y-1 text-gray-700">
              <li>Mood logs: {report.mood_logs_7d}</li>
              <li>Recommendations completed: {report.recommendations_done_7d}</li>
              <li>
                Tasks done: {report.tasks_done_7d} / {report.tasks_created_7d}
              </li>
              <li>
                Hobby sessions: {report.hobby_sessions_7d} ({report.hobby_minutes_7d} minutes)
              </li>
            </ul>
          ) : (
            <p className="text-gray-500">No report yet.</p>
          )}
        </div>
      </div>

      {/* Delete confirms */}
      {deleteHobbyId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-xl w-80">
            <h2 className="text-lg font-bold mb-2">Delete Hobby?</h2>
            <p className="text-gray-600 mb-4">This will hide the hobby but won’t affect streaks.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteHobbyId(null)} className="px-3 py-1 border rounded">
                Cancel
              </button>
              <button onClick={() => deleteHobby(deleteHobbyId)} className="px-3 py-1 bg-red-600 text-white rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTaskId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-xl w-80">
            <h2 className="text-lg font-bold mb-2">Delete Task?</h2>
            <p className="text-gray-600 mb-4">This will hide the task but won’t affect streaks.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTaskId(null)} className="px-3 py-1 border rounded">
                Cancel
              </button>
              <button onClick={() => deleteTask(deleteTaskId)} className="px-3 py-1 bg-red-600 text-white rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bounce Back Modal */}
      <BounceBackModal
        challenge={challenge}
        onComplete={handleChallengeComplete}
        onSkip={() => setChallenge(null)}
      />
    </div>
  );
}
