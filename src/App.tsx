import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreatePost from "./pages/CreatePost";
import Feed from "./pages/Feed";
import PostPage from "./pages/PostPage";

const App = () => {
  const { user, signOut } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" />}
        />
        <Route
          path="/signup"
          element={!user ? <Signup /> : <Navigate to="/" />}
        />
        <Route
          path="/create"
          element={user ? <CreatePost /> : <Navigate to="/login" />}
        />
        <Route path="/post/:id" element={<PostPage />} />
        {/* <Route
          path="/"
          element={
            user ? (
              <div className="p-8">
                <h1 className="text-2xl font-bold">Welcome to Chatter! 🎉</h1>

                <button
                  onClick={signOut}
                  className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg"
                >
                  Sign Out
                </button>
                <a
                  href="/create"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  Create Post
                </a>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        /> */}
        <Route path="/" element={user ? <Feed /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
