import React, { useEffect, useState } from 'react';

import { Input } from '@actual-app/components/input';

type NumberFieldProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: number;
  min?: number;
  invalid?: boolean;
  width?: number;
};

/**
 * A number input that keeps what the user types (e.g. "-" or "3.") while
 * editing, and only reports values that parse as numbers.
 */
export function NumberField({
  value,
  onChange,
  label,
  step = 1,
  min,
  invalid = false,
  width = 110,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));

  // Follow outside changes (loading a saved mix, resetting) but never fight
  // with a value the user is still typing.
  useEffect(() => {
    setText(current => (Number(current) === value ? current : String(value)));
  }, [value]);

  return (
    <Input
      type="number"
      aria-label={label}
      aria-invalid={invalid}
      step={step}
      min={min}
      value={text}
      style={{
        width,
        textAlign: 'end',
        ...(invalid ? { borderColor: 'var(--color-errorBorder)' } : {}),
      }}
      onChangeValue={next => {
        setText(next);
        const parsed = parseFloat(next);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
}
