import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import { Route, Router, Routes } from "react-router-dom";
import App from "./App";
import KycPage from "./pages/KycPage";
import { BrowserRouter } from "react-router-dom";
import "react-notifications/lib/notifications.css";
import { WagmiConfig, createClient } from "wagmi";

import { ConnectKitProvider, getDefaultClient } from "connectkit";
import { zkChain } from "./constants/customChains";
import LoginPage from "./pages/LoginPage";
import SuccessPage from "./pages/SuccessPage";

const client = createClient(
  getDefaultClient({
    appName: "BlockID Protocol",
    // provider: zkChain,
    chains: [zkChain], //chain.mainnet, chain.polygon,
  })
);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <link rel="stylesheet" type="text/css" href="path/to/notifications.css" />
    <WagmiConfig client={client}>
      <BrowserRouter>
        <ConnectKitProvider theme="auto">
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<LoginPage />} />
              {/* Add more routes as needed */}
            </Route>
            <Route path="/register" element={<App />}>
              <Route index element={<KycPage />} />
              {/* Add more routes as needed */}
            </Route>
            <Route path="/success" element={<App />}>
              <Route index element={<SuccessPage />} />
              {/* Add more routes as needed */}
            </Route>
          </Routes>
        </ConnectKitProvider>
      </BrowserRouter>
    </WagmiConfig>
  </React.StrictMode>
);
