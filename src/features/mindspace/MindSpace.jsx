import React, { useState } from "react";
import { motion } from "framer-motion";
import { supabase, useAuth } from "../../supabase.jsx";

// ShadCN UI components
import { Button } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export default function MindSpace() {
  const { session } = useAuth();

  // State
  const [studyInput, setStudyInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---- Study Buddy ----
// ---- Study Buddy ----
const handleStudyBuddy = async () => {
  if (!studyInput.trim()) return;

  setLoading(true);
  setChatHistory((prev) => [...prev, { role: "user", content: studyInput }]);

  try {
    const res = await fetch(
      "https://upobglkycfhwsohseyuc.functions.supabase.co/study-buddy",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          question: studyInput,
        }),
      }
    );

    const data = await res.json();

    let aiAnswer = "⚠️ No response from AI";
    if (!res.ok) {
      console.error("Function error:", data);
      aiAnswer = "⚠️ Error fetching AI answer";
    } else {
      aiAnswer = data.answer || "⚠️ No response from AI";
    }

    // Update chat history
    setChatHistory((prev) => [
      ...prev,
      { role: "ai", content: aiAnswer },
    ]);
    setStudyInput("");

    // ✅ Save to Supabase for teacher analytics
    await supabase.from("study_sessions").insert({
      user_id: session.user.id,
      question: studyInput,
      answer: aiAnswer,
    });
  } catch (err) {
    setChatHistory((prev) => [
      ...prev,
      { role: "ai", content: "⚠️ Error fetching AI answer" },
    ]);
    console.error(err);
  }

  setLoading(false);
};


  if (!session) return <p className="p-6">Please log in to access MindSpace.</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      {/* Page Header with Back Navigation */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-purple-700">🧠 MindSpace</h1>
        <Button variant="outline" asChild>
          <a href="/dashboard">⬅ Back to Dashboard</a>
        </Button>
      </div>

      {/* Study Buddy Only */}
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>AI Study Buddy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Ask me about Math, Science..."
                value={studyInput}
                onChange={(e) => setStudyInput(e.target.value)}
              />
              <Button onClick={handleStudyBuddy} disabled={loading}>
                {loading ? "Thinking..." : "Ask"}
              </Button>
              <Button variant="secondary" onClick={() => setChatHistory([])}>
                Clear Chat
              </Button>
            </div>
            {chatHistory.length > 0 && (
              <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                {[...chatHistory].reverse().map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100"
                    }`}
                  >
                    {msg.role === "user"
                      ? `👤 You: ${msg.content}`
                      : `🤖 AI: ${msg.content}`}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
