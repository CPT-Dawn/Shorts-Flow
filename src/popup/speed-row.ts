import { PREFERRED_SPEEDS } from '@/settings/settings';
import type { PopupRow } from './rows';

/**
 * The Speed row: a switch for Speed and a picker for the Preferred Speed,
 * which every new Short plays at while Speed is on. The picker works with
 * Speed off too, so the viewer can set the speed before turning it on.
 */
export const speedRow: PopupRow = (popup) => {
  const { document, signal, message } = popup;
  const id = 'sf-setting-speed';

  const picker = document.createElement('select');
  picker.className = 'sf-select';
  picker.setAttribute('aria-label', message('popupPreferredSpeed'));
  for (const speed of PREFERRED_SPEEDS) {
    picker.append(new Option(message('popupSpeedValue', [String(speed)]), String(speed)));
  }
  picker.addEventListener('change', () => popup.changeSettings({ preferredSpeed: Number(picker.value) }), { signal });

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'sf-switch';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-labelledby', id);
  toggle.setAttribute('aria-describedby', `${id}-hint`);
  toggle.addEventListener('change', () => popup.changeSettings({ speedOn: toggle.checked }), { signal });

  // Disabled until the settings arrive, so nothing shows a guess.
  picker.disabled = toggle.disabled = true;

  const controls = document.createElement('span');
  controls.className = 'sf-row-value';
  controls.append(picker, toggle);

  const item = popup.row({ id, label: message('popupSpeed'), hint: '', control: controls });
  const hint = item.querySelector(`[id="${id}-hint"]`)!;
  popup.watchSettings(({ speedOn, preferredSpeed }) => {
    toggle.checked = speedOn;
    picker.value = String(preferredSpeed);
    picker.disabled = toggle.disabled = false;
    hint.textContent = message(speedOn ? 'popupSpeedOn' : 'popupSpeedOff');
  });
  return item;
};
