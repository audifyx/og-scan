/**
 * useHangouts — ticking hangout schedule (rooftop/beach/camp) + open-mic
 * + car-meet windows. Recomputes every 30s.
 */

import { useEffect, useState } from "react";
import {
  fmtCountdown,
  getCarMeetWindow,
  getHangoutStatus,
  getOpenMicWindow,
  type HangoutStatus,
} from "../engine/hangoutEngine";

export function useHangouts() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const [status, setStatus] = useState<HangoutStatus>(() => getHangoutStatus());
  const [carMeet, setCarMeet] = useState(() => getCarMeetWindow());
  const [openMic, setOpenMic] = useState(() => getOpenMicWindow());

  useEffect(() => {
    setStatus(getHangoutStatus());
    setCarMeet(getCarMeetWindow());
    setOpenMic(getOpenMicWindow());
  }, [tick]);

  return { status, carMeet, openMic, fmtCountdown };
}
