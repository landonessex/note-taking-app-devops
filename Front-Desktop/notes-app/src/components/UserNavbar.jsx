import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
// This component is for user Navbar
const UserNavbar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear user session
    navigate("/");
  };

  return (
    <motion.nav
      className="w-full bg-white/10 backdrop-blur-lg text-white fixed top-0 left-0 shadow-md border-b border-white/20 z-50"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold tracking-wide">
          📝 Noteworthy
        </Link>

        {/* Navigation Links */}
        <div className="space-x-6 flex">
          <Link to="/userprofile" className="hover:text-gray-300 transition">
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="hover:text-red-400 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </motion.nav>
  );
};

export default UserNavbar;
