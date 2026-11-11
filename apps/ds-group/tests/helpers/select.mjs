// Browser test helpers for the design system's Select (ui/select.tsx): it is a button with a list drawn by us,
// so Playwright's selectOption, which only knows native <select>, does not apply.

/** Opens the select behind `trigger` and picks the option whose value is `value`. */
export async function chooseOption(trigger, value) {
  const page = trigger.page();
  await trigger.click();
  const option = page.locator(`.ds-select-popup[data-open] .ds-select-item[data-value=${JSON.stringify(value)}]`);
  await option.click();
  await option.waitFor({ state: 'detached' }).catch(() => option.waitFor({ state: 'hidden' }));
}

/** The value a select currently holds, read from the hidden input Base UI keeps for forms. */
export async function selectedValue(trigger) {
  return trigger.evaluate(element => {
    // Base UI renders the form input after the trigger, among its following siblings.
    for (let node = element.nextElementSibling; node; node = node.nextElementSibling) {
      if (node instanceof HTMLInputElement) return node.value;
    }
    return null;
  });
}

/**
 * The labels of a select's options, in order. The list exists only while it is open, so this opens and closes it;
 * a disabled select cannot open and shows its one value.
 */
export async function optionLabels(trigger) {
  if (await trigger.isDisabled()) return [(await trigger.textContent()).trim()];
  const page = trigger.page();
  await trigger.click();
  const items = page.locator('.ds-select-popup[data-open] .ds-select-item');
  await items.first().waitFor();
  const labels = (await items.allTextContents()).map(text => text.trim());
  await page.keyboard.press('Escape');
  await page.locator('.ds-select-popup[data-open]').waitFor({ state: 'detached' }).catch(() => {});
  return labels;
}

/**
 * Launch options that show classic scrollbars, the way Windows draws them by default. Headless Chromium hides
 * scrollbars unless told otherwise; with them shown, a scrollbar takes layout space and any sideways overflow
 * becomes a visible horizontal bar, which is how the problems on Windows show up.
 */
export const classicScrollbars = { ignoreDefaultArgs: ['--hide-scrollbars'] };
