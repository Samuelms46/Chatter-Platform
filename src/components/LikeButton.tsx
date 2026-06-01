import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Props {
  postId: string;
}

const LikeButton = ({ postId }: Props) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLikes = async () => {
      const { data } = await supabase
        .from("likes")
        .select("*")
        .eq("post_id", postId);

      setCount(data?.length || 0);

      if (user) {
        const userLiked = data?.some((like) => like.user_id === user.id);
        setLiked(!!userLiked);
      }
    };

    fetchLikes();
  }, [postId, user]);

  const toggleLike = async () => {
    if (!user || loading) return;
    setLoading(true);

    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      setCount((c) => c - 1);
      setLiked(false);
    } else {
      await supabase.from("likes").insert({
        post_id: postId,
        user_id: user.id,
      });
      setCount((c) => c + 1);
      setLiked(true);
    }

    setLoading(false);
  };

  return (
    <button
      onClick={toggleLike}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition ${
        liked
          ? "bg-red-50 border-red-300 text-red-500"
          : "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"
      }`}
    >
      <span>{liked ? "❤️" : "🤍"}</span>
      <span>
        {count} {count === 1 ? "Like" : "Likes"}
      </span>
    </button>
  );
};

export default LikeButton;
