import { describe, it, expect } from 'vitest';
import {
  normalizeTaiwanPhone,
  isValidTaiwanPhone,
  getTaiwanPhoneErrorMessage,
} from './phoneValidation';

describe('phoneValidation (台灣手機號碼嚴格格式驗證)', () => {
  describe('normalizeTaiwanPhone', () => {
    it('應正確過濾空白與常見連字號', () => {
      expect(normalizeTaiwanPhone('0912-345-678')).toBe('0912345678');
      expect(normalizeTaiwanPhone('0912 345 678')).toBe('0912345678');
      expect(normalizeTaiwanPhone('  0912－345－678  ')).toBe('0912345678');
      expect(normalizeTaiwanPhone('0912—345—678')).toBe('0912345678');
    });

    it('空值或無效輸入應回傳空字串', () => {
      expect(normalizeTaiwanPhone('')).toBe('');
      expect(normalizeTaiwanPhone(null as any)).toBe('');
      expect(normalizeTaiwanPhone(undefined as any)).toBe('');
    });
  });

  describe('isValidTaiwanPhone', () => {
    it('合法 10 碼 09 開頭手機號碼應通過', () => {
      expect(isValidTaiwanPhone('0912345678')).toBe(true);
      expect(isValidTaiwanPhone('0988-123-456')).toBe(true);
      expect(isValidTaiwanPhone(' 0970 888 999 ')).toBe(true);
      expect(isValidTaiwanPhone('0900000000')).toBe(true);
    });

    it('非 09 開頭之號碼應拒絕', () => {
      expect(isValidTaiwanPhone('0800000123')).toBe(false);
      expect(isValidTaiwanPhone('0223456789')).toBe(false);
      expect(isValidTaiwanPhone('0412345678')).toBe(false);
      expect(isValidTaiwanPhone('9123456789')).toBe(false);
    });

    it('長度不足或超長應拒絕', () => {
      expect(isValidTaiwanPhone('091234567')).toBe(false); // 9 碼
      expect(isValidTaiwanPhone('09123456789')).toBe(false); // 11 碼
      expect(isValidTaiwanPhone('09')).toBe(false);
    });

    it('含有字母或特殊字元應拒絕', () => {
      expect(isValidTaiwanPhone('091234567a')).toBe(false);
      expect(isValidTaiwanPhone('091234567@')).toBe(false);
      expect(isValidTaiwanPhone('091234567#')).toBe(false);
    });
  });

  describe('getTaiwanPhoneErrorMessage', () => {
    it('空字串應提示填寫手機號碼', () => {
      expect(getTaiwanPhoneErrorMessage('')).toBe('請填寫手機號碼');
      expect(getTaiwanPhoneErrorMessage('   ')).toBe('請填寫手機號碼');
    });

    it('非純數字應提示僅能包含數字', () => {
      expect(getTaiwanPhoneErrorMessage('0912345abc')).toBe('手機號碼僅能包含數字');
    });

    it('非 09 開頭應提示必須以 09 開頭', () => {
      expect(getTaiwanPhoneErrorMessage('0800123456')).toBe('台灣手機號碼必須以 09 開頭');
      expect(getTaiwanPhoneErrorMessage('0212345678')).toBe('台灣手機號碼必須以 09 開頭');
    });

    it('長度不正確應提示目前碼數', () => {
      expect(getTaiwanPhoneErrorMessage('0912345')).toBe('手機號碼長度應為 10 碼（目前已輸入 7 碼）');
      expect(getTaiwanPhoneErrorMessage('091234567899')).toBe('手機號碼長度應為 10 碼（目前已輸入 12 碼）');
    });

    it('有效號碼應回傳 null', () => {
      expect(getTaiwanPhoneErrorMessage('0912345678')).toBeNull();
      expect(getTaiwanPhoneErrorMessage('0988-777-666')).toBeNull();
    });
  });
});
