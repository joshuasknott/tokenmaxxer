import { AbsoluteFill, Still } from "remotion";
import {
  ProductAccountDetailsState,
  ProductAddAccountState,
  ProductDashboardState,
} from "../src/ProductDemoState";
import "./remotion.css";

function TokenMaxxerProductShot({ state }: { state: "dashboard" | "add" | "details" }) {
  const Component =
    state === "add"
      ? ProductAddAccountState
      : state === "details"
        ? ProductAccountDetailsState
        : ProductDashboardState;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1117" }}>
      <Component />
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <>
      <Still
        id="TokenMaxxerProductShot"
        component={() => <TokenMaxxerProductShot state="dashboard" />}
        width={1280}
        height={1060}
      />
      <Still
        id="TokenMaxxerAddAccountShot"
        component={() => <TokenMaxxerProductShot state="add" />}
        width={1280}
        height={1060}
      />
      <Still
        id="TokenMaxxerAccountDetailsShot"
        component={() => <TokenMaxxerProductShot state="details" />}
        width={1280}
        height={1060}
      />
    </>
  );
}
