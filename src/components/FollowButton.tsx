import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Props {
  profileId: string;
  onFollowChange?: (isFollowing: boolean) => void;
}

const FollowButton = ({ profileId, onFollowChange }: Props) => {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileId)
        .maybeSingle();
      setFollowing(!!data);
    })();
  }, [profileId, user]);

  const toggleFollow = async () => {
    if (!user || loading) return;
    setLoading(true);

    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);
      setFollowing(false);
      onFollowChange?.(false);
    } else {
      await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profileId,
      });
      setFollowing(true);
      onFollowChange?.(true);
    }

    setLoading(false);
  };

  if (!user || user.id === profileId) return null;

  return (
    <button
      onClick={toggleFollow}
      disabled={loading}
      className={`px-5 py-2 rounded-full text-sm font-medium transition disabled:opacity-50 ${
        following
          ? "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-500 border"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {loading ? "…" : following ? "Unfollow" : "Follow"}
    </button>
  );
};

export default FollowButton;
