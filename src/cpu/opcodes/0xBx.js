import Addressing from "../addressing";
import Instructions from "../instructions";
import Util from "./util";

/* 0xb0 - 0xbF */
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
  "a",
  "b",
  "c",
  /* 0xbd: LDA Absolutem X */
  function() {
    const absoluteX = Addressing.absoluteX.bind(this);
    const addr = absoluteX();

    const LDA = Instructions.LDA.bind(this);
    LDA(addr);

    return Util.debugString(LDA, absoluteX, addr);
  },
  "e",
  "f"
];
