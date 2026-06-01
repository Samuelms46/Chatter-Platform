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
    const fetchFollow = async () => {
      const { data: followers } = await supabase
        .from("follows")
        .select("*")
        .eq("following_id", profileId);

      if (user) {
        const isFollowing = followers?.some((f) => f.follower_id === user.id);
        setFollowing(!!isFollowing);
      }
    };

    fetchFollow();
  }, [profileId, user]);

  const toggleFollow = async () => {
    if (!user || loading) return;
    setLoading(true);

    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("following_id", profileId)
        .eq("follower_id", user.id);
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

  if (user?.id === profileId) return null;

  return (
    <button
      onClick={toggleFollow}
      disabled={loading}
      className={`px-5 py-2 rounded-full text-sm font-medium transition ${
        following
          ? "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-500 border"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {following ? "Unfollow" : "Follow"}
    </button>
  );
};

export default FollowButton;
