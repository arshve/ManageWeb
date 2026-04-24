'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';

type RupiahInputProps = {
  value?: string | number | null;
  defaultValue?: string | number | null;
  onValueChange?: (raw: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  name?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

function toDigits(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  return String(v).replace(/\D/g, '');
}

function formatDigits(d: string): string {
  if (!d) return '';
  const n = Number(d);
  if (!isFinite(n)) return '';
  return 'Rp' + n.toLocaleString('id-ID');
}

export function RupiahInput({
  value,
  defaultValue,
  onValueChange,
  onKeyDown,
  name,
  id,
  placeholder,
  required,
  disabled,
  className,
}: RupiahInputProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => toDigits(defaultValue));
  const digits = isControlled ? toDigits(value) : internal;
  const display = formatDigits(digits);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = toDigits(e.target.value);
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  }

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder ? 'Rp' + Number(placeholder.replace(/\D/g, '')).toLocaleString('id-ID') : undefined}
        required={required}
        disabled={disabled}
        className={className}
      />
      {name && <input type="hidden" name={name} value={digits} />}
    </>
  );
}
