import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";

const AdminRegister = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

        {/* Input Fields */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300"
            value={name}
            onChange={(e) => setName(e.target.value)}
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

        {/* Register Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white px-5 py-2 rounded-full shadow-md transition duration-300"
        >
          Sign Up
        </motion.button>

        {/* Login Link */}
        <p className="mt-4 text-gray-200 text-sm">
          Already have an account?{" "}
          <Link to="/adminlogin" className="text-yellow-300 hover:underline">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default AdminRegister;
