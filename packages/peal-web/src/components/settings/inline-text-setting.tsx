"use client";

import { Input } from "peal-ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "peal-ui/components/input-group";
import { useState, useTransition } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

// Without a check of its own, any text the field holds may be saved.
const anyText = (): boolean => true;

/**
 * A setting's text, typed in place at the end of its row and saved once the
 * person leaves the field or presses Enter (DESIGN.md, "Settings"): there is
 * nothing to press. Escape puts the saved value back. `save` answers whether
 * it was saved, and a value refused goes back to the saved one; `check`
 * keeps a value the server would refuse from being sent, and marks the
 * field invalid while it is typed.
 */
export const InlineTextSetting = ({
  autoComplete,
  check = anyText,
  describedBy,
  disabled = false,
  id,
  prefix = null,
  save,
  value,
}: {
  readonly autoComplete: string;
  readonly check?: (value: string) => boolean;
  readonly describedBy?: string;
  readonly disabled?: boolean;
  readonly id: string;
  /** What stands before the text, in a segment: the site's address. */
  readonly prefix?: string | null;
  readonly save: (value: string) => Promise<boolean>;
  readonly value: string;
}) => {
  const [typed, setTyped] = useState(value);
  const [isPending, startTransition] = useTransition();
  const chosen = typed.trim();

  const commit = () => {
    if (chosen === value || chosen === "" || !check(chosen)) {
      setTyped(value);

      return;
    }

    startTransition(async () => {
      const saved = await save(chosen);

      setTyped(saved ? chosen : value);
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTyped(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }

    if (event.key === "Escape") {
      setTyped(value);
    }
  };

  const props = {
    "aria-busy": isPending,
    "aria-describedby": describedBy,
    "aria-invalid": chosen !== "" && !check(chosen),
    autoComplete,
    disabled: disabled || isPending,
    id,
    name: id,
    onBlur: commit,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    spellCheck: false,
    type: "text",
    value: typed,
  } as const;

  return (
    <div className="flex w-full sm:w-72">
      {prefix === null ? (
        <Input {...props} />
      ) : (
        <InputGroup>
          <InputGroupAddon variant="segment">
            <InputGroupText>{prefix}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput {...props} />
        </InputGroup>
      )}
    </div>
  );
};
