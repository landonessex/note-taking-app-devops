import { Link } from "react-router-dom";
import { motion } from "framer-motion";
// This component is for Home page UI 
const Home = () => {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-white">
      {/* Animated Title */}
      <motion.h1
        className="text-5xl font-extrabold mb-6 drop-shadow-lg"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        Welcome to <span className="text-yellow-300">Noteworthy</span>
      </motion.h1>

      {/* Animated Subtitle */}
      <motion.p
        className="text-lg mb-8 text-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
      >
        Write smarter, collaborate faster, and stay organized
      </motion.p>

      {/* Glassmorphism Card */}
      <motion.div
        className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-lg border border-white/20 text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
      >
        <div className="flex space-x-4">
          <Link
            to="/Userlogin"
            className="bg-blue-500 hover:bg-blue-600 transition duration-300 text-white px-5 py-2 rounded-full shadow-md"
          >
            User
          </Link>
          <Link
            to="/AdminLogin"
            className="bg-green-500 hover:bg-green-600 transition duration-300 text-white px-5 py-2 rounded-full shadow-md"
          >
            Admin
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Home;
