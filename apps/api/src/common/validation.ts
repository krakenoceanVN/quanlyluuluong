import { TransformFnParams } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Ten hop le: khong chua < > hoac ky tu dieu khien (0x00-0x1F: xuong dong/tab...).
 * Cho phep chu, so, dau cach, gach ngang, CJK... (chong #2/#3/#13).
 */
// eslint-disable-next-line no-control-regex
export const NAME_RULE = new RegExp('^[^<>\\u0000-\\u001F]+$');

/** Transform: trim khoang trang dau/cuoi truoc khi validate. */
export const trimStr = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Validate chuoi ngay yyyy-mm-dd VA la ngay lich hop le thuc su
 * (chan 2026-13-99, 2026-02-30... → tranh 500 o #21/#23).
 */
export function IsYmd(opts?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isYmd',
      target: object.constructor,
      propertyName,
      options: opts,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const d = new Date(`${value}T00:00:00.000Z`);
          if (isNaN(d.getTime())) return false;
          // so khop de loai bo truong hop JS tu "cuon" ngay (2026-02-30 -> 2026-03-02)
          return d.toISOString().slice(0, 10) === value;
        },
        defaultMessage() {
          return '日期须为有效的 yyyy-mm-dd';
        },
      },
    });
  };
}
