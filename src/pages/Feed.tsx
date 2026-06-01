import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
  read_time: number;
  created_at: string;
  author_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles(username, avatar_url)`)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!error) setPosts(data || []);
      setLoading(false);
    };

    fetchPosts();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading posts...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Chatter Feed</h1>
        <Link
          to="/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Write Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-center">
          No posts yet. Be the first to write!
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
                  {post.profiles?.username?.[0]?.toUpperCase()}
                </div>
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

              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
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
      )}
    </div>
  );
};

export default Feed;
