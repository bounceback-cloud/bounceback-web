// src/components/BounceBackModal.jsx
import React from "react";

export default function BounceBackModal({ challenge, onComplete, onSkip }) {
  if (!challenge) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-96 animate-fadeIn">
        <h2 className="text-xl font-bold text-purple-700 mb-3">⚡ Bounce Back Sprint!</h2>
        <p className="text-gray-700 mb-4">{challenge.challenge_text}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onSkip}
            className="px-3 py-1 rounded border border-gray-400 text-gray-600 hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={onComplete}
            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
          >
            ✅ Complete
          </button>
        </div>
      </div>
    </div>
  );
}
