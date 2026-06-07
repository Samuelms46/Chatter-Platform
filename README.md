# Chatter

A Medium-inspired full-stack blogging platform built as a capstone project for AltSchool Africa Semester 3.

🌐 **Live Demo:** [https://chatter-platform-qyf1.vercel.app](https://chatter-platform-qyf1.vercel.app)

---

## Features

**Content Creation**

- Rich Markdown editor with live preview
- Image uploads to Supabase Storage
- Autosave drafts every 30 seconds with server sync fallback
- Post status workflow: Draft → Published → Archived
- Up to 5 tags per post with estimated reading time

**Content Discovery**

- Personalised feed ranked by followed authors and tags
- Featured tab with chronological post listing
- Full-text search powered by `pg_trgm` similarity scoring across title, content, and tags
- Trending posts sidebar ranked by views in the last 24 hours
- Cursor-based infinite scroll pagination

**Social Features**

- Like, bookmark, and nested comments (2 levels) on posts
- Author follow/unfollow with real-time follower count
- Tag following from search results
- Real-time notification bell for likes, comments, and follows

**Creator Analytics**

- Post view tracking via Supabase Edge Function
- Analytics events table for per-post engagement data

---

## Tech Stack

| Layer      | Technology                                                   |
| ---------- | ------------------------------------------------------------ |
| Frontend   | React + TypeScript + Vite                                    |
| Styling    | Tailwind CSS v3                                              |
| Backend    | Supabase (Auth, Database, Storage, Edge Functions, Realtime) |
| Routing    | React Router DOM                                             |
| Editor     | @uiw/react-md-editor                                         |
| Rendering  | ReactMarkdown + DOMPurify                                    |
| Charts     | Recharts                                                     |
| Deployment | Vercel                                                       |

---

## Getting Started

### Prerequisites

- Node.js v22+
- npm v11+
- A Supabase project

### Installation

```bash
# Clone the repository
git clone https://github.com/Samuelms46/Chatter-Platform
cd chatter

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Add your Supabase credentials to `.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Comments.tsx
│   ├── LikeButton.tsx
│   ├── BookmarkButton.tsx
│   ├── FollowButton.tsx
│   └── Navbar.tsx
├── context/
│   └── AuthContext.tsx
├── lib/
│   └── supabase.ts
├── pages/
│   ├── Feed.tsx
│   ├── PostPage.tsx
│   ├── CreatePost.tsx
│   ├── ProfilePage.tsx
    ├── Signuptsx
    ├── Settings.tsx
    ├── Login.tsx
│   └── Search.tsx
supabase/
└── functions/
    └── track-post-view/
        └── index.ts
```

---

## Database

Key tables: `posts`, `profiles`, `likes`, `bookmarks`, `comments`, `follows`, `followed_tags`, `notifications`, `analytics_events`

Key RPCs: `get_personalized_feed`, `get_trending_posts`, `search_posts`, `increment_post_views`

---

## Deployment

The app is deployed on Vercel. The Supabase Edge Function is deployed via the Supabase CLI:

```bash
supabase functions deploy track-post-view
```

---

## Author

**Muwanguzi Samuel** — AltSchool Africa Semester 3  
GitHub: [@Samuelms46](https://github.com/Samuelms46)
