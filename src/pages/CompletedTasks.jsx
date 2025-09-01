// src/pages/CompletedTasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase, useAuth } from "../supabase.jsx";

export default function CompletedTasks() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Extra stats
  const [stats, setStats] = useState({ week: 0, month: 0 });

  const [deleteId, setDeleteId] = useState(null);

  // Filters
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("completed_desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const startOfWeekISO = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  }, []);
  const startOfMonthISO = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, category, priority, dateFrom, dateTo, sort, pageSize]);

  // ✅ fetch tasks
  useEffect(() => {
    async function fetchCompleted() {
      if (!userId) return;
      setLoading(true);
      setErrorMsg("");

      try {
        let q = supabase
          .from("tasks")
          .select("*", { count: "exact" })
          .eq("user_id", userId)
          .eq("status", "done")
          .eq("is_deleted", false);

        if (debouncedQuery) q = q.ilike("title", `%${debouncedQuery}%`);
        if (category !== "all") q = q.eq("category", category);
        if (priority !== "all") q = q.eq("priority", priority);
        if (dateFrom) q = q.gte("completed_at", `${dateFrom}T00:00:00`);
        if (dateTo) q = q.lte("completed_at", `${dateTo}T23:59:59`);

        switch (sort) {
          case "completed_asc":
            q = q.order("completed_at", { ascending: true });
            break;
          case "due_asc":
            q = q.order("due_at", { ascending: true, nullsFirst: true });
            break;
          case "due_desc":
            q = q.order("due_at", { ascending: false, nullsFirst: true });
            break;
          case "title_asc":
            q = q.order("title", { ascending: true });
            break;
          case "title_desc":
            q = q.order("title", { ascending: false });
            break;
          case "completed_desc":
          default:
            q = q.order("completed_at", { ascending: false });
            break;
        }

        const from = page * pageSize;
        const to = from + pageSize - 1;
        q = q.range(from, to);

        const { data, error, count } = await q;
        if (error) throw error;

        setTasks(data || []);
        setTotal(count || 0);
      } catch (err) {
        console.error("CompletedTasks fetch error:", err);
        setErrorMsg("Failed to load completed tasks. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchCompleted();
  }, [userId, debouncedQuery, category, priority, dateFrom, dateTo, sort, page, pageSize]);

  // ✅ fetch stats
  useEffect(() => {
    async function fetchStats() {
      if (!userId) return;
      try {
        const { count: week } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "done")
          .eq("is_deleted", false)
          .gte("completed_at", `${startOfWeekISO}T00:00:00`);

        const { count: month } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "done")
          .eq("is_deleted", false)
          .gte("completed_at", `${startOfMonthISO}T00:00:00`);

        setStats({ week: week || 0, month: month || 0 });
      } catch (err) {
        console.error("Stats fetch error:", err);
      }
    }
    fetchStats();
  }, [userId, startOfWeekISO, startOfMonthISO, tasks.length]);

  if (!session) return <p className="p-6">Please log in.</p>;

  const categoryBadge = (val) => {
    const base = "px-2 py-0.5 rounded text-xs font-medium";
    switch (val) {
      case "academic": return `${base} bg-blue-100 text-blue-700`;
      case "personal_dev": return `${base} bg-indigo-100 text-indigo-700`;
      case "wellbeing": return `${base} bg-teal-100 text-teal-700`;
      default: return `${base} bg-gray-100 text-gray-700`;
    }
  };

  const priorityBadge = (val) => {
    const base = "px-2 py-0.5 rounded text-xs font-semibold";
    switch (val) {
      case "high": return `${base} bg-red-100 text-red-700`;
      case "medium": return `${base} bg-yellow-100 text-yellow-800`;
      case "low": return `${base} bg-green-100 text-green-700`;
      default: return `${base} bg-gray-100 text-gray-700`;
    }
  };

  async function restoreTask(id) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "pending", completed_at: null })
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    }
  }

  async function deleteTask(id) {
    const { error } = await supabase
      .from("tasks")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-green-700 mb-2">✅ Completed Tasks</h1>
      <p className="text-gray-600 mb-6">
        {stats.week} completed this week • {stats.month} this month
      </p>

      <div className="w-full max-w-6xl mt-2 bg-white shadow-md rounded-xl">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b z-10">
              <tr className="text-left text-gray-600">
                <th className="p-3 w-[40%]">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Due</th>
                <th className="p-3">Completed</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-gray-400">Loading…</td></tr>
              ) : tasks.length ? (
                tasks.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="p-3">{t.title}</td>
                    <td className="p-3"><span className={categoryBadge(t.category)}>{t.category}</span></td>
                    <td className="p-3"><span className={priorityBadge(t.priority)}>{t.priority}</span></td>
                    <td className="p-3">{t.due_at ? new Date(t.due_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3">{t.completed_at ? new Date(t.completed_at).toLocaleString() : "—"}</td>
                    <td className="p-3 text-right flex gap-2 justify-end">
                      <button
                        onClick={() => restoreTask(t.id)}
                        className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => setDeleteId(t.id)}
                        className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={6}>No completed tasks found with current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-sm text-gray-600">
            Page {page + 1} of {totalPages} • Showing {tasks.length} of {total}
          </div>
          <div className="flex gap-2">
            <button disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50">◀ Prev</button>
            <button disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50">Next ▶</button>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-80">
            <h2 className="text-lg font-bold mb-2">Confirm Delete</h2>
            <p className="text-gray-600 mb-4">
              This will remove the task from your dashboard but <b>won’t affect streaks</b>.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-3 py-1 rounded border">Cancel</button>
              <button
                onClick={() => { deleteTask(deleteId); setDeleteId(null); }}
                className="px-3 py-1 rounded bg-red-600 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div className="mt-4 text-red-600">{errorMsg}</div>}
    </div>
  );
}
