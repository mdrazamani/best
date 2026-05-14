import Select from 'react-select';
import { cn } from '../../lib/utils';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  className,
  disabled,
  isSearchable = true
}: {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  isSearchable?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <div className={cn('w-full text-right', className)}>
      <Select<SearchableSelectOption, false>
        isRtl
        options={options}
        value={selected}
        onChange={(option) => onChange(option?.value ?? '')}
        isDisabled={disabled}
        isSearchable={isSearchable}
        placeholder={placeholder}
        noOptionsMessage={() => emptyLabel ?? 'موردی پیدا نشد.'}
        classNamePrefix="best-select"
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: 40,
            borderRadius: 8,
            borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            backgroundColor: 'hsl(var(--background))',
            boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring) / 0.18)' : 'none',
            '&:hover': { borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))' }
          }),
          valueContainer: (base) => ({ ...base, paddingInline: 12 }),
          placeholder: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
          singleValue: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
          input: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
          menu: (base) => ({
            ...base,
            zIndex: 130,
            borderRadius: 10,
            border: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--card))',
            overflow: 'hidden'
          }),
          menuList: (base) => ({ ...base, paddingBlock: 4 }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
              ? 'hsl(var(--primary))'
              : state.isFocused
                ? 'hsl(var(--muted))'
                : 'transparent',
            color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: 14
          }),
          indicatorSeparator: () => ({ display: 'none' }),
          dropdownIndicator: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))', paddingInline: 8 })
        }}
      />
    </div>
  );
}
