import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import successImage from "../constants/success.svg";
import connectYourIdentityButtonImage from "../constants/connect-your-identity.svg";
import {
  useAccount,
  useConnect,
  useContractWrite,
  usePrepareContractWrite,
  useSigner,
  useWaitForTransaction,
} from "wagmi";
import { BlockIDAccountABI } from "src/constants/block-id-abi";
import makeRequest from "src/utils/request";

function SuccessPage() {
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

  const { config, error: contractWriteError } = usePrepareContractWrite({
    addressOrName: "0x68a6Be86908e07932380A7Dc7Fb3773a49C1389b",
    contractInterface: BlockIDAccountABI.abi,
    functionName: "addClient",
    args: ["Exchange35", "http://localhost:30035"],
  });

  const { data, write } = useContractWrite(config);

  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  useEffect(() => {
    try {
      if (isSuccess) {
        console.log(data);
        alert("Client has been authorized!!!");
      }
    } catch (e) {
      alert("Success");
    }
  }, [data, isSuccess]);

  // Function to handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    navigate("/");
  };

  const handleConnectYourIdentity = async () => {
    if (isConnected) {
      // Wagmi contract call
      write?.();
      const createdUser = await makeRequest.put("/user/wallet-address", {
        id: localStorage.getItem("userId"),
        walletAddress: address,
      });
    } else {
      const connector = connectors.find(
        (connector) => connector.name === "MetaMask"
      );
      connect({ connector });
    }
  };

  const processAccountAbstraction = async () => {
    // TODO account abstraction deploy here
  };

  useEffect(() => {
    if (isConnected) {
      processAccountAbstraction();
    }
  }, [isConnected]);

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
          <div
            style={{ display: "flex", justifyContent: "center" }}
            onClick={handleConnectYourIdentity}
          >
            <img
              src={connectYourIdentityButtonImage}
              alt="connect-your-identity"
            />
          </div>

          <button type="submit" className="register-btn">
            Go to Home
          </button>
        </form>
      </div>
    </div>
  );
}

export default SuccessPage;
