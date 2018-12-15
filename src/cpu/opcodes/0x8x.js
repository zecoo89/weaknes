import Addressing from "../addressing";
import Instructions from "../instructions";
import Util from "./util";

/* 0x80 - 0x8F */
export default [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  /* 0x88: DEY */
  function() {
    const DEY = Instructions.DEY.bind(this);

    DEY();

    return Util.debugString(DEY);
  },
  "9",
  "a",
  "b",
  "c",
  /* 0x8d: STA Absolute */
  function() {
    const absolute = Addressing.absolute.bind(this);

    const addr = absolute();
    const STA = Instructions.STA.bind(this);

    STA(addr);

    return Util.debugString(STA, absolute, addr);
  },
  "e",
  "f"
];
