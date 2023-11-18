import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import successImage from "../constants/success.svg";

function SuccessPage() {
  const navigate = useNavigate();

  // Function to handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    navigate("/");
  };

  return (
    <div className="kyc-container">
      <div className="kyc-form-container">
        <h3 style={{ marginBottom: "30px" }} className="kyc-title">
          Identity Verification
        </h3>
        <form onSubmit={handleSubmit} className="kyc-form">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img src={successImage} alt="success" />
          </div>
          <button type="submit" className="submit-btn">
            Go to Home
          </button>
        </form>
      </div>
    </div>
  );
}

export default SuccessPage;
