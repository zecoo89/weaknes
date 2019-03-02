import Accumlator from './accumlator'
import IndexX from './indexX'
import IndexY from './indexY'
import StackPointer from './stackPointer'
import Status from './status'
import ProgramCounter from './programCounter'

export default class RegistersFactory {
  static create(cpu) {
    return {
      acc: new Accumlator(),
      indexX: new IndexX(),
      indexY: new IndexY(),
      sp: new StackPointer(),
      status: new Status(),
      pc: new ProgramCounter(cpu),
      debugString: function() {
        return [
          'A:' + this.acc.read().toString(16),
          'X:' + this.indexX.read().toString(16),
          'Y:' + this.indexY.read().toString(16),
          'P:' + this.status.read().toString(16),
          'SP:' + (this.sp.read() & 0xff).toString(16)
        ].join(' ')
      }
    }
  }
}
