import React, { useState, useEffect } from "react";
import { supabase } from "../supabase.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";

export default function TeacherDashboard() {
  const [sessions, setSessions] = useState([]);
  const [moods, setMoods] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [recs, setRecs] = useState([]);

  const [searchUser, setSearchUser] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    fetchSessions();
    fetchMoods();
    fetchStreaks();
    fetchTasks();
    fetchRecs(); 
  }, []);

  const endOfDay = (d) => (d ? d + "T23:59:59" : undefined);

  // =========================
  // Study Sessions (unchanged)
  // =========================
  const fetchSessions = async () => {
    let query = supabase
      .from("study_sessions")
      .select(
        `
        id,
        user_id,
        question,
        answer,
        created_at,
        profiles(email, full_name)
      `
      )
      .order("created_at", { ascending: false });

    if (searchUser.trim()) query = query.eq("user_id", searchUser.trim());
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", endOfDay(toDate));

    const { data, error } = await query;
    if (error) console.error(error);
    else setSessions(data);
  };

  // =========================
  // Mood (energy-based)
  // =========================
  const fetchMoods = async () => {
    let query = supabase
      .from("mood_checkins")
      .select(
        `
        id,
        user_id,
        energy,
        created_at,
        profiles(email, full_name)
      `
      )
      .order("created_at", { ascending: false });

    if (searchUser.trim()) query = query.eq("user_id", searchUser.trim());
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", endOfDay(toDate));

    const { data, error } = await query;
    if (error) console.error(error);
    else setMoods(data);
  };

  // =========================
  // Streaks (days/activity)
  // =========================
  const fetchStreaks = async () => {
    let query = supabase
      .from("streaks")
      .select(
        `
        user_id,
        days,
        activity,
        created_at,
        profiles(email, full_name)
      `
      )
      .order("created_at", { ascending: false });

    if (searchUser.trim()) query = query.eq("user_id", searchUser.trim());
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", endOfDay(toDate));

    const { data, error } = await query;
    if (error) console.error(error);
    else setStreaks(data);
  };

  // =========================
  // Tasks (NEW)
  // =========================
  const fetchTasks = async () => {
    // Try with FK join to profiles first
   let base = supabase
  .from("tasks")
  .select(`
    id,
    user_id,
    title,
    status,
    category,
    priority,
    estimated_minutes,
    scheduled_duration_min,
    notes,
    recurrence,
    created_at,
    updated_at,
    due_at,
    completed_at,
    profiles:profiles(email, full_name)  -- force alias join
  `)
  .order("created_at", { ascending: false });

    if (searchUser.trim()) base = base.eq("user_id", searchUser.trim());
    if (fromDate) base = base.gte("created_at", fromDate);
    if (toDate) base = base.lte("created_at", endOfDay(toDate));

    let { data, error } = await base;

    if (error) {
      console.warn("Falling back to no-join tasks query:", error?.message);
      // Fallback without join
      let noJoin = supabase
        .from("tasks")
        .select(
          `
          id,
          user_id,
          title,
          status,
          category,
          priority,
          estimated_minutes,
          scheduled_duration_min,
          notes,
          recurrence,
          created_at,
          updated_at,
          due_at,
          completed_at
        `
        )
        .order("created_at", { ascending: false });

      if (searchUser.trim()) noJoin = noJoin.eq("user_id", searchUser.trim());
      if (fromDate) noJoin = noJoin.gte("created_at", fromDate);
      if (toDate) noJoin = noJoin.lte("created_at", endOfDay(toDate));

      const res2 = await noJoin;
      data = res2.data;
      error = res2.error;
    }

    if (error) console.error(error);
    else setTasks(data || []);
  };

  const fetchRecs = async () => {
    let query = supabase
      .from("recommendation_actions")
      .select(
        `id, user_id, recommendation_id, status, created_at,
         profiles(email, full_name)`
      )
      .order("created_at", { ascending: false });

    if (searchUser.trim()) query = query.eq("user_id", searchUser.trim());
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", toDate + "T23:59:59");

    const { data, error } = await query;
    if (error) console.error(error);
    else setRecs(data);
  };

  // =================================
  // Study Analytics
  // =================================
  const sessionsPerStudent = sessions.reduce((acc, s) => {
    const email = s.profiles?.email || "Unknown";
    acc[email] = (acc[email] || 0) + 1;
    return acc;
  }, {});
  const topStudents = Object.entries(sessionsPerStudent)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const sessionTrend = sessions.reduce((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = 0;
    acc[date]++;
    return acc;
  }, {});
  const sessionTrendData = Object.entries(sessionTrend).map(([date, count]) => ({
    date,
    count,
  }));

  // =================================
  // Mood Analytics
  // =================================
  const avgMood =
    moods.length > 0
      ? (moods.reduce((sum, m) => sum + m.energy, 0) / moods.length).toFixed(2)
      : "N/A";

  const moodTrend = moods.reduce((acc, m) => {
    const date = new Date(m.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(m.energy);
    return acc;
  }, {});
  const moodTrendData = Object.entries(moodTrend).map(([date, arr]) => ({
    date,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }));

  const moodBuckets = { Low: 0, Medium: 0, High: 0 };
  moods.forEach((m) => {
    if (m.energy <= 3) moodBuckets.Low++;
    else if (m.energy <= 7) moodBuckets.Medium++;
    else moodBuckets.High++;
  });
  const moodDistributionData = Object.entries(moodBuckets).map(
    ([range, count]) => ({ range, count })
  );

  // =================================
  // Streak Analytics
  // =================================
  const longestStreak =
    streaks.length > 0
      ? streaks.reduce((max, s) => (s.days > max.days ? s : max), streaks[0])
      : null;

  const avgStreak =
    streaks.length > 0
      ? (streaks.reduce((sum, s) => sum + s.days, 0) / streaks.length).toFixed(
          2
        )
      : "N/A";

  const streakTrend = streaks.reduce((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(s.days);
    return acc;
  }, {});
  const streakTrendData = Object.entries(streakTrend).map(([date, arr]) => ({
    date,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }));

  const distribution = { "0": 0, "1-3": 0, "4-7": 0, "8+": 0 };
  streaks.forEach((s) => {
    if (s.days === 0) distribution["0"]++;
    else if (s.days <= 3) distribution["1-3"]++;
    else if (s.days <= 7) distribution["4-7"]++;
    else distribution["8+"]++;
  });
  const streakDistributionData = Object.entries(distribution).map(
    ([range, count]) => ({ range, count })
  );

  // =================================
  // Tasks Analytics (NEW)
  // =================================
  const now = new Date();

  const isCompleted = (t) => {
    const s = (t.status || "").toString().toLowerCase();
    return !!t.completed_at || s === "done" || s === "completed";
  };
  const isPending = (t) => !isCompleted(t);
  const isOverdue = (t) =>
    isPending(t) &&
    t.due_at &&
    new Date(t.due_at).getTime() < now.getTime();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(isCompleted).length;
  const pendingTasks = tasks.filter(isPending).length;
  const overdueTasks = tasks.filter(isOverdue).length;
  const completionRate =
    totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : "0.0";

  // Completion trend by date (completed_at if present, else created_at)
  const completionTrend = tasks.reduce((acc, t) => {
    const when = t.completed_at || t.created_at;
    if (!when) return acc;
    const d = new Date(when).toLocaleDateString();
    if (!acc[d]) acc[d] = 0;
    if (isCompleted(t)) acc[d] += 1;
    return acc;
  }, {});
  const completionTrendData = Object.entries(completionTrend)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Category breakdown
  const categoryCounts = tasks.reduce((acc, t) => {
    const c = t.category || "Uncategorized";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const categoryData = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Priority breakdown
  const priorityCounts = tasks.reduce((acc, t) => {
    const p = (t.priority || "unspecified").toString();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const priorityData = Object.entries(priorityCounts).map(
    ([priority, count]) => ({ priority, count })
  );

  // Top students by completed tasks (email if available, else user_id)
  const completedByStudent = tasks.reduce((acc, t) => {
  if (!isCompleted(t)) return acc;
  const label = t.profiles?.email || "Unknown";   // always email if FK works
  acc[label] = (acc[label] || 0) + 1;
  return acc;
}, {});
  const topTaskDoers = Object.entries(completedByStudent)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // A couple of time estimates (optional helpful KPIs)
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const avg = (arr) =>
    arr.length ? (sum(arr) / arr.length).toFixed(1) : "0.0";

  const avgEstimatedMins = avg(tasks.map((t) => t.estimated_minutes || 0));
  const avgScheduledMins = avg(
    tasks.map((t) => t.scheduled_duration_min || 0)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">📊 Teacher Dashboard</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6 w-full max-w-6xl">
        <Input
          placeholder="Search by user_id"
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <Button
          onClick={() => {
            fetchSessions();
            fetchMoods();
            fetchStreaks();
            fetchTasks();
            fetchRecs();
          }}
        >
          Apply Filters
        </Button>
      </div>

      <Tabs defaultValue="study" className="w-full max-w-6xl">
        <TabsList className="grid grid-cols-5 w-full mb-6">
          <TabsTrigger value="study">📖 Study</TabsTrigger>
          <TabsTrigger value="mood">🧘 Mood</TabsTrigger>
          <TabsTrigger value="streaks">🔥 Streaks</TabsTrigger>
          <TabsTrigger value="tasks">✅ Tasks</TabsTrigger>
          <TabsTrigger value="recs">💡 Recommendations</TabsTrigger>
        </TabsList>

        {/* ===================== Study Tab ===================== */}
        <TabsContent value="study">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{sessions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg per Student</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">
                  {Object.keys(sessionsPerStudent).length > 0
                    ? (
                        sessions.length /
                        Object.keys(sessionsPerStudent).length
                      ).toFixed(2)
                    : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sessions Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sessionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#10B981" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Students</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topStudents}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="email" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== Mood Tab ===================== */}
        <TabsContent value="mood">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Average Mood</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{avgMood}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Entries</CardTitle>
              </CardHeader>
              <CardContent>{moods.length}</CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Mood Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={moodTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#3B82F6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mood Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(moodBuckets).map(([range, count]) => ({ range, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== Streaks Tab ===================== */}
        <TabsContent value="streaks">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Longest Streak</CardTitle>
              </CardHeader>
              <CardContent>
                {longestStreak ? (
                  <p>
                    {longestStreak.profiles?.email} →{" "}
                    <span className="font-bold">{longestStreak.days} days</span>
                  </p>
                ) : (
                  "N/A"
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-md font-bold">{avgStreak}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activities Tracked</CardTitle>
              </CardHeader>
              <CardContent>
                {streaks.length > 0 ? (
                  <ul>
                    {[...new Set(streaks.map((s) => s.activity))].map((a, i) => (
                      <li key={i} className="text-sm">{a}</li>
                    ))}
                  </ul>
                ) : (
                  "N/A"
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Streak Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={streakDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#F97316" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg Streak Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={streakTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#F97316" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== Tasks Tab (NEW) ===================== */}
        <TabsContent value="tasks">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{totalTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{completedTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{pendingTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{completionRate}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Completion Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={completionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#0EA5E9" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown (Top 8)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0EA5E9" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Priority Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#06B6D4" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Students by Completed Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topTaskDoers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#06B6D4" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Overdue Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{overdueTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg Estimated (mins)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{avgEstimatedMins}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg Scheduled (mins)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{avgScheduledMins}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===================== Recommendations Tab (placeholder) ===================== */}
         <TabsContent value="recs">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{recs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Acceptance Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">
                  {recs.length > 0
                    ? (
                        (recs.filter((r) => r.status === "accepted").length /
                          recs.length) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Most Recent Action</CardTitle>
              </CardHeader>
              <CardContent>
                {recs.length > 0
                  ? new Date(recs[0].created_at).toLocaleString()
                  : "N/A"}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Engagement Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={Object.entries(
                    recs.reduce((acc, r) => {
                      const d = new Date(r.created_at).toLocaleDateString();
                      acc[d] = (acc[d] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([date, count]) => ({ date, count }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8B5CF6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Students by Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(
                    recs
                      .filter((r) => r.status === "accepted")
                      .reduce((acc, r) => {
                        const email = r.profiles?.email || r.user_id;
                        acc[email] = (acc[email] || 0) + 1;
                        return acc;
                      }, {})
                  )
                    .map(([label, count]) => ({ label, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
