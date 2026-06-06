import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Props {
  postId: string;
}

const BookmarkButton = ({ postId }: Props) => {
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      setBookmarked(!!data);
    })();
  }, [postId, user]);

  const toggleBookmark = async () => {
    if (!user || loading) return;
    setLoading(true);

    if (bookmarked) {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      setBookmarked(false);
    } else {
      await supabase
        .from("bookmarks")
        .insert({ post_id: postId, user_id: user.id });
      setBookmarked(true);
    }

    setLoading(false);
  };

  return (
    <button
      onClick={toggleBookmark}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition disabled:opacity-50 ${
        bookmarked
          ? "bg-yellow-50 border-yellow-400 text-yellow-600"
          : "border-gray-300 text-gray-500 hover:border-yellow-400 hover:text-yellow-600"
      }`}
    >
      <span>{bookmarked ? "🔖" : "📄"}</span>
      <span>{bookmarked ? "Saved" : "Bookmark"}</span>
    </button>
  );
};

export default BookmarkButton;
