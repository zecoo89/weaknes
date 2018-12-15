export default class Util {
  static debugString(instruction, addressing, value_) {
    let prefix = "$";
    let postfix = "";

    if (!addressing) {
      prefix = "";
    } else if (addressing.name === "bound immediate") {
      prefix = "#$";
    }

    let value;
    if (value_ === undefined) {
      value = "";
    } else {
      value = value_.toString(16);
    }

    const chars = [
      instruction.name.split(" ")[1],
      " ",
      prefix,
      value,
      postfix
    ].join("");

    return chars;
  }
}
