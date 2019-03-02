import X4000 from './0x4000'
import X4001 from './0x4001'
import X4002 from './0x4002'
import X4003 from './0x4003'
import X4008 from './0x4008'
import X400a from './0x400a'
import X400b from './0x400b'
import X400c from './0x400c'
import X400e from './0x400e'
import X400f from './0x400f'
import X4015 from './0x4015'

/* 0x4000 ~ 0x4003: 短形波ch1用レジスタ
 * 0x4004 ~ 0x4007: 短形波ch2用レジスタ
 * ch1とch2はレジスタの構造が同じなので,
 * 0x4004 ~ 0x4007はX4000~X4003のインスタンスを用いる。
 * */
export default class RegisterFacory {
  static create() {
    return {
      0x4000: new X4000(),
      0x4001: new X4001(),
      0x4002: new X4002(),
      0x4003: new X4003(),
      0x4004: new X4000(),
      0x4005: new X4001(),
      0x4006: new X4002(),
      0x4007: new X4003(),
      0x4008: new X4008(),
      0x400a: new X400a(),
      0x400b: new X400b(),
      0x400c: new X400c(),
      0x400e: new X400e(),
      0x400f: new X400f(),
      0x4015: new X4015()
    }
  }
}
