import { supabase } from "./lib/supabase";
import { useEffect } from "react";

function App() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Supabase error:", error);
      else console.log("Supabase connected!", data);
    });
  }, []);

  return <div>Chatter</div>;
}

export default App;
