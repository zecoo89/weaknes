export default {
  acc: 0x00, // アキュムレータ：汎用演算
  indexX: 0x00, // インデックスレジスタ：アドレッシング、カウンタ等
  indexY: 0x00, // 上に同じ
  sp: 0x01fd, // スタックポインタ
  status: {
    // ステータスレジスタ：CPUの各種状態を保持する
    negative_: 0,
    overflow_: 0,
    reserved_: 1,
    break_: 1, // 割り込みBRK発生時にtrue,IRQ発生時にfalse
    decimal_: 0,
    interrupt_: 1,
    zero_: 0,
    carry_: 0
  },
  pc: 0x8000 // プログラムカウンタ
}
