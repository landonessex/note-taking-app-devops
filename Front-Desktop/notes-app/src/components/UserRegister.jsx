import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
// This component is for user regitration
const UserRegister = () => {
  const [username, setUsername] = useState(""); // Changed from name to username
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
// register function, users need to input the username, email and password
 const handleRegister = async () => {
   setError(""); // Clear previous error

   try {
     const response = await fetch("https://localhost:7272/api/User/Register", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ username, email, password }),
     });

     const data = await response.json();

     // If the response is not ok, throw an error
     if (!response.ok) {
       // If response is not OK, check for validation errors
       if (data.errors) {
         // If there are validation errors, join them into a single message
         throw new Error(
           Object.values(data.errors).flat().join(", ") || "Registration failed"
         );
       } else {
         throw new Error(data.message || "Registration failed");
       }
     }

     // Redirect to login after successful registration
     navigate("/userlogin");
   } catch (err) {
     setError(err.message); // Set error message to state
   }
 };
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600 text-white">
      <motion.div
        className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-lg border border-white/20 text-center w-96"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold mb-6 text-gray-100">
          Create an Account
        </h2>

        {error && <p className="text-red-400">{error}</p>}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Username"
            className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRegister}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white px-5 py-2 rounded-full shadow-md transition duration-300"
        >
          Sign Up
        </motion.button>

        <p className="mt-4 text-gray-200 text-sm">
          Already have an account?{" "}
          <Link to="/userlogin" className="text-yellow-300 hover:underline">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default UserRegister;
