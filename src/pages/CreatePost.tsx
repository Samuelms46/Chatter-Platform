import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const CreatePost = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const calculateReadTime = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / 200);
  };

  const handleSave = async (publish: boolean) => {
    if (!title || !content) {
      setError("Title and content are required");
      return;
    }

    setLoading(true);
    setError("");
    console.log("Current user:", user);
    console.log("User ID:", user?.id);

    const { error } = await supabase.from("posts").insert({
      title,
      content,
      author_id: user?.id,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      is_published: publish,
      read_time: calculateReadTime(content),
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Create Post</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <input
        type="text"
        placeholder="Post title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-semibold border-b pb-2 mb-6 focus:outline-none"
      />

      <input
        type="text"
        placeholder="Tags (comma separated e.g. react, movies, tech)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="w-full border rounded-lg px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div data-color-mode="light" className="mb-6">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val || "")}
          height={400}
          preview="live"
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => handleSave(false)}
          disabled={loading}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
};

export default CreatePost;
