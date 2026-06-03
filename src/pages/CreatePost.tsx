import { useEffect, useMemo, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

type PostStatus = "draft" | "published" | "archived";
const AUTOSAVE_INTERVAL_MS = 30_000;

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<PostStatus>("draft");
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [serverSavedAt, setServerSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const draftKey = useMemo(
    () => (user?.id ? `chatter:draft:${user.id}` : null),
    [user?.id],
  );
  const serverIdKey = useMemo(
    () => (draftKey ? `${draftKey}:serverId` : null),
    [draftKey],
  );

  const calculateReadTime = (text: string) => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return Math.ceil(words / 200);
  };

  const normalizeTags = (value: string) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);

  // snapshot used for autosave to avoid stale closures
  const draftSnapshot = useRef({
    title: "",
    content: "",
    tags: "",
    status: "draft" as PostStatus,
  });
  useEffect(() => {
    draftSnapshot.current = { title, content, tags, status };
  }, [title, content, tags, status]);

  // restore any local draft on mount
  useEffect(() => {
    if (!draftKey) return;
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        title?: string;
        content?: string;
        tags?: string;
        status?: PostStatus;
        savedAt?: string;
      };
      setTitle(parsed.title || "");
      setContent(parsed.content || "");
      setTags(parsed.tags || "");
      setStatus(parsed.status || "draft");
      setLastSavedAt(parsed.savedAt || null);
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  // restore serverDraftId if present
  useEffect(() => {
    if (!serverIdKey) return;
    const id = window.localStorage.getItem(serverIdKey);
    if (id) setServerDraftId(id);
  }, [serverIdKey]);

  // autosave loop (local first, then fire-and-forget server sync)
  useEffect(() => {
    if (!draftKey) return;
    const interval = window.setInterval(() => {
      void persistDraft();
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [draftKey]);

  const persistDraftToSupabase = async () => {
    if (!user?.id) return;
    const cleanTitle = draftSnapshot.current.title.trim();
    const cleanContent = draftSnapshot.current.content.trim();
    if (!cleanTitle || !cleanContent) return;

    const payload = {
      title: cleanTitle,
      content: cleanContent,
      tags: normalizeTags(draftSnapshot.current.tags),
      author_id: user.id,
      is_published: false,
      status: draftSnapshot.current.status || "draft",
      read_time: calculateReadTime(cleanContent),
      updated_at: new Date().toISOString(),
    } as any;

    setSyncing(true);
    try {
      if (!serverDraftId) {
        const { data, error } = await supabase
          .from("posts")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setServerDraftId(data.id);
        if (serverIdKey) window.localStorage.setItem(serverIdKey, data.id);
      } else {
        const { error } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", serverDraftId);
        if (error) throw error;
      }
      // on success remove local fallback
      if (draftKey) window.localStorage.removeItem(draftKey);
      const now = new Date().toISOString();
      setLastSavedAt(now);
      setServerSavedAt(now);
    } catch (err) {
      if (draftKey) {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            title: draftSnapshot.current.title,
            content: draftSnapshot.current.content,
            tags: draftSnapshot.current.tags,
            status: draftSnapshot.current.status,
            savedAt: new Date().toISOString(),
          }),
        );
      }
      console.warn("Draft sync failed, saved locally", err);
    } finally {
      setSyncing(false);
    }
  };

  const persistDraft = async () => {
    if (!draftKey) return;
    const {
      title: dt,
      content: dc,
      tags: dtags,
      status: dstatus,
    } = draftSnapshot.current;
    if (!dt.trim() || !dc.trim()) return;
    const savedAt = new Date().toISOString();
    setSavingDraft(true);
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        title: dt,
        content: dc,
        tags: dtags,
        status: dstatus,
        savedAt,
      }),
    );
    setLastSavedAt(savedAt);
    setSavingDraft(false);
    void persistDraftToSupabase();
  };

  const handleSave = async (publish: boolean, forcedStatus?: PostStatus) => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const rawTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const cleanTags = normalizeTags(tags);

    if (!cleanTitle || !cleanContent) {
      setError("Title and content are required");
      return;
    }
    if (rawTags.length > 5) {
      setError("You can add up to 5 tags only");
      return;
    }

    setLoading(true);
    setError("");

    const nextStatus: PostStatus = forcedStatus
      ? forcedStatus
      : publish
        ? "published"
        : status === "archived"
          ? "archived"
          : "draft";

    const { error } = await supabase
      .from("posts")
      .insert({
        title: cleanTitle,
        content: cleanContent,
        author_id: user?.id,
        tags: cleanTags,
        is_published: nextStatus === "published",
        status: nextStatus,
        read_time: calculateReadTime(cleanContent),
      });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (draftKey) window.localStorage.removeItem(draftKey);
      navigate("/");
    }
  };

  const handleDraftSave = async () => {
    setError("");
    if (!title.trim() || !content.trim()) {
      setError("Add a title and content before saving a draft");
      return;
    }
    await persistDraft();
    await persistDraftToSupabase();
  };

  // image upload handler
  const handleFileInput = async (file?: File | null) => {
    setUploadError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image too large (max 5MB)");
      return;
    }

    setUploadingImage(true);
    try {
      const path = `${user?.id || "anon"}/${Date.now()}_${file.name}`;
      const uploadRes = await supabase.storage
        .from("images")
        .upload(path, file);
      if (uploadRes.error) throw uploadRes.error;
      const publicRes = await supabase.storage
        .from("images")
        .getPublicUrl(path);
      const publicUrl = publicRes.data.publicUrl;
      setContent((c) => `${c}\n\n![${file.name}](${publicUrl})\n`);
    } catch (err: any) {
      console.error(err);
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Create Post</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span className="rounded-full bg-gray-100 px-3 py-1 capitalize text-gray-700">
          {status}
        </span>
        <label className="flex items-center gap-2">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className="rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <span>
          {syncing
            ? "Syncing..."
            : serverSavedAt
              ? `Saved to server ${new Date(serverSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : lastSavedAt
                ? `Saved locally ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "Not saved yet"}
        </span>
      </div>

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileInput(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 mr-3 border rounded-lg text-sm hover:bg-gray-50"
        >
          {uploadingImage ? "Uploading..." : "Upload Image"}
        </button>
        {uploadError && (
          <span className="text-sm text-red-500">{uploadError}</span>
        )}
      </div>

      <input
        type="text"
        placeholder="Post title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-semibold border-b pb-2 mb-6 focus:outline-none"
      />

      <input
        type="text"
        placeholder="Tags (comma separated, up to 5)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="w-full border rounded-lg px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="mb-6 text-sm text-gray-500">
        {normalizeTags(tags).length}/5 tags used
      </p>

      <div data-color-mode="light" className="mb-6">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val || "")}
          height={400}
          preview="live"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => void handleDraftSave()}
          disabled={loading || savingDraft}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          onClick={() => void handleSave(true)}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Publishing..." : "Publish"}
        </button>
        <button
          onClick={() => void handleSave(false, "archived")}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          Archive
        </button>
      </div>
    </div>
  );
};

export default CreatePost;
