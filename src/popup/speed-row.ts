import { PREFERRED_SPEEDS } from '@/settings/settings';
import type { PopupRow } from './rows';

/**
 * The Speed row: a switch for Speed and a picker for the Preferred Speed,
 * which every new Short plays at while Speed is on. The picker works with
 * Speed off too, so the viewer can set the speed before turning it on.
 */
export const speedRow: PopupRow = (popup) => {
  const { document, signal, getMessage } = popup;
  const id = 'sf-setting-speed';

  const picker = document.createElement('select');
  picker.className = 'sf-select';
  picker.setAttribute('aria-label', getMessage('popupPreferredSpeed'));
  for (const speed of PREFERRED_SPEEDS) {
    picker.append(new Option(getMessage('popupSpeedValue', [popup.formatNumber(speed)]), String(speed)));
  }
  picker.addEventListener('change', () => popup.changeSettings({ preferredSpeed: Number(picker.value) }), { signal });

  const toggle = popup.switchInput(id, `${id}-hint`);
  toggle.addEventListener('change', () => popup.changeSettings({ speedOn: toggle.checked }), { signal });

  // Disabled until the settings arrive, so nothing shows a guess.
  picker.disabled = toggle.disabled = true;

  const controls = document.createElement('span');
  controls.className = 'sf-row-value';
  controls.append(picker, toggle);

  // The name and hint are the switch's label, as in every other switch row.
  const { item, hint } = popup.row({ id, label: getMessage('popupSpeed'), control: controls, labelFor: toggle });
  popup.watchSettings(({ speedOn, preferredSpeed }) => {
    toggle.checked = speedOn;
    picker.value = String(preferredSpeed);
    picker.disabled = toggle.disabled = false;
    hint.textContent = getMessage(speedOn ? 'popupSpeedOn' : 'popupSpeedOff');
  });
  return item;
};
