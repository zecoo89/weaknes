import Util from './util'

export default {
  /* LD* (Load memory[addr) to * register)
   * フラグ
   *   - negative : 対象の最上位ビット(0から数えて7bit目)
   *   - zero : 計算結果がゼロのとき1そうでなければ0
   * */
  LDA: function(addr) {
    const value = this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* レジスタxにdataをロードする */
  LDX: function(addr) {
    const value = this.ram.read(addr)
    this.registers.indexX.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  LDY: function(addr) {
    const value = this.ram.read(addr)
    this.registers.indexY.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* ST* (Store memory[addr) to * register)
   * フラグ操作は無し
   * */
  STA: function(addr) {
    const value = this.registers.acc.read()
    this.ram.write(addr, value)
  },

  STX: function(addr) {
    const value = this.registers.indexX.read()
    this.ram.write(addr, value)
  },

  STY: function(addr) {
    const value = this.registers.indexY.read()
    this.ram.write(addr, value)
  },

  /* T** (Transfer * register to * register)
   * フラグ
   *   - negative
   *   - zero
   * */
  TAX: function() {
    const value = this.registers.acc.read()
    this.registers.indexX.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  TAY: function() {
    const value = this.registers.acc.read()
    this.registers.indexY.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  TSX: function() {
    const value = this.registers.sp.read()
    this.registers.indexX.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  TXA: function() {
    const value = this.registers.indexX.read()
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* TXSは他のTX*と違い、フラグを変更しない */
  TXS: function() {
    const value = this.registers.indexX.read()
    this.registers.sp.write(value)
  },

  TYA: function() {
    const value = this.registers.indexY.read()
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* accまたはメモリを左へシフト
   * フラグ
   *   - negative
   *   - zero
   *   - carry
   * */
  ASL: function(addr) {
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const msb = Util.msb(value)
    const shifted = (value << 1) & 0xff

    isRam ? this.ram.write(addr, shifted) : this.registers.acc.write(shifted)
    this.registers.status.isNegative = Util.isNegative(shifted)
    this.registers.status.isZero = Util.isZero(shifted)
    this.registers.status.isCarry = msb
  },

  /* accまたはメモリを右へシフト
   * フラグ
   *   - negative
   *   - zero
   *   - carry
   * */
  /* Logical Shift Right */
  LSR: function(addr) {
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const lsb = Util.lsb(value)
    const shifted = value >> 1

    isRam ? this.ram.write(addr, shifted) : this.registers.acc.write(shifted)

    this.registers.status.isNegative = Util.isNegative(shifted)
    this.registers.status.isZero = Util.isZero(shifted)
    this.registers.status.isCarry = lsb
  },

  /* AとメモリをAND演算してフラグを操作する
   * 演算結果は捨てる
   * */
  BIT: function(addr) {
    const memory = this.ram.read(addr)

    this.registers.status.isZero = this.registers.acc.read() & memory ? 0x00 : 0x01
    this.registers.status.isNegative = memory >> 7
    this.registers.status.isOverflow = (memory >> 6) & 0x01
  },

  /* Aとメモリを比較演算してフラグを操作
   * 演算結果は捨てる
   * A == mem -> Z = 0
   * A >= mem -> C = 1
   * A <= mem -> C = 0
   * */
  CMP: function(addr) {
    const result = this.registers.acc.read() - this.ram.read(addr)
    this.registers.status.isZero = Util.isZero(result)
    this.registers.status.isNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.status.isCarry = 1
    } else {
      this.registers.status.isCarry = 0
    }
  },

  /* Xとメモリを比較演算 */
  /* TODO フラグ操作が怪しいので要チェック */
  CPX: function(addr) {
    const result = this.registers.indexX.read() - this.ram.read(addr)
    this.registers.status.isZero = Util.isZero(result)
    this.registers.status.isNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.status.isCarry = 1
    } else {
      this.registers.status.isCarry = 0
    }
  },

  /* Yとメモリを比較演算*/
  CPY: function(addr) {
    const result = this.registers.indexY.read() - this.ram.read(addr)
    this.registers.status.isZero = Util.isZero(result)
    this.registers.status.isNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.status.isCarry = 1
    } else {
      this.registers.status.isCarry = 0
    }
  },

  /* *をインクリメント・デクリメントする
   * フラグ
   *   - negative
   *   - zero
   * */
  /* メモリをインクリメントする*/
  INC: function(addr) {
    const value = this.ram.read(addr)
    const result = Util.add(value, 1)
    this.ram.write(addr, result)
    this.registers.status.isNegative = Util.isNegative(result)
    this.registers.status.isZero = Util.isZero(result)
  },

  /* メモリをデクリメント */
  DEC: function(addr) {
    const value = this.ram.read(addr)
    const result = Util.sub(value, 1)
    this.ram.write(addr, result)
    this.registers.status.isNegative = Util.isNegative(result)
    this.registers.status.isZero = Util.isZero(result)
  },

  /* Xをインクリメントする */
  INX: function() {
    const added = Util.add(this.registers.indexX.read(), 1)
    this.registers.indexX.write(added)
    this.registers.status.isNegative = Util.isNegative(added)
    this.registers.status.isZero = Util.isZero(added)
  },

  /* Yをインクリメントする */
  INY: function() {
    const added = Util.add(this.registers.indexY.read(), 1)
    this.registers.indexY.write(added)
    this.registers.status.isNegative = Util.isNegative(added)
    this.registers.status.isZero = Util.isZero(added)
  },

  /* Xをデクリメント */
  DEX: function() {
    const subbed = Util.sub(this.registers.indexX.read(), 1)
    this.registers.indexX.write(subbed)
    this.registers.status.isNegative = Util.isNegative(subbed)
    this.registers.status.isZero = Util.isZero(subbed)
  },

  /* Yをデクリメント*/
  DEY: function() {
    const subbed = Util.sub(this.registers.indexY.read(), 1)
    this.registers.indexY.write(subbed)
    this.registers.status.isNegative = Util.isNegative(subbed)
    this.registers.status.isZero = Util.isZero(subbed)
  },

  /* acc & memory[addr)
   * フラグ
   *   - negative
   *   - zero
   * */
  AND: function(addr) {
    const value = this.registers.acc.read() & this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* accとメモリを論理XOR演算してaccに結果を返す*/
  EOR: function(addr) {
    const value = this.registers.acc.read() ^ this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* accとメモリを論理OR演算して結果をaccへ返す */
  ORA: function(addr) {
    const value = this.registers.acc.read() | this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* メモリを左へローテートする */
  ROL: function(addr) {
    const carry = this.registers.status.isCarry
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const msb = value >> 7
    const rotated = ((value << 1) & 0xff) | carry

    this.registers.status.isCarry = msb
    this.registers.status.isZero = Util.isZero(rotated)
    this.registers.status.isNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : this.registers.acc.write(rotated)
  },

  /* メモリを右へローテートする */
  ROR: function(addr) {
    const carry = this.registers.status.isCarry << 7
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const lsb = Util.lsb(value)
    const rotated = (value >> 1) | carry

    this.registers.status.isCarry = lsb
    this.registers.status.isZero = Util.isZero(rotated)
    this.registers.status.isNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : this.registers.acc.write(rotated)
  },

  /* acc + memory + carryFlag
   * フラグ
   *   - negative
   *   - overflow
   *   - zero
   *   - carry
   * */
  ADC: function(addr) {
    const accValue = this.registers.acc.read()
    const memValue = this.ram.read(addr)
    const added = accValue + memValue

    const total = (added + this.registers.status.isCarry) & 0xff
    this.registers.acc.write(total)
    this.registers.status.isCarry = (added + this.registers.status.isCarry > 0xff) & 1
    this.registers.status.isZero = Util.isZero(total)
    this.registers.status.isNegative = Util.isNegative(total)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit === memNegativeBit) {
      const resultNegativeBit = total >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.status.isOverflow = 1
      } else {
        this.registers.status.isOverflow = 0
      }
    } else {
      this.registers.status.isOverflow = 0
    }
  },

  /* (acc - メモリ - キャリーフラグ)を演算してaccへ返す */
  SBC: function(addr) {
    const accValue = this.registers.acc.read()
    const memValue = this.ram.read(addr)
    const subbed = accValue - memValue - (!this.registers.status.isCarry & 1)

    const masked = subbed & 0xff
    this.registers.acc.write(masked)
    this.registers.status.isCarry = !(subbed < 0) & 1
    this.registers.status.isZero = Util.isZero(masked)
    this.registers.status.isNegative = Util.isNegative(masked)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit !== memNegativeBit) {
      const resultNegativeBit = masked >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.status.isOverflow = 1
      } else {
        this.registers.status.isOverflow = 0
      }
    } else {
      this.registers.status.isOverflow = 0
    }
  },

  /* accをスタックにプッシュ */
  PHA: function() {
    const value = this.registers.acc.read()
    this.stackPush(value)
  },

  /* スタックからaccにポップアップする */
  PLA: function() {
    const value = this.stackPop()
    this.registers.acc.write(value)
    this.registers.status.isZero = Util.isZero(value)
    this.registers.status.isNegative = Util.isNegative(value)
  },

  /* ステータス・レジスタをスタックにプッシュ
   * ステータスレジスタにBRKがセットされてからプッシュされる
   * プッシュ後はクリアされるのでスタックに保存されたステータスレジスタだけBRKが有効になる
   * */
  PHP: function() {
    this.stackPush(this.registers.status.read() | 0x10)
  },

  /* スタックからステータスレジスタにポップアップする
   * ポップされてからステータスレジスタのBRKがクリアされる
   */
  PLP: function() {
    this.registers.status.write(this.stackPop() & 0xef)
  },

  /* アドレスへジャンプする */
  JMP: function(addr) {
    this.registers.pc.write(addr)
  },

  /* サブルーチンを呼び出す
   * JSR命令のアドレスをスタックに積み、addrにジャンプする
   * */
  JSR: function(addr) {
    // JSR命令を読んだ時点でプログラムカウンタがインクリメントされているため、
    // デクリメントしてJSR命令のアドレスに合わす
    const jsrAddr = this.registers.pc.read() - 1
    const highAddr = jsrAddr >> 8
    const lowAddr = jsrAddr & 0x00ff

    this.stackPush(highAddr)
    this.stackPush(lowAddr)
    this.registers.pc.write(addr)
  },

  /* サブルーチンから復帰する */
  RTS: function() {
    const lowAddr = this.stackPop()
    const highAddr = this.stackPop()
    const addr = (highAddr << 8) | lowAddr
    this.registers.pc.write(addr + 1)
  },

  /* 割り込みルーチンから復帰する */
  RTI: function() {
    const status = this.stackPop()
    this.registers.status.write(status)

    const lowAddr = this.stackPop()
    const highAddr = this.stackPop() << 8
    this.registers.pc.write(lowAddr | highAddr)
  },

  /* キャリーフラグがクリアされているときにブランチする */
  BCC: function(addr) {
    const isBranchable = !this.registers.status.isCarry
    isBranchable && this.registers.pc.write(addr)
  },

  /* キャリーフラグがセットされているときにブランチする */
  BCS: function(addr) {
    const isBranchable = this.registers.status.isCarry
    isBranchable && this.registers.pc.write(addr)
  },

  /* ゼロフラグがセットされているときにブランチする */
  BEQ: function(addr) {
    const isBranchable = this.registers.status.isZero
    isBranchable && this.registers.pc.write(addr)
  },

  /* ゼロフラグがクリアされているときにブランチする*/
  BNE: function(addr) {
    const isBranchable = !this.registers.status.isZero
    isBranchable && this.registers.pc.write(addr)
  },

  /* ネガティブフラグがセットされているときにブランチする */
  BMI: function(addr) {
    const isBranchable = this.registers.status.isNegative
    isBranchable && this.registers.pc.write(addr)
  },

  /* ネガティブフラグがクリアされているときにブランチする */
  BPL: function(addr) {
    const isBranchable = !this.registers.status.isNegative
    isBranchable && this.registers.pc.write(addr)
  },

  /* オーバーフローフラグがクリアされているときにブランチする*/
  BVC: function(addr) {
    const isBranchable = !this.registers.status.isOverflow
    isBranchable && this.registers.pc.write(addr)
  },

  /* オーバーフローフラグがセットされているときにブランチする */
  BVS: function(addr) {
    const isBranchable = this.registers.status.isOverflow
    isBranchable && this.registers.pc.write(addr)
  },

  /* キャリーフラグをセットする */
  SEC: function() {
    this.registers.status.isCarry = 1
  },

  /* キャリーフラグをクリアします */
  CLC: function() {
    this.registers.status.isCarry = 0
  },

  /* IRQ割り込みを許可する */
  CLI: function() {
    this.registers.status.isInterruptDisabled = 1
  },

  /* オーバーフローフラグをクリアする */
  CLV: function() {
    this.registers.status.isOverflow = 0
  },

  /* BCDモードに設定する NESには実装されていない */
  SED: function() {
    this.registers.status.isDecimalMode = 1
  },

  /* BCDモードから通常モードに戻る NESには実装されていない */
  CLD: function() {
    this.registers.status.isDecimalMode = 0
  },

  /* IRQ割り込みを禁止する
   * フラグ
   * interrupt をセットする
   * */
  SEI: function() {
    this.registers.status.isInterruptDisabled = 1
  },

  /* ソフトウェア割り込みを起こす*/
  BRK: function() {
    this.registers.status.isBreakMode = 1

    const addr = this.registers.pc.read()
    const highAddr = addr >> 8
    const lowAddr = addr & 0x00ff
    this.stackPush(highAddr)
    this.stackPush(lowAddr)
    const statusBits = this.registers.status.read()
    this.stackPush(statusBits)
    this.registers.pc.write(this.irqBrkAddr)
  },

  /* 空の命令を実行する */
  NOP: function() {
    // 何もしない
  },

  /* Following, Illegal opcodes */

  /* INC then SBC */
  ISC: function(addr) {
    // INC
    const value = this.ram.read(addr)
    const result = Util.add(value, 1)
    this.ram.write(addr, result)
    this.registers.status.isNegative = Util.isNegative(result)
    this.registers.status.isZero = Util.isZero(result)

    // SBC
    const accValue = this.registers.acc.read()
    const memValue = this.ram.read(addr)
    const subbed = accValue - memValue - (!this.registers.status.isCarry & 1)

    const masked = subbed & 0xff
    this.registers.acc.write(masked)
    this.registers.status.isCarry = !(subbed < 0) & 1
    this.registers.status.isZero = Util.isZero(masked)
    this.registers.status.isNegative = Util.isNegative(masked)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit !== memNegativeBit) {
      const resultNegativeBit = masked >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.status.isOverflow = 1
      } else {
        this.registers.status.isOverflow = 0
      }
    } else {
      this.registers.status.isOverflow = 0
    }
  },

  // ASL then ORA
  SLO: function(addr) {
    // ASL
    const isRam = Util.isRam(addr)
    const aslValue = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const msb = Util.msb(aslValue)
    const shifted = (aslValue << 1) & 0xff

    isRam ? this.ram.write(addr, shifted) : this.registers.acc.write(shifted)
    this.registers.status.isNegative = Util.isNegative(shifted)
    this.registers.status.isZero = Util.isZero(shifted)
    this.registers.status.isCarry = msb

    // ORA
    const value = this.registers.acc.read() | this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* AとXにram[addr]をロードする */
  LAX: function(addr) {
    const value = this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.indexX.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* AとXのANDをaddrにストアする */
  SAX: function(addr) {
    const value = this.registers.acc.read() & this.registers.indexX.read()

    this.ram.write(addr, value)
  },

  /* DEC then CMP */
  DCP: function(addr) {
    // DEC
    const value = this.ram.read(addr)
    const decResult = Util.sub(value, 1)
    this.ram.write(addr, decResult)
    this.registers.status.isNegative = Util.isNegative(decResult)
    this.registers.status.isZero = Util.isZero(decResult)

    const result = this.registers.acc.read() - this.ram.read(addr)
    this.registers.status.isZero = Util.isZero(result)
    this.registers.status.isNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.status.isCarry = 1
    } else {
      this.registers.status.isCarry = 0
    }
  },

  /* ROL then AND */
  RLA: function(addr) {
    //ROL
    const carry = this.registers.status.isCarry
    const isRam = Util.isRam(addr)
    const rolValue = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const msb = rolValue >> 7
    const rotated = ((rolValue << 1) & 0xff) | carry

    this.registers.status.isCarry = msb
    this.registers.status.isZero = Util.isZero(rotated)
    this.registers.status.isNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : this.registers.acc.write(rotated)

    // AND
    const value = this.registers.acc.read() & this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* LSRしてからEOR */
  SRE: function(addr) {
    //LSR
    const isRam = Util.isRam(addr)
    const lsrValue = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const lsb = Util.lsb(lsrValue)
    const shifted = lsrValue >> 1

    isRam ? this.ram.write(addr, shifted) : this.registers.acc.write(shifted)

    this.registers.status.isNegative = Util.isNegative(shifted)
    this.registers.status.isZero = Util.isZero(shifted)
    this.registers.status.isCarry = lsb

    //EOR
    const value = this.registers.acc.read() ^ this.ram.read(addr)
    this.registers.acc.write(value)
    this.registers.status.isNegative = Util.isNegative(value)
    this.registers.status.isZero = Util.isZero(value)
  },

  /* RORしてからADC */
  RRA: function(addr) {
    // ROR
    const carry = this.registers.status.isCarry << 7
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc.read()
    const lsb = Util.lsb(value)
    const rotated = (value >> 1) | carry

    this.registers.status.isCarry = lsb
    this.registers.status.isZero = Util.isZero(rotated)
    this.registers.status.isNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : this.registers.acc.write(rotated)

    // ADC
    const accValue = this.registers.acc.read()
    const memValue = this.ram.read(addr)
    const added = accValue + memValue

    const masked = (added + this.registers.status.isCarry) & 0xff
    this.registers.acc.write(masked)
    this.registers.status.isCarry = (added + this.registers.status.isCarry > 0xff) & 1
    this.registers.status.isZero = Util.isZero(masked)
    this.registers.status.isNegative = Util.isNegative(masked)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit === memNegativeBit) {
      const resultNegativeBit = masked >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.status.isOverflow = 1
      } else {
        this.registers.status.isOverflow = 0
      }
    } else {
      this.registers.status.isOverflow = 0
    }
  },

  /* AND #ram[addr] then LSR acc */
  ALR: function(addr) {
    // AND
    const andValue = this.registers.acc.read() & this.ram.read(addr)
    this.registers.acc.write(andValue)
    this.registers.status.isNegative = Util.isNegative(andValue)
    this.registers.status.isZero = Util.isZero(andValue)

    // LSR
    const value = this.registers.acc.read()
    const lsb = Util.lsb(value)
    const shifted = value >> 1

    this.registers.acc.write(shifted)

    this.registers.status.isNegative = Util.isNegative(shifted)
    this.registers.status.isZero = Util.isZero(shifted)
    this.registers.status.isCarry = lsb
  },

  STP: function() {},

  LAS: function() {},

  ANC: function() {},

  /* AND #ram[addr]してからROR acc
   * フラグ処理
   * NとZは通常通り行う。
   * Cはbit6, Vはbit6とbit5のxor
   * */
  ARR: function(addr) {
    // AND #ram[addr]
    const andValue = this.registers.acc.read() & this.ram.read(addr)
    this.registers.acc.write(andValue)
    this.registers.status.isNegative = Util.isNegative(andValue)
    this.registers.status.isZero = Util.isZero(andValue)

    // ROR acc
    const carry = this.registers.status.isCarry << 7
    const value = this.registers.acc.read()
    const lsb = Util.lsb(value)
    const rotated = (value >> 1) | carry

    this.registers.status.isCarry = lsb
    this.registers.status.isZero = Util.isZero(rotated)
    this.registers.status.isNegative = Util.isNegative(rotated)
    this.registers.acc.write(rotated)

    //TODO フラグ処理
    //https://wiki.nesdev.com/w/index.php/Programming_with_unofficial_opcodes
  }
}
