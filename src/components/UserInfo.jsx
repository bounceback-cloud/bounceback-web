import React from "react";
import { useAuth } from "../supabase";

const UserInfo = () => {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading user...</p>;

  if (!user) return <p>No user signed in</p>;

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow">
      <p><strong>User ID:</strong> {user.id}</p>
      <p><strong>Email:</strong> {user.email}</p>
    </div>
  );
};

export default UserInfo;
