import DatePicker, { type DateObject } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persianFa from 'react-date-object/locales/persian_fa';
import { cn } from '../../lib/utils';

export function PersianDatePicker({
  value,
  onChange,
  placeholder,
  className
}: {
  value?: string;
  onChange: (value?: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const parsedValue = (() => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
  })();

  return (
    <DatePicker
      value={parsedValue}
      calendar={persian}
      locale={persianFa}
      calendarPosition="bottom-right"
      zIndex={260}
      format="YYYY/MM/DD"
      editable={false}
      containerClassName="w-full"
      inputClass={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      placeholder={placeholder ?? '?????? ?????'}
      onChange={(selected) => {
        const raw = selected as DateObject | DateObject[] | null;
        if (!raw || Array.isArray(raw)) {
          onChange(undefined);
          return;
        }
        if (!raw.isValid) {
          onChange(undefined);
          return;
        }
        onChange(raw.toDate().toISOString());
      }}
    />
  );
}
