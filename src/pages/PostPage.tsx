import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MDEditor from "@uiw/react-md-editor";

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

const PostPage = () => {
  const { id } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles(username, avatar_url)`)
        .eq("id", id)
        .single();

      if (!error) setPost(data);
      setLoading(false);
    };

    fetchPost();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading post...</div>;
  if (!post) return <div className="p-8 text-center">Post not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-6 block">
        ← Back to Feed
      </Link>

      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
          {post.profiles?.username?.[0]?.toUpperCase()}
        </div>
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

      <div className="flex gap-2 mb-8">
        {post.tags?.map((tag) => (
          <span
            key={tag}
            className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      <div data-color-mode="light">
        <MDEditor.Markdown source={post.content} />
      </div>
    </div>
  );
};

export default PostPage;
