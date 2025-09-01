// src/pages/Mood.jsx
import React, { useState, useEffect } from "react";
import { supabase, useAuth } from "../supabase.jsx";
import { useNavigate } from "react-router-dom";

export default function MoodTracker() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState(3);
  const [recommendation, setRecommendation] = useState("");
  const [recoId, setRecoId] = useState(null);       // ✅ track current recommendation id
  const [recoList, setRecoList] = useState([]);     // ✅ track all fetched recos
  const [done, setDone] = useState(false);          // ✅ mark if action completed
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load past mood check-ins
  useEffect(() => {
    if (!session?.user) return;

    async function fetchHistory() {
      const { data, error } = await supabase
        .from("mood_checkins")
        .select("id, energy, created_at, moods(label)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) console.error("⚠️ Error fetching mood history:", error);
      else {
        setHistory(
          (data || []).map((d) => ({
            id: d.id,
            mood: d.moods?.label,
            energy: d.energy,
            created_at: d.created_at,
          }))
        );
      }
    }

    fetchHistory();
  }, [session]);

  // Submit mood + energy
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mood || !energy) return;

    setSaving(true);

    // 1. Look up mood_id
    const { data: moodRow, error: moodErr } = await supabase
      .from("moods")
      .select("id")
      .eq("label", mood)
      .maybeSingle();

    if (moodErr || !moodRow) {
      console.error("⚠️ Mood not found:", moodErr);
      setSaving(false);
      return;
    }

    const energyVal = Number(energy);

    // 2. Insert mood check-in
    const { error: insertError } = await supabase.from("mood_checkins").insert([
      {
        user_id: session.user.id,
        mood_id: moodRow.id,
        energy: energyVal,
      },
    ]);

    if (insertError) {
      console.error("⚠️ Error saving mood:", insertError);
      setSaving(false);
      return;
    }

    // 3. Fetch recommendation (with ID for tracking)
    const { data: recos, error: recoError } = await supabase
      .from("recommendations")
      .select("id, text")
      .eq("mood_id", moodRow.id)
      .lte("energy_min", energyVal)
      .gte("energy_max", energyVal);

    console.log("Reco Query Debug:", { energyVal, moodRow, recos, recoError });

    if (recoError) {
      console.error("⚠️ Error fetching recommendations:", recoError);
    }

    if (Array.isArray(recos) && recos.length > 0) {
      setRecoList(recos); // save the list for Try Another
      const random = recos[Math.floor(Math.random() * recos.length)];
      setRecommendation(random.text);
      setRecoId(random.id);
      setDone(false);
    } else {
      setRecommendation("No tailored recommendation found. Try relaxing or doing a short activity.");
      setRecoId(null);
      setRecoList([]);
      setDone(false);
    }

    // 4. Refresh mood history
    const { data: newHistory } = await supabase
      .from("mood_checkins")
      .select("id, energy, created_at, moods(label)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setHistory(
      (newHistory || []).map((d) => ({
        id: d.id,
        mood: d.moods?.label,
        energy: d.energy,
        created_at: d.created_at,
      }))
    );

    setSaving(false);
    setMood("");
    setEnergy(3);
  };

  // ✅ Log action when student marks recommendation as done
  const handleMarkDone = async () => {
  if (!recoId) return;

  const { error } = await supabase.from("recommendation_actions").insert([
    {
      user_id: session.user.id,
      recommendation_id: recoId,
      status: "done",  // ✅ important for streak calculation
      created_at: new Date().toISOString(), // optional if your DB has default
    },
  ]);

  if (error) {
    console.error("⚠️ Failed to log action:", error);
  } else {
    setDone(true);
    setRecoId(null); // hide action buttons after logging
  }
};

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      {/* Back button */}
      
      <h1 className="text-2xl font-bold text-purple-700 mb-4">
        How are you feeling today?
      </h1>

      {/* Mood form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-xl p-6 w-full max-w-md space-y-4"
      >
        {/* Mood Dropdown with Emojis */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mood
          </label>
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="w-full border rounded-lg p-2"
            required
          >
            <option value="">-- Select Mood --</option>
            <option value="happy">😊 Happy</option>
            <option value="sad">😢 Sad</option>
            <option value="stressed">😰 Stressed</option>
            <option value="angry">😡 Angry</option>
            <option value="relaxed">😌 Relaxed</option>
            <option value="tired">🥱 Tired</option>
          </select>
        </div>

        {/* Energy level (1–5) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Energy Level ({energy})
          </label>
          <input
            type="range"
            min="1"
            max="5"
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1</span>
            <span>3</span>
            <span>5</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Mood"}
        </button>
      </form>

      {/* Recommendation box */}
      {recommendation && (
        <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded w-full max-w-md">
          <p className="text-yellow-800 font-medium">Recommendation</p>
          <p className="text-gray-700 mb-3">{recommendation}</p>

          {!done && recoId && (
            <div className="flex gap-2">
              <button
                onClick={handleMarkDone}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Mark as Done
              </button>
              {recoList.length > 1 && (
                <button
                  onClick={() => {
                    const others = recoList.filter((r) => r.id !== recoId);
                    if (others.length > 0) {
                      const random = others[Math.floor(Math.random() * others.length)];
                      setRecommendation(random.text);
                      setRecoId(random.id);
                    }
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Try Another
                </button>
              )}
            </div>
          )}

          {done && (
            <p className="text-green-700 font-medium mt-2">
              ✅ Great job! Action logged.
            </p>
          )}
        </div>
      )}

      {/* Mood history */}
      <div className="mt-8 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Your Recent Moods
        </h2>
        <div className="max-h-60 overflow-y-auto border rounded-lg bg-white shadow p-3">
          {history.length > 0 ? (
            history.map((entry) => (
              <div
                key={entry.id}
                className="flex justify-between border-b py-2 text-sm text-gray-700"
              >
                <span>
                  {entry.mood} ({entry.energy}/5)
                </span>
                <span className="text-gray-500">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No mood records yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
