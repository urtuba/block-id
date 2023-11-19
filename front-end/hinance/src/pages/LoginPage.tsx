import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import makeRequest from "src/utils/request";
import { CircularProgress } from "@mui/material";
import { sleep } from "src/utils/sleep";
import continueWithBlockid from "src/constants/continue-with-blockid.svg";
import {
  useAccount,
  useConnect,
  useContractWrite,
  useContractRead,
  usePrepareContractWrite,
  useSigner,
  useWaitForTransaction,
} from "wagmi";
import { utils } from "ethers";
import { BlockIDAccountABI } from "src/constants/block-id-abi";

function LoginPage() {
  const navigate = useNavigate();

  const { connector: activeConnector, isConnected, address } = useAccount();
  const { data: signer, isError, isLoading: signerLoading } = useSigner();

  const {
    connect,
    connectors,
    error,
    isLoading: connectLoading,
    pendingConnector,
  } = useConnect();
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

  const { config, error: contractWriteError } = usePrepareContractWrite({
    addressOrName: "0x68a6Be86908e07932380A7Dc7Fb3773a49C1389b",
    contractInterface: BlockIDAccountABI.abi,
    functionName: "requestIdentity",
    args: [address, 1],
  });
  const { data: dataClient } = useContractRead({
    addressOrName: "0x68a6Be86908e07932380A7Dc7Fb3773a49C1389b",
    contractInterface: BlockIDAccountABI.abi,
    functionName: "getClient",
    args: [2],
  });

  const { data, write } = useContractWrite(config);

  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  useEffect(() => {
    try {
      if (isSuccess) {
        alert("Logging in with BlockID");
        navigate("/success");
      }
    } catch (e) {
      alert("Success");
    }
  }, [data, isSuccess]);

  const handleContinueWithBlockid = () => {
    // Wagmi
    if (isConnected) {
      // Wagmi contract call
      write?.();
    } else {
      const connector = connectors.find(
        (connector) => connector.name === "MetaMask"
      );
      connect({ connector });
    }
  };

  // Function to handle navigation to the registration page
  const handleRegister = async () => {
    setLoading(true);
    await sleep(1000);
    try {
      const createdUser = (await makeRequest.post("/user", { email, password }))
        ?.data;

      console.log(createdUser?.id);
      localStorage.setItem("userId", createdUser?.id);
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
            Login
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
          <div
            style={{ display: "flex", justifyContent: "center" }}
            onClick={handleContinueWithBlockid}
          >
            <img src={continueWithBlockid} alt="continue-with-blockid" />
          </div>
        </form>
        {/* <h3>{dataClient}</h3> */}
      </div>
    </div>
  );
}

export default LoginPage;
