import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";
import Comments from "../components/Comments";
import LikeButton from "../components/LikeButton";
import BookmarkButton from "../components/BookmarkButton";
import { useAuth } from "../context/AuthContext";

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
  read_time: number;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

// Sanitizes the raw Markdown string before passing it to the renderer.
// This strips any injected <script>, event handlers, or malicious HTML
// that could be embedded in the Markdown source.
const sanitize = (raw: string): string =>
  DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "blockquote",
      "code",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "del",
      "input",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "target",
      "rel",
      "type",
      "checked",
      "disabled",
    ],
  });

const PostPage = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles(username, avatar_url)`)
        .eq("id", id)
        .single();

      if (!error) setPost(data as Post);
      setLoading(false);
    };

    // analytics events written on each post view
    const recordView = async () => {
      const { data, error } = await supabase.functions.invoke(
        "track-post-view",
        {
          body: { post_id: id, user_id: user?.id ?? null },
        },
      );
      console.log("track-post-view response:", data, error);
    };

    void fetchPost();
    void recordView();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading post…</div>;
  if (!post) return <div className="p-8 text-center">Post not found.</div>;

  const sanitizedContent = sanitize(post.content);

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      {/* ── Back link ── */}
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-6 block">
        ← Back to Feed
      </Link>

      {/* ── Title ── */}
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

      {/* ── Author row ── */}
      <div className="flex items-center gap-3 mb-6">
        {post.profiles?.avatar_url ? (
          <img
            src={post.profiles.avatar_url}
            alt={post.profiles.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
            {post.profiles?.username?.[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-medium">{post.profiles?.username}</p>
          <p className="text-sm text-gray-400">
            {new Date(post.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {post.read_time} min read
          </p>
        </div>
      </div>

      {/* ── Tags ── */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="prose prose-gray max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {sanitizedContent}
        </ReactMarkdown>
      </div>

      {/* ── Social actions ── */}
      <div className="mt-8 pt-6 border-t flex items-center gap-4">
        <LikeButton postId={post.id} />
        <BookmarkButton postId={post.id} />
      </div>

      {/* ── Comments ── */}
      <Comments postId={post.id} />
    </article>
  );
};

export default PostPage;
