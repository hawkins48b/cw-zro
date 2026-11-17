import { readFileSync } from "node:fs";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import StepButton from "#lib/components/StepButton.svelte";
import StepperField from "#lib/components/StepperField.svelte";

// − and + hidden when the main pointer is a mouse or trackpad (#171). jsdom applies no Tailwind CSS,
// so this checks the wiring: the variant in app.css and the classes that use it.

let app;
let target;

function show(Component, props) {
  target = document.createElement("div");
  document.body.appendChild(target);
  app = mount(Component, { target, props });
  flushSync();
  return target;
}

afterEach(() => {
  if (app) unmount(app);
  target?.remove();
  app = undefined;
});

describe("steppers with a mouse (#171)", () => {
  it("defines the pointer-fine variant as (pointer: fine), not a width", () => {
    const css = readFileSync("src/app.css", "utf-8");
    expect(css).toMatch(
      /@custom-variant pointer-fine \(@media \(pointer: fine\)\);/,
    );
  });

  it("hides both StepperField buttons and pads the box instead", () => {
    const el = show(StepperField, {
      value: "10",
      spec: { step: 1, min: 0, max: 100, start: 0 },
      decreaseLabel: "down",
      increaseLabel: "up",
      onchange: () => {},
    });
    const buttons = el.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons)
      expect(b.classList.contains("pointer-fine:hidden")).toBe(true);
    const box = el.querySelector("input").parentElement;
    expect(box.classList.contains("!p-0")).toBe(true);
    expect(box.classList.contains("pointer-fine:!px-1.5")).toBe(true);
  });

  it("hides the standalone button (cant row) too", () => {
    const el = show(StepButton, {
      dir: "up",
      label: "up",
      variant: "standalone",
      onclick: () => {},
    });
    expect(
      el.querySelector("button").classList.contains("pointer-fine:hidden"),
    ).toBe(true);
  });
});
