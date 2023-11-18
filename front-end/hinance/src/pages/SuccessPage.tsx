import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import successImage from "../constants/success.svg";
import connectYourIdentityButtonImage from "../constants/connect-your-identity.svg";
import { useConnect } from "wagmi";

function SuccessPage() {
  const navigate = useNavigate();

  const { connect, connectors, error, isLoading, pendingConnector } =
    useConnect();

  // Function to handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    navigate("/");
  };

  // const handleConnectYourIdentity = () => {
  //   // Check if user connected wallet or not
  //   // If not, popup a modal to ask user to connect wallet
  //   connect({ connector });
  // };
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
          {/* <div
            style={{ display: "flex", justifyContent: "center" }}
            onClick={handleConnectYourIdentity}
          >
            <img
              src={connectYourIdentityButtonImage}
              alt="connect-your-identity"
            />
          </div> */}

          <button type="submit" className="register-btn">
            Go to Home
          </button>
        </form>
      </div>
    </div>
  );
}

export default SuccessPage;
