import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import makeRequest from "src/utils/request";
import { CircularProgress } from "@mui/material";
import { sleep } from "src/utils/sleep";

function LoginPage() {
  const navigate = useNavigate();

  // State for each form field
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  // Function to handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    console.log({ email, password });
    navigate("/next-page");
  };

  // Function to handle navigation to the registration page
  const handleRegister = async () => {
    setLoading(true);
    await sleep(1000);
    try {
      const createdUser = (await makeRequest.post("/user", { email, password }))
        ?.data;
      if (!createdUser) return console.log("Error creating user");

      localStorage.setItem("userId", createdUser?.data?.id);
      setLoading(false);
      navigate("/register"); // Navigate to the registration route
    } catch (e) {
      setLoading(false);
      console.log(e);
    }
  };

  return (
    <div className="kyc-container">
      <div className="kyc-form-container">
        <h3 className="kyc-title">Login</h3>
        <form onSubmit={handleSubmit} className="kyc-form">
          <label>
            Email
            <input
              type="email" // Change type to email for proper validation
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password" // Change type to password to hide input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="submit-btn">
            Continue
          </button>
          <button
            type="button"
            className="register-btn"
            onClick={handleRegister}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Register"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
