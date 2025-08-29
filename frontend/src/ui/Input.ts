// src/ui/Input.ts
import { domElem, mount } from "./DomElement";

export function LabeledInput(label: string, options: { type?: string; name?: string; placeholder?: string; value?: string } = {}) {
  const labelWrapper = domElem("label", { class: "flex flex-col gap-2" });
  const span = domElem("span", { class: "text-sm text-gray-500", text: label });
  const input = domElem("input", {
    class: "px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500",
    attributes: {
      type: options.type ?? "text",
      name: options.name ?? "",
      placeholder: options.placeholder ?? "",
      value: options.value ?? "",
    },
  });
  mount(labelWrapper, span, input);
  return { labelWrapper, input };
}
