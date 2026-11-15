import type { Metadata } from "next";
import MissionControl from "@/components/MissionControl";

export const metadata: Metadata = {
  title: "Mission control — NinaCal",
  description:
    "The NinaCal mission-control console: satellite fire detections for the United States and Peru, harmonized into a year × month calendar and a square-cell coverage map.",
};

export default function ConsolePage() {
  return <MissionControl />;
}
