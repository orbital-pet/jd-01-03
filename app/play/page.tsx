import type { Metadata, Viewport } from "next";
import JoopsGame from "./joops-game";

export const metadata: Metadata = {
  title: "SPACE JOOPS // 우주 냠냠",
  description: "손가락으로 우주쓰레기를 냠냠 먹어치우는 두들 게임.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#141838",
};

export default function Play() {
  return <JoopsGame />;
}
