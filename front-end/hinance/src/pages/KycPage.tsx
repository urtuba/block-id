import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";

function KycPage() {
  const navigate = useNavigate();

  // State for each form field
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthday, setBirthday] = useState("");

  // On page load make request
  useEffect(() => {});

  // Function to handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    console.log({ firstName, lastName, idNumber, nationality, birthday });
  };

  return (
    <div className="kyc-container">
      <div className="kyc-form-container">
        <h3 className="kyc-title">Identity Verification</h3>
        <form onSubmit={handleSubmit} className="kyc-form">
          <h4>Get verified my account</h4>
          <label>
            First name
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label>
            ID Number
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
            />
          </label>
          <label>
            Nationality
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </label>
          <label>
            Birthday
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </label>
          <button type="submit" className="submit-btn">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

export default KycPage;
