// src/ui/Avatar.ts
import { domElem } from "./DomElement";

const DEFAULT_AVATAR = "/user.png";

export function Avatar(url: string | null, size = 40) {
  const elem = domElem("div", {
    class: "rounded-full overflow-hidden flex-shrink-0",
    attributes: {
      style: `width:${size}px;height${size}px`,
    },
  });

  const img = domElem("img", {
    class: "object-cover",
    attributes: {
      src: url ?? DEFAULT_AVATAR,
      alt: "avatar",
    },
  });
  elem.appendChild(img);

  return elem;
}
