import Util from './util'

export default {
  /* LD* (Load memory[addr) to * register)
   * フラグ
   *   - negative : 対象の最上位ビット(0から数えて7bit目)
   *   - zero : 計算結果がゼロのとき1そうでなければ0
   * */
  LDA: function(addr) {
    const value = this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },
  /* レジスタindexXにdataをロードする */
  LDX: function(addr) {
    const value = this.ram.read(addr)
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  LDY: function(addr) {
    const value = this.ram.read(addr)
    this.registers.indexY = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* ST* (Store memory[addr) to * register)
   * フラグ操作は無し
   * */
  STA: function(addr) {
    this.ram.write(addr, this.registers.acc)
  },

  STX: function(addr) {
    this.ram.write(addr, this.registers.indexX)
  },

  STY: function(addr) {
    this.ram.write(addr, this.registers.indexY)
  },

  /* T** (Transfer * register to * register)
   * フラグ
   *   - negative
   *   - zero
   * */
  TAX: function() {
    const value = this.registers.acc
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TAY: function() {
    const value = this.registers.acc
    this.registers.indexY = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TSX: function() {
    const value = this.registers.sp
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TXA: function() {
    const value = this.registers.indexX
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  // TXSは他のTX*と違い、フラグを変更しない
  TXS: function() {
    const value = this.registers.indexX
    this.registers.sp = value
    //this.registers.statusNegative = Util.isNegative(value)
    //this.registers.statusZero = Util.isZero(value)
  },

  TYA: function() {
    const value = this.registers.indexY
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* accまたはメモリを左へシフト
   * フラグ
   *   - negative
   *   - zero
   *   - carry
   * */
  ASL: function(addr) {
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc
    const msb = Util.msb(value)
    const shifted = (value << 1) & 0xff

    isRam ? this.ram.write(addr, shifted) : (this.registers.acc = shifted)
    this.registers.statusNegative = Util.isNegative(shifted)
    this.registers.statusZero = Util.isZero(shifted)
    this.registers.statusCarry = msb
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
    const value = isRam ? this.ram.read(addr) : this.registers.acc
    const lsb = Util.lsb(value)
    const shifted = value >> 1

    isRam ? this.ram.write(addr, shifted) : (this.registers.acc = shifted)

    this.registers.statusNegative = Util.isNegative(shifted)
    this.registers.statusZero = Util.isZero(shifted)
    this.registers.statusCarry = lsb
  },

  /* AとメモリをAND演算してフラグを操作する
   * 演算結果は捨てる
   * */
  BIT: function(addr) {
    const memory = this.ram.read(addr)

    this.registers.statusZero = this.registers.acc & memory ? 0x00 : 0x01
    this.registers.statusNegative = memory >> 7
    this.registers.statusOverflow = (memory >> 6) & 0x01
  },

  /* Aとメモリを比較演算してフラグを操作
   * 演算結果は捨てる
   * A == mem -> Z = 0
   * A >= mem -> C = 1
   * A <= mem -> C = 0
   * */
  CMP: function(addr) {
    const result = this.registers.acc - this.ram.read(addr)
    this.registers.statusZero = Util.isZero(result)
    this.registers.statusNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.statusCarry = 1
    } else {
      this.registers.statusCarry = 0
    }
  },

  /* Xとメモリを比較演算 */
  /* TODO フラグ操作が怪しいので要チェック */
  CPX: function(addr) {
    const result = this.registers.indexX - this.ram.read(addr)
    this.registers.statusZero = Util.isZero(result)
    this.registers.statusNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.statusCarry = 1
    } else {
      this.registers.statusCarry = 0
    }
  },

  /* Yとメモリを比較演算*/
  CPY: function(addr) {
    const result = this.registers.indexY - this.ram.read(addr)
    this.registers.statusZero = Util.isZero(result)
    this.registers.statusNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.statusCarry = 1
    } else {
      this.registers.statusCarry = 0
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
    this.registers.statusNegative = Util.isNegative(result)
    this.registers.statusZero = Util.isZero(result)
  },

  /* メモリをデクリメント */
  DEC: function(addr) {
    const value = this.ram.read(addr)
    const result = Util.sub(value, 1)
    this.ram.write(addr, result)
    this.registers.statusNegative = Util.isNegative(result)
    this.registers.statusZero = Util.isZero(result)
  },

  /* Xをインクリメントする */
  INX: function() {
    this.registers.indexX = Util.add(this.registers.indexX, 1)
    const value = this.registers.indexX
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Yをインクリメントする */
  INY: function() {
    this.registers.indexY = Util.add(this.registers.indexY, 1)
    const value = this.registers.indexY
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Xをデクリメント */
  DEX: function() {
    this.registers.indexX = Util.sub(this.registers.indexX, 1)
    const value = this.registers.indexX
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Yをデクリメント*/
  DEY: function() {
    this.registers.indexY = Util.sub(this.registers.indexY, 1)
    const value = this.registers.indexY
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* acc & memory[addr)
   * フラグ
   *   - negative
   *   - zero
   * */
  AND: function(addr) {
    const value = this.registers.acc & this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* accとメモリを論理XOR演算してaccに結果を返す*/
  EOR: function(addr) {
    const value = this.registers.acc ^ this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* accとメモリを論理OR演算して結果をaccへ返す */
  ORA: function(addr) {
    const value = this.registers.acc | this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* メモリを左へローテートする */
  ROL: function(addr) {
    const carry = this.registers.statusCarry
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc
    const msb = value >> 7
    const rotated = ((value << 1) & 0xff) | carry

    this.registers.statusCarry = msb
    this.registers.statusZero = Util.isZero(rotated)
    this.registers.statusNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : (this.registers.acc = rotated)
  },

  /* メモリを右へローテートする */
  ROR: function(addr) {
    const carry = this.registers.statusCarry << 7
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc
    const lsb = Util.lsb(value)
    const rotated = (value >> 1) | carry

    this.registers.statusCarry = lsb
    this.registers.statusZero = Util.isZero(rotated)
    this.registers.statusNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : (this.registers.acc = rotated)
  },

  /* acc + memory + carryFlag
   * フラグ
   *   - negative
   *   - overflow
   *   - zero
   *   - carry
   * */
  ADC: function(addr) {
    const accValue = this.registers.acc
    const memValue = this.ram.read(addr)
    const added = accValue + memValue

    this.registers.acc = (added + this.registers.statusCarry) & 0xff
    this.registers.statusCarry = (added + this.registers.statusCarry > 0xff) & 1
    this.registers.statusZero = Util.isZero(this.registers.acc)
    this.registers.statusNegative = Util.isNegative(this.registers.acc)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit === memNegativeBit) {
      const resultNegativeBit = this.registers.acc >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.statusOverflow = 1
      } else {
        this.registers.statusOverflow = 0
      }
    } else {
      this.registers.statusOverflow = 0
    }
  },

  /* (acc - メモリ - キャリーフラグ)を演算してaccへ返す */
  SBC: function(addr) {
    const accValue = this.registers.acc
    const memValue = this.ram.read(addr)
    const subed = accValue - memValue - (!this.registers.statusCarry & 1)

    this.registers.acc = subed & 0xff
    this.registers.statusCarry = !(subed < 0) & 1
    this.registers.statusZero = Util.isZero(this.registers.acc)
    this.registers.statusNegative = Util.isNegative(this.registers.acc)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit !== memNegativeBit) {
      const resultNegativeBit = this.registers.acc >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.statusOverflow = 1
      } else {
        this.registers.statusOverflow = 0
      }
    } else {
      this.registers.statusOverflow = 0
    }
  },

  /* accをスタックにプッシュ */
  PHA: function() {
    this.stackPush(this.registers.acc)
  },

  /* スタックからaccにポップアップする */
  PLA: function() {
    const value = this.stackPop()
    this.registers.acc = value
    this.registers.statusZero = Util.isZero(value)
    this.registers.statusNegative = Util.isNegative(value)
  },

  /* ステータス・レジスタをスタックにプッシュ
   * ステータスレジスタにBRKがセットされてからプッシュされる
   * プッシュ後はクリアされるのでスタックに保存されたステータスレジスタだけBRKが有効になる
   * */
  PHP: function() {
    this.stackPush(this.registers.statusAllRawBits | 0x10) //なぜか0x10とのORを取る
  },

  /* スタックからステータスレジスタにポップアップする
   * ポップされてからステータスレジスタのBRKがクリアされる
   */
  PLP: function() {
    this.registers.statusAllRawBits = this.stackPop() & 0xef // なぜか0xefとのANDを取る
  },

  /* アドレスへジャンプする */
  JMP: function(addr) {
    this.registers.pc = addr
  },

  /* サブルーチンを呼び出す
   * JSR命令のアドレスをスタックに積み、addrにジャンプする
   * */
  JSR: function(addr) {
    // JSR命令を読んだ時点でプログラムカウンタがインクリメントされているため、
    // デクリメントしてJSR命令のアドレスに合わす
    const jsrAddr = this.registers.pc - 1
    const highAddr = jsrAddr >> 8
    const lowAddr = jsrAddr & 0x00ff

    this.stackPush(highAddr)
    this.stackPush(lowAddr)
    this.registers.pc = addr
  },

  /* サブルーチンから復帰する */
  RTS: function() {
    const lowAddr = this.stackPop()
    const highAddr = this.stackPop()
    const addr = (highAddr << 8) | lowAddr
    this.registers.pc = addr + 1
  },

  /* 割り込みルーチンから復帰する */
  RTI: function() {
    this.registers.statusAllRawBits = this.stackPop()

    const lowAddr = this.stackPop()
    const highAddr = this.stackPop() << 8
    this.registers.pc = lowAddr | highAddr
  },

  /* キャリーフラグがクリアされているときにブランチする */
  BCC: function(addr) {
    const isBranchable = !this.registers.statusCarry

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* キャリーフラグがセットされているときにブランチする */
  BCS: function(addr) {
    const isBranchable = this.registers.statusCarry

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ゼロフラグがセットされているときにブランチする */
  BEQ: function(addr) {
    const isBranchable = this.registers.statusZero

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ゼロフラグがクリアされているときにブランチする*/
  BNE: function(addr) {
    const isBranchable = !this.registers.statusZero

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ネガティブフラグがセットされているときにブランチする */
  BMI: function(addr) {
    const isBranchable = this.registers.statusNegative

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ネガティブフラグがクリアされているときにブランチする */
  BPL: function(addr) {
    const isBranchable = !this.registers.statusNegative

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* オーバーフローフラグがクリアされているときにブランチする*/
  BVC: function(addr) {
    const isBranchable = !this.registers.statusOverflow

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* オーバーフローフラグがセットされているときにブランチする */
  BVS: function(addr) {
    const isBranchable = this.registers.statusOverflow

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* キャリーフラグをセットする */
  SEC: function() {
    this.registers.statusCarry = 1
  },

  /* キャリーフラグをクリアします */
  CLC: function() {
    this.registers.statusCarry = 0
  },

  /* IRQ割り込みを許可する */
  CLI: function() {
    this.registers.statusInterrupt = 1
  },

  /* オーバーフローフラグをクリアする */
  CLV: function() {
    this.registers.statusOverflow = 0
  },

  /* BCDモードに設定する NESには実装されていない */
  SED: function() {
    this.registers.statusDecimal = 1
  },

  /* BCDモードから通常モードに戻る NESには実装されていない */
  CLD: function() {
    this.registers.statusDecimal = 0
  },

  /* IRQ割り込みを禁止する
   * フラグ
   * interrupt をセットする
   * */
  SEI: function() {
    this.registers.statusInterrupt = 1
  },

  /* ソフトウェア割り込みを起こす*/
  BRK: function() {
    this.registers.statusBreak = 1

    const addr = this.registers.pc
    const highAddr = addr >> 8
    const lowAddr = addr & 0x00ff
    this.stackPush(highAddr)
    this.stackPush(lowAddr)
    const statusBits = this.registers.statusAllRawBits
    this.stackPush(statusBits)
    this.registers.pc = this.irqBrkAddr
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
    this.registers.statusNegative = Util.isNegative(result)
    this.registers.statusZero = Util.isZero(result)

    // SBC
    const accValue = this.registers.acc
    const memValue = this.ram.read(addr)
    const subed = accValue - memValue - (!this.registers.statusCarry & 1)

    this.registers.acc = subed & 0xff
    this.registers.statusCarry = !(subed < 0) & 1
    this.registers.statusZero = Util.isZero(this.registers.acc)
    this.registers.statusNegative = Util.isNegative(this.registers.acc)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit !== memNegativeBit) {
      const resultNegativeBit = this.registers.acc >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.statusOverflow = 1
      } else {
        this.registers.statusOverflow = 0
      }
    } else {
      this.registers.statusOverflow = 0
    }
  },

  // ASL then ORA
  SLO: function(addr) {
    // ASL
    const isRam = Util.isRam(addr)
    const aslValue = isRam ? this.ram.read(addr) : this.registers.acc
    const msb = Util.msb(aslValue)
    const shifted = (aslValue << 1) & 0xff

    isRam ? this.ram.write(addr, shifted) : (this.registers.acc = shifted)
    this.registers.statusNegative = Util.isNegative(shifted)
    this.registers.statusZero = Util.isZero(shifted)
    this.registers.statusCarry = msb

    // ORA
    const value = this.registers.acc | this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* AとXにram[addr]をロードする */
  LAX: function(addr) {
    const value = this.ram.read(addr)
    this.registers.acc = value
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* AとXのANDをaddrにストアする */
  SAX: function(addr) {
    const value = this.registers.acc & this.registers.indexX

    this.ram.write(addr, value)
  },

  /* DEC then CMP */
  DCP: function(addr) {
    // DEC
    const value = this.ram.read(addr)
    const decResult = Util.sub(value, 1)
    this.ram.write(addr, decResult)
    this.registers.statusNegative = Util.isNegative(decResult)
    this.registers.statusZero = Util.isZero(decResult)

    const result = this.registers.acc - this.ram.read(addr)
    this.registers.statusZero = Util.isZero(result)
    this.registers.statusNegative = Util.isNegative(result)

    if (result >= 0) {
      this.registers.statusCarry = 1
    } else {
      this.registers.statusCarry = 0
    }
  },

  /* ROL then AND */
  RLA: function(addr) {
    //ROL
    const carry = this.registers.statusCarry
    const isRam = Util.isRam(addr)
    const rolValue = isRam ? this.ram.read(addr) : this.registers.acc
    const msb = rolValue >> 7
    const rotated = ((rolValue << 1) & 0xff) | carry

    this.registers.statusCarry = msb
    this.registers.statusZero = Util.isZero(rotated)
    this.registers.statusNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : (this.registers.acc = rotated)

    // AND
    const value = this.registers.acc & this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* LSRしてからEOR */
  SRE: function(addr) {
    //LSR
    const isRam = Util.isRam(addr)
    const lsrValue = isRam ? this.ram.read(addr) : this.registers.acc
    const lsb = Util.lsb(lsrValue)
    const shifted = lsrValue >> 1

    isRam ? this.ram.write(addr, shifted) : (this.registers.acc = shifted)

    this.registers.statusNegative = Util.isNegative(shifted)
    this.registers.statusZero = Util.isZero(shifted)
    this.registers.statusCarry = lsb

    //EOR
    const value = this.registers.acc ^ this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* RORしてからADC */
  RRA: function(addr) {
    // ROR
    const carry = this.registers.statusCarry << 7
    const isRam = Util.isRam(addr)
    const value = isRam ? this.ram.read(addr) : this.registers.acc
    const lsb = Util.lsb(value)
    const rotated = (value >> 1) | carry

    this.registers.statusCarry = lsb
    this.registers.statusZero = Util.isZero(rotated)
    this.registers.statusNegative = Util.isNegative(rotated)
    isRam ? this.ram.write(addr, rotated) : (this.registers.acc = rotated)

    // ADC
    const accValue = this.registers.acc
    const memValue = this.ram.read(addr)
    const added = accValue + memValue

    this.registers.acc = (added + this.registers.statusCarry) & 0xff
    this.registers.statusCarry = (added + this.registers.statusCarry > 0xff) & 1
    this.registers.statusZero = Util.isZero(this.registers.acc)
    this.registers.statusNegative = Util.isNegative(this.registers.acc)

    const accNegativeBit = Util.isNegative(accValue)
    const memNegativeBit = Util.isNegative(memValue)

    if (accNegativeBit === memNegativeBit) {
      const resultNegativeBit = this.registers.acc >> 7
      if (resultNegativeBit !== accNegativeBit) {
        this.registers.statusOverflow = 1
      } else {
        this.registers.statusOverflow = 0
      }
    } else {
      this.registers.statusOverflow = 0
    }
  },

  /* AND #ram[addr] then LSR acc */
  ALR: function(addr) {
    // AND
    const andValue = this.registers.acc & this.ram.read(addr)
    this.registers.acc = andValue
    this.registers.statusNegative = Util.isNegative(andValue)
    this.registers.statusZero = Util.isZero(andValue)

    // LSR
    const value = this.registers.acc
    const lsb = Util.lsb(value)
    const shifted = value >> 1

    this.registers.acc = shifted

    this.registers.statusNegative = Util.isNegative(shifted)
    this.registers.statusZero = Util.isZero(shifted)
    this.registers.statusCarry = lsb
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
    const andValue = this.registers.acc & this.ram.read(addr)
    this.registers.acc = andValue
    this.registers.statusNegative = Util.isNegative(andValue)
    this.registers.statusZero = Util.isZero(andValue)

    // ROR acc
    const carry = this.registers.statusCarry << 7
    const value = this.registers.acc
    const lsb = Util.lsb(value)
    const rotated = (value >> 1) | carry

    this.registers.statusCarry = lsb
    this.registers.statusZero = Util.isZero(rotated)
    this.registers.statusNegative = Util.isNegative(rotated)
    this.registers.acc = rotated

    //TODO フラグ処理
    //https://wiki.nesdev.com/w/index.php/Programming_with_unofficial_opcodes
  }
}
