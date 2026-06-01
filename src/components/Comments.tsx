import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string };
}

interface Props {
  postId: string;
}

const Comments = ({ postId }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from("comments")
        .select(`*, profiles(username)`)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      setComments(data || []);
    };

    fetchComments();

    // Realtime subscription
    const channel = supabase
      .channel("comments")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setComments((prev) => [...prev, payload.new as Comment]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    setLoading(true);

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment("");
    setLoading(false);
  };

  return (
    <div className="mt-12">
      <h3 className="text-xl font-bold mb-6">{comments.length} Comments</h3>

      {user && (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Comment"}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {comment.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <span className="font-medium text-sm">
                {comment.profiles?.username}
              </span>
              <span className="text-gray-400 text-xs">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-gray-700 text-sm">{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Comments;
