// Manages user password reset process including verification, token request, and password update
import { useState } from "react";
import { motion } from "framer-motion";


// Manages the multi-step user password reset process with validation and API interactions
const UserForgot = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [step, setStep] = useState(1);
  const [isSending, setIsSending] = useState(false); // Prevent multiple token requests
  const [confirmPassword, setConfirmPassword] = useState(""); 

  // Verify User
  const handleUserVerification = async () => {
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("https://localhost:7272/api/User/VerifyUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "User verification failed.");

      setSuccessMessage("Verified. You can now request a reset token.");
      setStep(2);
    } catch (err) {
      setError(err.message);
    }
  };

  // Send Reset Token
  const handleSendToken = async () => {
    if (isSending) return;

    setError("");
    setSuccessMessage("");
    setIsSending(true);

    try {
      const response = await fetch("https://localhost:7272/api/User/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error sending reset token.");

      setSuccessMessage("Token has been sent to your email.");
      setStep(3);
    } catch (err) {
      setError(err.message);
      setIsSending(false);
    }
  };


// Reset Password
const handleResetPassword = async () => {
  setError("");
  setSuccessMessage("");

  // Check if passwords match
  if (newPassword !== confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  // Validate password strength
  if (!isValidPassword(newPassword)) {
    setError("Password must be at least 8 characters long, contain an uppercase letter, and a special character.");
    return;
  }

  try {
    const response = await fetch("https://localhost:7272/api/User/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword, confirmPassword }), // Send confirmPassword too
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Invalid token.");

    setSuccessMessage("Your password has been successfully reset.");
    setStep(4);
  } catch (err) {
    setError(err.message);
  }
};

// Password validation function
const isValidPassword = (password) => {
  return password.length >= 8 &&
         /[A-Z]/.test(password) &&  // At least one uppercase letter
         /[^A-Za-z0-9]/.test(password); // At least one special character
};
  
  
// Renders the forgot password UI with step-based navigation and validation
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white">
      <motion.div
        className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-lg border border-white/20 text-center w-96"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold mb-6 text-gray-100">Forgot Password</h2>
  
        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-red-500/20 border border-red-400 text-red-300 font-semibold px-4 py-2 rounded-lg mb-4 flex items-center"
          >
            ❌ {error}
          </motion.div>
        )}
  
        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-green-500/20 border border-green-400 text-green-300 font-semibold px-4 py-2 rounded-lg mb-4"
          >
            ✅ {successMessage}
          </motion.div>
        )}
  
        {/* Step 1: Verify User */}
        {step === 1 && (
          <>
            <input
              type="text"
              placeholder="Username"
              className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300 mb-4"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300 mb-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleUserVerification}
              className="w-full bg-yellow-500 hover:bg-orange-600 text-white px-5 py-2 rounded-full shadow-md transition duration-300"
            >
              Verify User
            </motion.button>
          </>
        )}
  
        {/* Step 2: Send Token */}
        {step === 2 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSendToken}
            disabled={isSending}
            className={`w-full px-5 py-2 rounded-full shadow-md transition duration-300 ${
              isSending ? "bg-gray-500 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600"
            }`}
          >
            {isSending ? "Sending..." : "Send Reset Token"}
          </motion.button>
        )}
  
      {/* Step 3: Enter Token, New Password, and Confirm Password */}
{step === 3 && (
  <>
    <input
      type="text"
      placeholder="Enter Reset Token"
      className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300 mb-4"
      value={token}
      onChange={(e) => setToken(e.target.value)}
    />
    <input
      type="password"
      placeholder="New Password"
      className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300 mb-4"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
    />
    <input
      type="password"
      placeholder="Confirm Password"
      className="w-full px-4 py-2 rounded-full bg-white/20 text-white border border-white/30 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-300 mb-4"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
    />
    {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
  
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleResetPassword}
      className="w-full bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-full shadow-md transition duration-300"
    >
      Reset Password
    </motion.button>
  </>
)}
  
        {/* Step 4: Return to Login */}
        {step === 4 && (
          <>
            <p className="text-green-400 font-semibold">Use your new password to log in.</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = "/userlogin"}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full shadow-md mt-4 transition duration-300"
            >
              Return to Login
            </motion.button>
          </>
        )}
      </motion.div>
    </div>
  );
  
};

export default UserForgot;
