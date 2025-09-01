// src/ui/Icons.ts
import { domElem } from "./DomElement";

export function Icon(srcPath: string, alt: string) {
  const icon = domElem("img", {
    class: "w-10 h-10 object-contain",
    attributes: { src: `${srcPath}`, alt },
  });
  return icon;
}
