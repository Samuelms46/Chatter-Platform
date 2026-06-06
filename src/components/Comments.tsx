import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: { username: string };
  replies?: Comment[];
}

interface Props {
  postId: string;
}

const CommentItem = ({
  comment,
  postId,
  depth = 0,
}: {
  comment: Comment;
  postId: string;
  depth?: number;
}) => {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !replyText.trim()) return;
    setLoading(true);
    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: replyText.trim(),
      parent_id: comment.id,
    });
    setReplyText("");
    setReplying(false);
    setLoading(false);
  };

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-gray-100 pl-4" : ""}>
      <div className="bg-gray-50 rounded-lg p-4 mb-2">
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
        <p className="text-gray-700 text-sm mb-2">{comment.content}</p>

        {/* Only allow replies at depth 0 — PRD: 2 levels max */}
        {user && depth === 0 && (
          <button
            onClick={() => setReplying((v) => !v)}
            className="text-xs text-gray-400 hover:text-blue-600 transition"
          >
            {replying ? "Cancel" : "Reply"}
          </button>
        )}
      </div>

      {replying && (
        <form onSubmit={submitReply} className="mb-3 ml-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${comment.profiles?.username}…`}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
          <button
            type="submit"
            disabled={loading || !replyText.trim()}
            className="mt-1 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Posting…" : "Post Reply"}
          </button>
        </form>
      )}

      {/* Render replies (depth 1) */}
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} postId={postId} depth={1} />
      ))}
    </div>
  );
};

const Comments = ({ postId }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  const buildTree = (flat: Comment[]): Comment[] => {
    const map = new Map<string, Comment>();
    flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
    const roots: Comment[] = [];
    map.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies!.push(c);
      } else {
        roots.push(c);
      }
    });
    return roots;
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("comments")
        .select(`*, profiles(username)`)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (data) setComments(buildTree(data as Comment[]));
    })();

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        async () => {
          // Re-fetch and rebuild tree on any new comment or reply
          const { data } = await supabase
            .from("comments")
            .select(`*, profiles(username)`)
            .eq("post_id", postId)
            .order("created_at", { ascending: true });
          if (data) setComments(buildTree(data as Comment[]));
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

  const totalCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ?? 0),
    0,
  );

  return (
    <div className="mt-12">
      <h3 className="text-xl font-bold mb-6">{totalCount} Comments</h3>

      {user && (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment…"
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Posting…" : "Post Comment"}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} postId={postId} />
        ))}
      </div>
    </div>
  );
};

export default Comments;
