import { useCallback, useSyncExternalStore } from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 5000;

export interface ToastItem extends Omit<ToastProps, "id"> {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
}

type Listener = () => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener());
}

function scheduleRemoval(id: string) {
  if (timeouts.has(id)) return;
  const timeout = setTimeout(() => {
    timeouts.delete(id);
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, TOAST_REMOVE_DELAY);
  timeouts.set(id, timeout);
}

function dismiss(id?: string) {
  toasts = toasts.map((t) => (id === undefined || t.id === id ? { ...t, open: false } : t));
  emit();
  (id === undefined ? toasts.map((t) => t.id) : [id]).forEach(scheduleRemoval);
}

export function toast(props: Omit<ToastItem, "id" | "open">) {
  const id = crypto.randomUUID();
  const item: ToastItem = {
    ...props,
    id,
    open: true,
    onOpenChange: (open) => {
      if (!open) dismiss(id);
    },
  };
  toasts = [item, ...toasts].slice(0, TOAST_LIMIT);
  emit();
  scheduleRemoval(id);
  return id;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function useToast() {
  const items = useSyncExternalStore(subscribe, getSnapshot);
  const dismissToast = useCallback((id?: string) => dismiss(id), []);
  return { toasts: items, toast, dismiss: dismissToast };
}
