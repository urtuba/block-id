import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import makeRequest from "src/utils/request";
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

function KycPage() {
  const navigate = useNavigate();

  // State for each form field
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthday, setBirthday] = useState("");
  const [loading, setLoading] = useState(false);

  const { connector: activeConnector, isConnected, address } = useAccount();
  const { data: signer, isError, isLoading: signerLoading } = useSigner();

  const {
    connect,
    connectors,
    error,
    isLoading: connectLoading,
    pendingConnector,
  } = useConnect();

  // On page load make request
  useEffect(() => {});

  // Function to handle form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    console.log({ firstName, lastName, idNumber, nationality, birthday });

    const userId = localStorage.getItem("userId");
    try {
      const updatedUser = (
        await makeRequest.post("/user/" + userId + "/kyc", {
          firstName,
          lastName,
          identityNumber: idNumber,
          nationality,
          birthDate: birthday,
        })
      )?.data;

      setLoading(false);
      navigate("/success");
    } catch (e) {
      setLoading(false);
      console.log(e);
    }
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
        console.log(data);
        alert("Logging in with BlockID");
        navigate("/success");
      }
    } catch (e) {
      alert("Success");
    }
  }, [data, isSuccess]);

  const handleContinueWithBlockid = async () => {
    // Wagmi
    if (isConnected) {
      const createdUser = await makeRequest.put("/user/wallet-address", {
        id: localStorage.getItem("userId"),
        walletAddress: address,
      });
      // Wagmi contract call
      write?.();
    } else {
      const connector = connectors.find(
        (connector) => connector.name === "MetaMask"
      );
      connect({ connector });
    }
  };

  return (
    <div className="kyc-container">
      <div className="kyc-form-container">
        <h3 className="kyc-title">Identity Verification</h3>
        <form onSubmit={handleSubmit} className="kyc-form">
          <h4>Get verified my account</h4>
          <div
            style={{ display: "flex", justifyContent: "center" }}
            onClick={handleContinueWithBlockid}
          >
            <img src={continueWithBlockid} alt="continue-with-blockid" />
          </div>
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
