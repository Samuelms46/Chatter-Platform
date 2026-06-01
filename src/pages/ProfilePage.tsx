import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import FollowButton from "../components/FollowButton";

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
  read_time: number;
  created_at: string;
}

const ProfilePage = () => {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profileData) {
        setProfile(profileData);

        const { data: postsData } = await supabase
          .from("posts")
          .select("*")
          .eq("author_id", profileData.id)
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        setPosts(postsData || []);

        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("following_id", profileData.id);

        setFollowerCount(followData?.length || 0);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [username]);

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (!profile)
    return <div className="p-8 text-center">Profile not found.</div>;

  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-white border rounded-xl p-6 mb-8">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
              {profile.username[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">@{profile.username}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {profile.bio || "No bio yet."}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Joined{" "}
                {new Date(profile.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>

          {isOwnProfile ? (
            <Link
              to="/settings"
              className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Edit Profile
            </Link>
          ) : (
            <FollowButton
              profileId={profile.id}
              onFollowChange={(isFollowing) =>
                setFollowerCount((count) => count + (isFollowing ? 1 : -1))
              }
            />
          )}
        </div>

        <div className="mt-4 pt-4 border-t flex gap-6">
          <div className="text-center">
            <p className="font-bold text-lg">{posts.length}</p>
            <p className="text-gray-500 text-xs">Posts</p>
          </div>
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">{followerCount}</p>
          <p className="text-gray-500 text-xs">Followers</p>
        </div>
      </div>

      {/* Posts */}
      <h2 className="text-xl font-bold mb-4">Posts</h2>
      {posts.length === 0 ? (
        <p className="text-gray-500">No published posts yet.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white border rounded-xl p-5 hover:shadow-md transition"
            >
              <Link to={`/post/${post.id}`}>
                <h3 className="font-bold text-lg hover:text-blue-600 transition mb-2">
                  {post.title}
                </h3>
              </Link>
              <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                {post.content.replace(/[#*`]/g, "").slice(0, 120)}...
              </p>
              <div className="flex gap-2">
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

export default ProfilePage;
