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
  return (
    <DatePicker
      value={value ? new Date(value) : undefined}
      calendar={persian}
      locale={persianFa}
      calendarPosition="bottom-right"
      portal
      zIndex={140}
      format="YYYY/MM/DD"
      containerClassName="w-full"
      inputClass={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      placeholder={placeholder ?? 'انتخاب تاریخ'}
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
