
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import UserLogin from "./components/UserLogin";
import UserRegister from "./components/UserRegister";
import UserDashboard from "./components/UserDashboard";
import UserForgot from "./components/UserForgot";
import AdminLogin from "./components/AdminLogin";
import AdminRegister from "./components/AdminRegister";
import AdminDashboard from "./components/AdminDashboard";
import UserNavbar from "./components/UserNavbar";
import UserProfile from "./components/UserProfile";
import EditNote from "./components/EditNote";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/userlogin" element={<UserLogin />} />
        <Route path="/userregister" element={<UserRegister />} />
        <Route path="/userdashboard" element={<UserDashboard />} />
        <Route path="/userforgot" element={<UserForgot />} />
        <Route path="/usernavbar" element={<UserNavbar />} />
        <Route path="/userprofile" element={<UserProfile />} />
        <Route path="/adminlogin" element={<AdminLogin />} />
        <Route path="/adminregister" element={<AdminRegister />} />
        <Route path="/admindashboard" element={<AdminDashboard />} />
        <Route path="/edit-note/:noteId" element={<EditNote />} />
      </Routes>
    </Router>
  );
}

export default App;
