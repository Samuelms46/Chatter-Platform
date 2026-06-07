import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Notification {
  id: string;
  type: "like" | "comment" | "follow";
  read: boolean;
  created_at: string;
  post_id: string | null;
  actor: { username: string };
}

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(`*, actor:profiles!notifications_actor_id_fkey(username)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      console.log("notifications data:", data);
      console.log("notifications error:", error);
      if (data) setNotifications(data as Notification[]);
    };
    void fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          await fetchNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBellClick = async () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const getMessage = (n: Notification) => {
    const actor = n.actor?.username ?? "Someone";
    if (n.type === "like") return `${actor} liked your post`;
    if (n.type === "comment") return `${actor} commented on your post`;
    if (n.type === "follow") return `${actor} started following you`;
    return "";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">
          Chatter
        </Link>

        <form
          onSubmit={handleSearch}
          className="hidden md:flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="border rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="text-gray-500 hover:text-blue-600">
            🔍
          </button>
        </form>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                to="/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                Write
              </Link>

              {/* Notification bell */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={handleBellClick}
                  className="relative text-gray-500 hover:text-blue-600 transition"
                  aria-label="Notifications"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b">
                      <p className="font-semibold text-sm">Notifications</p>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">
                        No notifications yet.
                      </p>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto divide-y">
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            className={`px-4 py-3 text-sm transition ${
                              !n.read ? "bg-blue-50" : "hover:bg-gray-50"
                            }`}
                          >
                            {n.post_id ? (
                              <Link
                                to={`/post/${n.post_id}`}
                                onClick={() => setOpen(false)}
                                className="block"
                              >
                                <p className="text-gray-800">{getMessage(n)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(n.created_at).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    },
                                  )}
                                </p>
                              </Link>
                            ) : (
                              <div>
                                <p className="text-gray-800">{getMessage(n)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(n.created_at).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    },
                                  )}
                                </p>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* User avatar + username linking to their profile */}
              <Link
                to={`/profile/${profile?.username}`}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                    {profile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 hidden md:block">
                  {profile?.username}
                </span>
              </Link>

              <button
                onClick={signOut}
                className="text-sm text-gray-600 hover:text-red-500 transition"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
