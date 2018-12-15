import Instructions from "../instructions";
import Addressing from "../addressing";
import Util from "./util";

/* 0xA0 - 0xAF */
export default [
  /* 0xA0: LDY Immediate*/
  function() {
    const immediate = Addressing.immediate.bind(this);
    const addr = immediate();

    const LDY = Instructions.LDY.bind(this);
    LDY(addr);

    return Util.debugString(LDY, immediate, this.ram.read(addr));
  },
  "1",
  /* 0xA2: LDX Immediate */
  function() {
    const immediate = Addressing.immediate.bind(this);
    const addr = immediate();

    const LDX = Instructions.LDX.bind(this);
    LDX(addr);

    return Util.debugString(LDX, immediate, this.ram.read(addr));
  },
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",

  /* 0xA9: LDA Immediate */
  function() {
    const immediate = Addressing.immediate.bind(this);
    const addr = immediate();

    const LDA = Instructions.LDA.bind(this);
    LDA(addr);

    return Util.debugString(LDA, immediate, this.ram.read(addr));
  },
  "",
  "",
  "",
  "",
  "",
  ""
];
