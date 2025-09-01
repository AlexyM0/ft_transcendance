// src/ui/DomElement.ts

/**
 * DOM Elements factory
 */
export function domElem<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    class?: string;
    text?: string;
    attributes?: Record<string, string>;
    on?: Record<string, (e: Event) => void>;
  } = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text) node.textContent = options.text;
  if (options.attributes) {
    for (const [k, v] of Object.entries(options.attributes)) {
      node.setAttribute(k, v);
    }
  }
  if (options.on) {
    for (const [k, fn] of Object.entries(options.on)) {
      node.addEventListener(k, fn);
    }
  }
  return node;
}

/**
 * Appends a list of children to the parent element passed as argument
 */
export function mount(parent: HTMLElement, ...children: (HTMLElement | string | null | undefined)[]) {
  children.filter(Boolean).forEach((c) => parent.append(c as any));
  return parent;
}

type Unsubscribe = () => void;

/**
 * Binder to the createStore function
 */
export function bind<S>(
  store: {
    subscribe: (fn: () => void) => Unsubscribe;
    get: () => S;
  },
  render: (state: S) => void
) {
  render(store.get());
  const unsub = store.subscribe(() => render(store.get()));
  return () => unsub();
}
