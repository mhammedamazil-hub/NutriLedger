import { describe, expect, it } from 'vitest';
import { pushToast } from './toastContext';

const t = (id: number, action = false) => ({ id, ...(action ? { action: { label: 'Undo' } } : {}) });

describe('pushToast', () => {
  it('keeps at most two toasts, dropping the oldest', () => {
    expect(pushToast([t(1), t(2)], t(3)).map((x) => x.id)).toEqual([2, 3]);
  });
  it('keeps an Undo toast when newer plain toasts arrive', () => {
    let list = pushToast([], t(1, true));
    list = pushToast(list, t(2));
    list = pushToast(list, t(3));
    list = pushToast(list, t(4));
    expect(list.map((x) => x.id)).toEqual([1, 4]);
  });
  it('drops the oldest action toast only when every toast has an action', () => {
    expect(pushToast([t(1, true), t(2, true)], t(3, true)).map((x) => x.id)).toEqual([2, 3]);
  });
});
