// src/pages/Streak.jsx
import React, { useEffect, useState } from "react";
import { supabase, useAuth } from "../supabase.jsx";

export default function Streak() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [moodStreak, setMoodStreak] = useState(0);
  const [recoStreak, setRecoStreak] = useState(0);
  const [comebacks, setComebacks] = useState([]);

  // Streak calculator
  const calcStreak = (records) => {
    if (!records?.length) return 0;
    const dates = [...new Set(records.map(r =>
      new Date(r.created_at).toISOString().split("T")[0]
    ))];
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

  async function fetchData() {
    if (!userId) return;

    // Mood streak
    const { data: moods } = await supabase
      .from("mood_checkins")
      .select("created_at")
      .eq("user_id", userId)
      .eq("is_deleted", false);

    setMoodStreak(calcStreak(moods));

    // Recommendation streak
    const { data: recos } = await supabase
      .from("recommendation_actions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("status", "done");

    setRecoStreak(calcStreak(recos));

    // ✅ Fetch completed comeback challenges
    const { data: challenges, error } = await supabase
      .from("comeback_challenges")
      .select("*")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error) setComebacks(challenges || []);
  }

  useEffect(() => {
    fetchData();
  }, [userId]);

  if (!session) return <p className="p-6">Please log in to see streaks.</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-purple-700 mb-6">🔥 Streaks Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Mood streak */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">🙂 Mood Check-ins</h2>
          <p className="text-gray-700">
            Current streak:{" "}
            <span className="font-bold text-purple-600">{moodStreak} days</span>
          </p>
        </div>

        {/* Recommendation streak */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">✅ Recommendations</h2>
          <p className="text-gray-700">
            Current streak:{" "}
            <span className="font-bold text-green-600">{recoStreak} days</span>
          </p>
        </div>

        {/* ✅ Bounce Back challenges */}
        <div className="bg-white shadow-md rounded-xl p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-3">⚡ Bounce Back History</h2>

          {comebacks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-700">
                You’ve saved your streak{" "}
                <span className="font-bold text-blue-600">{comebacks.length}</span>{" "}
                times 🎉
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                {comebacks.map((c) => (
                  <li key={c.id}>
                    {c.challenge_text} —{" "}
                    <span className="text-sm text-gray-500">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-gray-500">No bounce back challenges completed yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
