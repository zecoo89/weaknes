import Instructions from "../instructions";
import Util from "./util";

/* 0x70 - 0x7F */
export default [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  /* 0x78: SEI */
  function() {
    const SEI = Instructions.SEI.bind(this);

    SEI();

    return Util.debugString(SEI);
  },
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f"
];
