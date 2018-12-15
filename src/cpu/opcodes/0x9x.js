//import Addressing from '../addressing'
import Instructions from "../instructions";
import Util from "./util.js";

/* 0x90 - 0x9F */
export default [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  /* 9A: TXS Implied*/
  function() {
    const TXS = Instructions.TXS.bind(this);
    TXS();

    return Util.debugString(TXS);
  },
  "",
  "",
  "",
  "",
  ""
];
