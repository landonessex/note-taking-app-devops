// User profile page allowing users to update their username, password, or email
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import UserNavbar from "./UserNavbar"; // Import Navbar

// Manages user profile state and handles authentication redirect
const UserProfile = () => {
  const navigate = useNavigate();
  const [selectedField, setSelectedField] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // New field
  const [message, setMessage] = useState({ text: "", isSuccess: null });

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername) {
      navigate("/"); // Redirect if not logged in
    }
  }, [navigate]);

  const API_BASE_URL = "https://localhost:7272/api/User";
  const userId = localStorage.getItem("userId"); // Get User ID from localStorage

  // Handle button click
  const handleButtonClick = (field) => {
    if (selectedField === field) {
      setSelectedField(null); // Close input if clicked again
    } else {
      setSelectedField(field);
      setInputValue(""); // Reset input fields
      setConfirmPassword("");
      setMessage({ text: "", isSuccess: null }); // Clear messages
    }
  };

  // Password validation function
  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasSymbol = /[\W_]/.test(password); // Matches symbols

    return minLength && hasUppercase && hasSymbol;
  };

  // Function to update user details
  const handleSubmit = async () => {
    if (!inputValue) {
      setMessage({ text: "Please enter a value.", isSuccess: false });
      return;
    }

    if (selectedField === "Change Password") {
      if (inputValue !== confirmPassword) {
        setMessage({ text: "Passwords do not match.", isSuccess: false });
        return;
      }

      if (!validatePassword(inputValue)) {
        setMessage({
          text: "Password must be at least 8 characters, include 1 uppercase letter, and 1 symbol.",
          isSuccess: false,
        });
        return;
      }
    }

    let endpoint = "";
    let body = {};

    if (selectedField === "Change Username") {
      endpoint = `${API_BASE_URL}/UpdateUsername/${userId}`;
      body = { NewUsername: inputValue };
      localStorage.setItem("username", inputValue); // Update stored username
    } else if (selectedField === "Change Password") {
      endpoint = `${API_BASE_URL}/UpdatePassword/${userId}`;
      body = { NewPassword: inputValue };
    } else if (selectedField === "Change E-mail") {
      endpoint = `${API_BASE_URL}/UpdateEmail/${userId}`;
      body = { NewEmail: inputValue };
      localStorage.setItem("email", inputValue); // Update stored email
    }

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Update failed");

      setMessage({ text: `${selectedField} updated successfully!`, isSuccess: true });
      setSelectedField(null); // Close input box after update
    } catch (error) {
      setMessage({ text: error.message, isSuccess: false });
    }
  };

  // Renders the user profile UI with update options and animations
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
      <UserNavbar />

      <div className="flex-1 flex items-center justify-center mt-12">
        <motion.div
          className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-lg border border-white/20 text-center w-[450px]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold mb-6 text-white">Profile</h2>

          {/* Buttons for Changing Info */}
          {["Change Username", "Change Password", "Change E-mail"].map((field) => (
            <div key={field} className="mt-4">
              <button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-md shadow-md transition duration-300"
                onClick={() => handleButtonClick(field)}
              >
                {field}
              </button>

              {/* Input Box & Submit Button (Only shows when clicked) */}
              {selectedField === field && (
                <div className="mt-2">
                  <input
                    type={field === "Change Password" ? "password" : "text"}
                    placeholder={`Enter new ${field.split(" ")[1]}`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full p-2 text-sm rounded-md border border-white/30 bg-white/20 text-white placeholder-white outline-none focus:ring-2 focus:ring-white"
                  />

                  {/* Confirm Password field only for password change */}
                  {field === "Change Password" && (
                    <input
                      type="password"
                      placeholder="Confirm new Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full mt-2 p-2 text-sm rounded-md border border-white/30 bg-white/20 text-white placeholder-white outline-none focus:ring-2 focus:ring-white"
                    />
                  )}

                  <button
                    className="mt-2 bg-teal-500 hover:bg-teal-600 px-4 py-2 rounded-md text-white font-semibold transition duration-300"
                    onClick={handleSubmit}
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Show Success or Error Message */}
          {message.text && (
            <p className={`mt-4 font-bold ${message.isSuccess ? "text-green-400" : "text-red-400"}`}>
              {message.text}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UserProfile;
