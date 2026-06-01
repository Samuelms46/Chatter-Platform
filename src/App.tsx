import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreatePost from "./pages/CreatePost";
import Feed from "./pages/Feed";
import PostPage from "./pages/PostPage";
import Navbar from "./components/Navbar";

const App = () => {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Navbar />
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
        <Route path="/" element={user ? <Feed /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
