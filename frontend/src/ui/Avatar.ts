// src/ui/Avatar.ts
import { domElem } from "./DomElement";

export function Avatar(url: string | null, size = 40) {
  const elem = domElem("div", {
    class: "rounded-full bg-gray-200 overflow-hidden flex-shrink-0",
    attributes: {
      style: `width:${size}px;height${size}px`,
    },
  });

  if (url) {
    const img = domElem("img", {
      class: "w-full h-full object-cover",
      attributes: {
        src: url,
        alt: "avatar",
      },
    });
    elem.appendChild(img);
  }

  return elem;
}
