import Bus from "../";

describe("Bus", () => {
  test("Write $2006 2 times", () => {
    const bus = new Bus();
    bus.write(0x2006, 0x12);
    bus.write(0x2006, 0x34);

    expect(bus.read(0x2006)).toBe(0x1234);
  });
});
