import { useEffect, useRef, useState } from 'react';
import { Input, type InputRef } from 'antd';

/**
 * Click-to-edit text. Enter confirms, Esc cancels, blur cancels.
 * `parse` lets numeric fields validate/normalise before saving.
 */
export default function EditableText({
  value,
  onSave,
  width = 120,
  align = 'left',
  parse,
  display,
  maxLength,
  invalid = false,
  placeholder,
}: {
  value: string | number;
  onSave: (next: string) => void;
  width?: number;
  align?: 'left' | 'right';
  parse?: (raw: string) => string | null;
  display?: (v: string | number) => string;
  maxLength?: number;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<InputRef>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      setTimeout(() => ref.current?.focus({ cursor: 'all' }), 0);
    }
  }, [editing, value]);

  const commit = () => {
    const normalised = parse ? parse(draft.trim()) : draft.trim();
    if (normalised === null) {
      setEditing(false);
      return;
    }
    if (normalised !== String(value)) onSave(normalised);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        size="small"
        status={invalid ? 'error' : undefined}
        placeholder={placeholder}
        style={{ width, textAlign: align }}
        maxLength={maxLength}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={commit}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="点击编辑，回车确认"
      style={{
        cursor: 'text',
        padding: '2px 6px',
        borderRadius: 5,
        border: invalid ? '1px solid #ff4d4f' : '1px solid transparent',
        borderBottom: invalid ? '1px solid #ff4d4f' : '1px dashed #b7bccb',
        background: invalid ? '#fff1f0' : undefined,
        display: 'inline-block',
        minWidth: 36,
        textAlign: align,
      }}
    >
      {(display ? display(value) : String(value)) || <span style={{ color: '#b7bccb' }}>—</span>}
    </span>
  );
}
