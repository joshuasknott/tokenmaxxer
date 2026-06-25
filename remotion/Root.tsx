import {
  AbsoluteFill,
  Composition,
  Easing,
  Still,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";
import { LogoMark } from "../src/components/Logo";
import {
  ProductAccountDetailsState,
  ProductAddAccountState,
  ProductDashboardState,
} from "../src/ProductDemoState";
import "./remotion.css";

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

function TokenMaxxerProductShot({
  state,
}: {
  state: "dashboard" | "add" | "openrouter-setup" | "details";
}) {
  let content: ReactNode;

  if (state === "add") {
    content = <ProductAddAccountState />;
  } else if (state === "openrouter-setup") {
    content = <ProductAddAccountState initialProvider="openrouter" />;
  } else if (state === "details") {
    content = <ProductAccountDetailsState accountId="openrouter-credits" />;
  } else {
    content = <ProductDashboardState />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1117" }}>
      {content}
    </AbsoluteFill>
  );
}

function clampInterpolate(
  frame: number,
  inputRange: [number, number],
  outputRange: [number, number],
  easing = easeOut,
) {
  return interpolate(frame, inputRange, outputRange, {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function HeroBrandIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = clampInterpolate(frame, [0.18 * fps, 0.92 * fps], [0, 1]);
  const hold = clampInterpolate(frame, [2.25 * fps, 3.05 * fps], [1, 0], easeInOut);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 50% 28%, rgba(96, 165, 250, 0.14), transparent 34%), #071016",
        color: "#f3f7fb",
        display: "flex",
        justifyContent: "center",
        opacity: enter * hold,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 30,
          transform: `translateY(${interpolate(enter, [0, 1], [32, 0])}px) scale(${interpolate(enter, [0, 1], [0.96, 1])})`,
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 34 }}>
          <LogoMark className="hero-demo-logo" />
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              letterSpacing: 0,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            tokenmaxxer
          </div>
        </div>
        <div
          style={{
            color: "#c7d4dc",
            fontSize: 30,
            fontWeight: 650,
            letterSpacing: 0,
            lineHeight: 1.4,
          }}
        >
          A local desktop quota board for tracking AI account limits.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ProductScene({
  children,
  from,
  to,
}: {
  children: ReactNode;
  from: number;
  to: number;
}) {
  const frame = useCurrentFrame();
  const enter = clampInterpolate(frame, [from, from + 18], [0, 1]);
  const exit = clampInterpolate(frame, [to - 18, to], [1, 0], easeInOut);

  return (
    <AbsoluteFill
      style={{
        opacity: enter * exit,
        transform: `scale(${interpolate(enter, [0, 1], [1.025, 1])})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function HeroCursor() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clickOneStart = 4.4 * fps;
  const clickTwoStart = 8.15 * fps;
  const clickOne = clampInterpolate(frame, [clickOneStart, clickOneStart + 10], [0, 1], Easing.out(Easing.cubic));
  const clickOneFade = clampInterpolate(frame, [clickOneStart + 10, clickOneStart + 24], [1, 0], easeInOut);
  const clickTwo = clampInterpolate(frame, [clickTwoStart, clickTwoStart + 10], [0, 1], Easing.out(Easing.cubic));
  const clickTwoFade = clampInterpolate(frame, [clickTwoStart + 10, clickTwoStart + 24], [1, 0], easeInOut);

  const x = interpolate(
    frame,
    [3.2 * fps, 4.35 * fps, 6.8 * fps, 8.1 * fps, 10.2 * fps],
    [930, 1362, 1362, 560, 1090],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(
    frame,
    [3.2 * fps, 4.35 * fps, 6.8 * fps, 8.1 * fps, 10.2 * fps],
    [630, 30, 30, 429, 470],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const visible = clampInterpolate(frame, [3.0 * fps, 3.35 * fps], [0, 1]);
  const press =
    clampInterpolate(frame, [clickOneStart, clickOneStart + 4], [1, 0.82], Easing.out(Easing.cubic)) *
    clampInterpolate(frame, [clickOneStart + 4, clickOneStart + 10], [0.82, 1], Easing.out(Easing.cubic)) *
    clampInterpolate(frame, [clickTwoStart, clickTwoStart + 4], [1, 0.82], Easing.out(Easing.cubic)) *
    clampInterpolate(frame, [clickTwoStart + 4, clickTwoStart + 10], [0.82, 1], Easing.out(Easing.cubic));

  const rings = [
    { progress: clickOne, fade: clickOneFade, x: 1366, y: 34 },
    { progress: clickTwo, fade: clickTwoFade, x: 564, y: 433 },
  ];

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {rings.map((ring, index) => (
        <div
          key={index}
          style={{
            border: "3px solid rgba(123, 216, 206, 0.92)",
            borderRadius: "999px",
            boxShadow: "0 0 42px rgba(123, 216, 206, 0.34)",
            height: 74,
            left: ring.x,
            opacity: ring.progress * ring.fade,
            position: "absolute",
            top: ring.y,
            transform: `translate(-37px, -37px) scale(${interpolate(ring.progress, [0, 1], [0.42, 1.3])})`,
            width: 74,
          }}
        />
      ))}
      <svg
        aria-hidden="true"
        height="54"
        viewBox="0 0 42 54"
        width="42"
        style={{
          filter: "drop-shadow(0 10px 18px rgba(0, 0, 0, 0.48))",
          left: x,
          opacity: visible,
          position: "absolute",
          top: y,
          transform: `scale(${press})`,
          transformOrigin: "4px 4px",
        }}
      >
        <path d="M4 4 37 31 20 34 15 50 4 4Z" fill="#ffffff" stroke="#0b1117" strokeWidth="2.4" />
      </svg>
    </AbsoluteFill>
  );
}

function TokenMaxxerHeroDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const productEnter = clampInterpolate(frame, [2.65 * fps, 3.35 * fps], [0, 1], easeOut);
  const slowZoom = interpolate(frame, [3 * fps, 12 * fps], [1, 1.035], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#071016", overflow: "hidden" }}>
      <HeroBrandIntro />
      <AbsoluteFill
        style={{
          opacity: productEnter,
          transform: `translateY(${interpolate(productEnter, [0, 1], [34, 0])}px) scale(${slowZoom})`,
          transformOrigin: "center center",
        }}
      >
        <ProductScene from={3 * fps} to={6.25 * fps}>
          <ProductDashboardState />
        </ProductScene>
        <ProductScene from={5.15 * fps} to={8.65 * fps}>
          <ProductAddAccountState />
        </ProductScene>
        <ProductScene from={8.35 * fps} to={12 * fps}>
          <ProductAddAccountState initialProvider="openrouter" />
        </ProductScene>
      </AbsoluteFill>
      <HeroCursor />
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="TokenMaxxerHeroDemo"
        component={TokenMaxxerHeroDemo}
        durationInFrames={360}
        fps={30}
        width={1440}
        height={900}
      />
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
      <Still
        id="TokenMaxxerOpenRouterSetupShot"
        component={() => <TokenMaxxerProductShot state="openrouter-setup" />}
        width={1280}
        height={1060}
      />
    </>
  );
}
