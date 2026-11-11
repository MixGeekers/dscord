import { useEffect, useRef, useState } from "react";
import type { Ref } from "react";

// Base UI mirrors values into hidden inputs for FormData. Its uncontrolled visual
// state does not follow HTMLFormElement.reset(), so remount only that primitive
// when the owning form resets. Controlled callers keep their supplied state.
export function useFormReset(
  inputRef: Ref<HTMLInputElement> | undefined,
  formId?: string,
) {
  const node = useRef<HTMLInputElement | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const form =
      node.current?.form ?? (formId ? document.getElementById(formId) : null);
    if (!form) return;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) setVersion((previous) => previous + 1);
      });
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [version, formId]);
  function connectInput(element: HTMLInputElement | null) {
    node.current = element;
    if (typeof inputRef === "function") inputRef(element);
    else if (inputRef) inputRef.current = element;
  }
  return { version, connectInput };
}
