import { useEffect, useMemo, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

type PostStatus = "draft" | "published" | "archived";

const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<PostStatus>("draft");

  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // ── Autosave / server-sync state
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [serverSavedAt, setServerSavedAt] = useState<string | null>(null);

  // ── Image-upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Draft snapshot ref (avoids stale closure in setInterval)
  const draftSnapshot = useRef({
    title: "",
    content: "",
    tags: "",
    status: "draft" as PostStatus,
  });
  const restoredDraft = useRef(false);

  // ── Stable localStorage keys scoped to the current user
  const draftKey = useMemo(
    () => (user?.id ? `chatter:draft:${user.id}` : null),
    [user?.id],
  );
  const serverIdKey = useMemo(
    () => (draftKey ? `${draftKey}:serverId` : null),
    [draftKey],
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const calculateReadTime = (text: string): number => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return Math.max(1, Math.ceil(words / 200));
  };

  const normalizeTags = (value: string): string[] =>
    Array.from(
      new Set(
        value
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).slice(0, 5);

  // ─── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    draftSnapshot.current = { title, content, tags, status };
  }, [title, content, tags, status]);

  useEffect(() => {
    if (!draftKey || restoredDraft.current) return;
    restoredDraft.current = true;

    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        title?: string;
        content?: string;
        tags?: string;
        status?: PostStatus;
        savedAt?: string;
      };
      queueMicrotask(() => {
        setTitle(parsed.title ?? "");
        setContent(parsed.content ?? "");
        setTags(parsed.tags ?? "");
        setStatus(parsed.status ?? "draft");
        setLastSavedAt(parsed.savedAt ?? null);
      });
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  /** Restore the server-side draft ID from localStorage */
  useEffect(() => {
    if (!serverIdKey) return;
    const id = window.localStorage.getItem(serverIdKey);
    if (id) {
      queueMicrotask(() => setServerDraftId(id));
    }
  }, [serverIdKey]);

  // ─── Draft persistence ────────────────────────────────────────────────────────

  const persistDraftToSupabase = async (): Promise<void> => {
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
      status: draftSnapshot.current.status ?? "draft",
      read_time: calculateReadTime(cleanContent),
      updated_at: new Date().toISOString(),
    };

    setSyncing(true);
    try {
      if (!serverDraftId) {
        const { data, error: insertError } = await supabase
          .from("posts")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        setServerDraftId(data.id as string);
        if (serverIdKey)
          window.localStorage.setItem(serverIdKey, data.id as string);
      } else {
        const { error: updateError } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", serverDraftId);
        if (updateError) throw updateError;
      }

      // On success clear the local fallback copy
      if (draftKey) window.localStorage.removeItem(draftKey);
      const now = new Date().toISOString();
      setLastSavedAt(now);
      setServerSavedAt(now);
    } catch (err) {
      // Keep a local copy as fallback
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
      console.warn("Draft sync to server failed — saved locally instead:", err);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Save locally first (instant feedback), then attempt server sync.
   */
  async function persistDraft(): Promise<void> {
    if (!draftKey) return;

    const {
      title: t,
      content: c,
      tags: tg,
      status: st,
    } = draftSnapshot.current;
    if (!t.trim() || !c.trim()) return;

    setSavingDraft(true);
    const savedAt = new Date().toISOString();
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({ title: t, content: c, tags: tg, status: st, savedAt }),
    );
    setLastSavedAt(savedAt);
    setSavingDraft(false);

    // Fire-and-forget server sync — does not block UI
    void persistDraftToSupabase();
  }

  useEffect(() => {
    if (!draftKey) return;
    const intervalId = window.setInterval(() => {
      void persistDraft();
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // ─── Publish / Archive ────────────────────────────────────────────────────────

  /**
   * Final save — creates a new published/archived post row.
   * Draft → Published → Archived workflow.
   */
  const handleSave = async (
    publish: boolean,
    forcedStatus?: PostStatus,
  ): Promise<void> => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const rawTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const cleanTags = normalizeTags(tags);

    if (!cleanTitle || !cleanContent) {
      setError("Title and content are required.");
      return;
    }

    if (rawTags.length > 5) {
      setError("You can add up to 5 tags only.");
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

    const { error: saveError } = await supabase.from("posts").insert({
      title: cleanTitle,
      content: cleanContent,
      author_id: user?.id,
      tags: cleanTags,
      is_published: nextStatus === "published",
      status: nextStatus,
      read_time: calculateReadTime(cleanContent),
    });

    if (saveError) {
      setError(saveError.message);
      setLoading(false);
      return;
    }

    // Clean up draft artifacts from both localStorage and server row
    if (draftKey) window.localStorage.removeItem(draftKey);
    if (serverIdKey) window.localStorage.removeItem(serverIdKey);

    navigate("/");
  };

  /** Button handler: manual "Save Draft" click — saves locally then syncs */
  const handleDraftSave = async (): Promise<void> => {
    setError("");
    if (!title.trim() || !content.trim()) {
      setError("Add a title and some content before saving a draft.");
      return;
    }
    await persistDraft();
    await persistDraftToSupabase();
  };

  // ─── Derived values ───────────────────────────────────────────────────────────
  const parsedTags = normalizeTags(tags);
  const readTime = calculateReadTime(content);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Create Post</h1>

      {/* ── Error banner ── */}
      {error && (
        <p className="text-red-500 mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm">
          {error}
        </p>
      )}

      {/* ── Status bar: draft status pill + save indicator ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span className="rounded-full bg-gray-100 px-3 py-1 capitalize text-gray-700 font-medium">
          {status}
        </span>

        {/* PRD: Post status workflow — Draft / Published / Archived */}
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

        {/* PRD: visible "Saved" indicator */}
        <span className="ml-auto text-xs text-gray-400">
          {syncing
            ? "⟳ Syncing…"
            : serverSavedAt
              ? `✓ Saved to server at ${new Date(serverSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : lastSavedAt
                ? `✓ Saved locally at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "Not saved yet"}
        </span>
      </div>

      {/* image upload from editor to Supabase Storage */}
      <div className="mb-4 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            setUploadError(null);
            const file = e.target.files?.[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
              setUploadError("Image too large (max 5 MB).");
              return;
            }

            setUploadingImage(true);
            try {
              const path = `${user?.id ?? "anon"}/${Date.now()}_${file.name}`;
              const { error: uploadErr } = await supabase.storage
                .from("images")
                .upload(path, file);
              if (uploadErr) throw uploadErr;

              const { data: urlData } = supabase.storage
                .from("images")
                .getPublicUrl(path);

              // Insert Markdown image syntax at end of content
              setContent(
                (prev) => `${prev}\n\n![${file.name}](${urlData.publicUrl})\n`,
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Upload failed.";
              setUploadError(msg);
            } finally {
              setUploadingImage(false);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition"
        >
          {uploadingImage ? "Uploading…" : "📎 Upload Image"}
        </button>
        {uploadError && (
          <span className="text-sm text-red-500">{uploadError}</span>
        )}
      </div>

      {/* ── Title input ── */}
      <input
        type="text"
        placeholder="Post title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-semibold border-b pb-2 mb-6 focus:outline-none"
      />

      {/* ── Tags input — PRD: up to 5 tags from predefined taxonomy ── */}
      <div className="mb-2">
        <input
          type="text"
          placeholder="Tags (comma-separated, up to 5)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tag count + preview pills */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">
          {parsedTags.length}/5 tags
        </span>
        {parsedTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-gray-300 px-3 py-0.5 text-xs text-gray-600"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* PRD: estimated reading time displayed */}
      <p className="mb-6 text-xs text-gray-400">
        Estimated read time: {readTime} min
      </p>

      {/* ── Markdown editor — PRD: rich Markdown editor with live preview ── */}
      <div data-color-mode="light" className="mb-6">
        <MDEditor
          value={content}
          onChange={(val: string | undefined) => setContent(val ?? "")}
          height={400}
          preview="live"
        />
      </div>

      {/*  Action buttons Draft / Publish / Archive workflow */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => void handleDraftSave()}
          disabled={loading || savingDraft}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          {savingDraft ? "Saving…" : "Save Draft"}
        </button>

        <button
          onClick={() => void handleSave(true)}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Publishing…" : "Publish"}
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
