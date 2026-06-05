import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
  read_time: number;
  created_at: string;
  author_id: string;
  username: string;
  avatar_url: string | null;
  relevance?: number;
  profiles?: { username: string; avatar_url: string | null };
}

interface TrendingPost {
  id: string;
  title: string;
  read_time: number;
  view_count: number;
  username: string;
}

type PostRow = Omit<Post, "username" | "avatar_url"> & {
  profiles?: { username: string; avatar_url: string | null } | null;
};

type Tab = "for_you" | "featured";

const PAGE_SIZE = 10;

const Feed = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("for_you");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const cursorRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_trending_posts", { p_limit: 5 });
      if (data) setTrending(data as TrendingPost[]);
    })();
  }, []);

  const fetchForYou = useCallback(
    async (cursor: string | null): Promise<Post[]> => {
      const { data, error } = await supabase.rpc("get_personalized_feed", {
        p_user_id: user!.id,
        p_limit: PAGE_SIZE,
        p_cursor: cursor ?? new Date().toISOString(),
      });
      if (error) {
        console.error(error);
        return [];
      }
      return (data ?? []) as Post[];
    },
    [user],
  );

  const fetchFeatured = useCallback(
    async (cursor: string | null): Promise<Post[]> => {
      let query = supabase
        .from("posts")
        .select(`*, profiles(username, avatar_url)`)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cursor) query = query.lt("created_at", cursor);

      const { data, error } = await query;
      if (error) {
        console.error(error);
        return [];
      }

      return ((data ?? []) as PostRow[]).map((p) => ({
        ...p,
        username: p.profiles?.username,
        avatar_url: p.profiles?.avatar_url,
      })) as Post[];
    },
    [],
  );

  const fetchPosts = useCallback(
    async (cursor: string | null) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);

      const data =
        tab === "for_you" && user
          ? await fetchForYou(cursor)
          : await fetchFeatured(cursor);

      setPosts((prev) => (cursor ? [...prev, ...data] : data));
      setHasMore(data.length === PAGE_SIZE);
      if (data.length > 0) cursorRef.current = data[data.length - 1].created_at;

      if (cursor) setLoadingMore(false);
      else setLoading(false);
    },
    [tab, user, fetchForYou, fetchFeatured],
  );

  useEffect(() => {
    cursorRef.current = null;
    (async () => {
      await fetchPosts(null);
    })();
  }, [fetchPosts]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          (async () => {
            await fetchPosts(cursorRef.current);
          })();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchPosts]);

  const getPreview = (content: string) =>
    content
      .replace(/[#*`_~>[\]!]/g, "")
      .trim()
      .slice(0, 150);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Chatter Feed</h1>
        <Link
          to="/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Write Post
        </Link>
      </div>

      <div className="flex gap-8">
        {/* Main feed column */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-6 border-b mb-8">
            {(["for_you", "featured"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-sm font-medium transition ${
                  tab === t
                    ? "border-b-2 border-black text-black"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "for_you" ? "For You" : "Featured"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-12">
              Loading posts…
            </div>
          ) : posts.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              {tab === "for_you"
                ? "Follow some authors or tags to personalise your feed."
                : "No posts yet. Be the first to write!"}
            </p>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white border rounded-xl p-6 hover:shadow-md transition"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                      {post.username?.[0]?.toUpperCase()}
                    </div>
                    <Link
                      to={`/profile/${post.username}`}
                      className="text-sm text-gray-600 hover:text-blue-600"
                    >
                      {post.username}
                    </Link>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-400">
                      {new Date(post.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-400">
                      {post.read_time} min read
                    </span>
                  </div>

                  <Link to={`/post/${post.id}`}>
                    <h2 className="text-xl font-bold mb-2 hover:text-blue-600 transition">
                      {post.title}
                    </h2>
                  </Link>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {getPreview(post.content)}…
                  </p>

                  {post.tags?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
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
                </div>
              ))}
            </div>
          )}

          <div
            ref={sentinelRef}
            className="py-4 text-center text-sm text-gray-400"
          >
            {loadingMore && "Loading more posts…"}
            {!hasMore && posts.length > 0 && "You're all caught up."}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-8">
            <h2 className="text-base font-semibold mb-4">Trending today</h2>
            {trending.length === 0 ? (
              <p className="text-sm text-gray-400">No trending posts yet.</p>
            ) : (
              <div className="space-y-4">
                {trending.map((post, i) => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="flex gap-3 group"
                  >
                    <span className="text-2xl font-bold text-gray-200 group-hover:text-gray-300 transition leading-none">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        {post.username}
                      </p>
                      <p className="text-sm font-medium leading-snug group-hover:text-blue-600 transition line-clamp-2">
                        {post.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {post.read_time} min read · {post.view_count} views
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Feed;
