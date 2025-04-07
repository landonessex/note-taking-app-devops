
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
// This component is for user login
const UserLogin = () => {
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Handle login logic: user input for username and password must match to log in
  const handleLogin = async () => {
    setError(""); // clear previous errors
    try {
      const response = await fetch("https://localhost:7272/api/User/Login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store user info in localStorage and navigate
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("username", data.username);
      localStorage.setItem("email", data.email);
      localStorage.setItem("notes", JSON.stringify(data.notes));

      navigate("/userdashboard"); // log in secessful will navigate to dashboard
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white">
      <motion.div
        className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-lg border border-white/20 text-center w-96"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold mb-6 text-gray-100">
          Welcome to Noteworthy
        </h2>

        {/* Show Error Message */}
        {error && <p className="text-red-400">{error}</p>}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Username" 
            className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full shadow-md transition duration-300"
        >
          Login
        </motion.button>

        {/*Provides a link for users to reset their forgotten password*/}
        <p className="mt-4 text-yellow-300 text-sm">
          <Link to="/userforgot" className="hover:underline">
            Forgot your password?
          </Link>
        </p>

        <p className="mt-4 text-gray-200 text-sm">
          Don't have an account?{" "}
          <Link to="/userregister" className="text-yellow-300 hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default UserLogin;
