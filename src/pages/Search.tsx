import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Link, useSearchParams } from "react-router-dom";

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
  read_time: number;
  created_at: string;
  profiles: {
    username: string;
  };
}

const Search = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery || query;
      if (!q.trim()) return;
      setLoading(true);
      setSearched(true);

      const { data } = await supabase
        .from("posts")
        .select(`*, profiles(username)`)
        .eq("is_published", true)
        .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
        .order("created_at", { ascending: false });

      setPosts(data || []);
      setLoading(false);
    },
    [query],
  );

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, [searchParams, handleSearch]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Search Posts</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex gap-2 mb-8"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, content or tags..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {searched && !loading && posts.length === 0 && (
        <p className="text-gray-500 text-center">
          No posts found for "{query}"
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
                to={`/profile/${post.profiles?.username}`}
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                {post.profiles?.username}
              </Link>
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

            <p className="text-gray-500 text-sm mb-3 line-clamp-2">
              {post.content.replace(/[#*`]/g, "").slice(0, 150)}...
            </p>

            <div className="flex gap-2 flex-wrap">
              {post.tags?.map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Search;
