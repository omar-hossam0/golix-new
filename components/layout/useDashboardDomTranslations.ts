import { RefObject, useEffect } from "react";
import type { DashboardLanguage } from "@/components/layout/dashboardFrameTypes";

function shouldSkipDomTranslation(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return true;
  if (/^(https?:|mailto:|tel:|data:|blob:)/i.test(trimmed)) return true;
  if (/^[\d\s.,:+\-/%#()]+$/.test(trimmed)) return true;
  return false;
}

type UseDashboardDomTranslationsArgs = {
  language: DashboardLanguage;
  pathname: string;
  contentRef: RefObject<HTMLDivElement | null>;
  translateLabel: (label: string, language: DashboardLanguage) => string;
};

export function useDashboardDomTranslations({
  language,
  pathname,
  contentRef,
  translateLabel,
}: UseDashboardDomTranslationsArgs) {
  useEffect(() => {
    const translateRoot = (root: HTMLElement) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];

      while (walker.nextNode()) nodes.push(walker.currentNode as Text);

      for (const node of nodes) {
        const parent = node.parentElement;
        const currentText = node.textContent ?? "";
        const trimmed = currentText.trim();

        if (!parent || !trimmed || parent.closest("script, style, input, textarea")) continue;
        if (shouldSkipDomTranslation(trimmed)) continue;

        const textNode = node as Text & { goalixOriginalText?: string };
        const savedOriginal = textNode.goalixOriginalText;
        const savedTranslation = savedOriginal ? translateLabel(savedOriginal, language).trim() : "";
        const currentLooksTranslated = /[\u0600-\u06FF]/.test(trimmed);
        const original =
          !savedOriginal || (trimmed !== savedOriginal && trimmed !== savedTranslation && !currentLooksTranslated)
            ? trimmed
            : savedOriginal;
        textNode.goalixOriginalText = original;

        const nextText = translateLabel(original, language);
        const leading = currentText.match(/^\s*/)?.[0] ?? "";
        const trailing = currentText.match(/\s*$/)?.[0] ?? "";
        const replacement = `${leading}${nextText}${trailing}`;

        if (node.textContent !== replacement) node.textContent = replacement;
      }

      const attributeElements = root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]");

      for (const element of attributeElements) {
        for (const attr of ["placeholder", "aria-label", "title"] as const) {
          const current = element.getAttribute(attr);
          if (!current?.trim()) continue;

          const dataKey = `goalixOriginal${attr.replace(/(^|-)([a-z])/g, (_, __, letter: string) => letter.toUpperCase())}`;
          const original = element.dataset[dataKey] ?? current;
          element.dataset[dataKey] = original;
          element.setAttribute(attr, translateLabel(original, language));
        }
      }
    };

    const applyTranslations = () => {
      const roots: HTMLElement[] = [];
      if (contentRef.current) roots.push(contentRef.current);

      document
        .querySelectorAll<HTMLElement>("[data-radix-portal], [data-radix-popper-content-wrapper], [role='dialog']")
        .forEach((element) => roots.push(element));

      roots.forEach((root) => translateRoot(root));
    };

    applyTranslations();

    const observeOptions: MutationObserverInit = {
      childList: true,
      subtree: true,
      characterData: true,
    };
    const pendingRoots = new Set<HTMLElement>();
    let animationFrame: number | null = null;

    const flushTranslations = () => {
      animationFrame = null;
      observer.disconnect();
      pendingRoots.forEach((root) => {
        if (root.isConnected) translateRoot(root);
      });
      pendingRoots.clear();
      observer.observe(document.body, observeOptions);
    };

    const scheduleTranslation = (root: HTMLElement | null) => {
      if (!root) return;
      pendingRoots.add(root);
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(flushTranslations);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          scheduleTranslation(mutation.target.parentElement);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scheduleTranslation(node);
          else scheduleTranslation(node.parentElement);
        });
      }
    });

    observer.observe(document.body, observeOptions);

    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [contentRef, language, pathname, translateLabel]);
}
