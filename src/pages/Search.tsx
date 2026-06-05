import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  tags: string[];
  read_time: number;
  created_at: string;
  similarity_score: number;
  author_username: string;
  author_avatar: string | null;
}

const Search = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [posts, setPosts] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [followedTags, setFollowedTags] = useState<Set<string>>(new Set());

  // Load the user's currently followed tags on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("followed_tags")
        .select("tag")
        .eq("user_id", user.id);
      if (data) setFollowedTags(new Set(data.map((r) => r.tag)));
    })();
  }, [user]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    const { data, error } = await supabase.rpc("search_posts", {
      search_query: q,
    });
    if (error) console.error("Search error:", error);
    setPosts((data as SearchResult[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      const timer = window.setTimeout(() => {
        void handleSearch(q);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams, handleSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    void handleSearch(query);
  };

  const toggleTag = async (tag: string) => {
    if (!user) return;
    const isFollowed = followedTags.has(tag);

    // Optimistic update
    setFollowedTags((prev) => {
      const next = new Set(prev);
      if (isFollowed) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });

    if (isFollowed) {
      await supabase
        .from("followed_tags")
        .delete()
        .eq("user_id", user.id)
        .eq("tag", tag);
    } else {
      await supabase.from("followed_tags").insert({ user_id: user.id, tag });
    }
  };

  const getPreview = (content: string): string =>
    content
      .replace(/[#*`_~>[\]!]/g, "")
      .trim()
      .slice(0, 150);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Search Posts</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, content or tags…"
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {searched && !loading && posts.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No posts found for &ldquo;{query}&rdquo;
        </p>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-white border rounded-xl p-5 hover:shadow-md transition"
          >
            <div className="flex items-center gap-2 mb-2">
              <Link
                to={`/profile/${post.author_username}`}
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                {post.author_username}
              </Link>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-400">
                {post.read_time} min read
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <Link to={`/post/${post.id}`}>
              <h2 className="text-xl font-bold mb-2 hover:text-blue-600 transition">
                {post.title}
              </h2>
            </Link>

            <p className="text-gray-500 text-sm mb-3 line-clamp-2">
              {getPreview(post.content)}…
            </p>

            {post.tags?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.tags.map((tag) => {
                  const followed = followedTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => void toggleTag(tag)}
                      title={followed ? `Unfollow #${tag}` : `Follow #${tag}`}
                      className={`text-xs px-3 py-1 rounded-full border transition ${
                        followed
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-100 text-gray-600 border-transparent hover:border-blue-400"
                      }`}
                    >
                      {followed ? `✓ ${tag}` : tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Search;
