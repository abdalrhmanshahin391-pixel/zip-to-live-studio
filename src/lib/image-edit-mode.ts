/* Shared "image edit mode" store (presentation only).
   When on, admins see a small "Change image" button over every editable
   picture. Mirrors src/lib/admin-mode.ts so every hook instance stays in
   sync across the app. */

import { useSyncExternalStore } from "react";

const KEY = "rita.imageEditMode";

let value = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setImageEditMode(next: boolean) {
  value = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

let hydrated = false;
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    if (localStorage.getItem(KEY) === "1" && !value) {
      value = true;
      emit();
    }
  } catch {
    /* ignore */
  }
}

export function useImageEditMode() {
  hydrate();
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => false,
  );
}
