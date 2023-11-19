import { ConnectKitButton } from "connectkit";
import { Link, Outlet } from "react-router-dom";
import hinanceLogo from "./constants/hinance.svg";

function App() {
  // wallet style right top corner

  const getNav = () => {
    let navContent = null;
    if (process.env.REACT_APP_CLIENT === "1") {
      navContent = (
        <>
          <div style={{ position: "absolute", left: "30px", top: "30px" }}>
            <img src={hinanceLogo} alt="hinance-logo" />
          </div>
        </>
      );
    } else {
      navContent = (
        <>
          <div style={{ position: "absolute", left: "30px", top: "30px" }}>
            <h2 style={{ color: "white" }}>
              Client {process.env.REACT_APP_CLIENT}
            </h2>
          </div>
        </>
      );
    }
    return navContent;
  };
  return (
    <>
      <div style={{ position: "absolute", right: "30px", top: "30px" }}>
        <ConnectKitButton />
      </div>
      <div>
        <nav
          style={{
            marginTop: "30px",
            marginBottom: "30px",
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {getNav()}
          {/* <Link to="/">verify kyc</Link> | <Link to="/verify">Verify</Link> |{" "} */}
        </nav>
        <Outlet /> {/* Where page components will be rendered */}
      </div>
    </>
  );
}

export default App;
