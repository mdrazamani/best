import { useEffect, useRef, useState } from 'react';
import Select, { components } from 'react-select';
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
  isSearchable = true,
  actionLabel,
  actionTitle,
  onActionClick,
  actionDisabled,
  actionOnEnter = false
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
  actionLabel?: string;
  actionTitle?: string;
  onActionClick?: (inputValue: string) => void;
  actionDisabled?: boolean;
  actionOnEnter?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? null;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
  const [insideDialog, setInsideDialog] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const dialogContent = wrapperRef.current?.closest('[data-dialog-content="true"]') as HTMLElement | null;
    setInsideDialog(Boolean(dialogContent));
    setPortalTarget(dialogContent ?? document.body);
  }, []);

  const effectivePortalTarget = insideDialog ? undefined : portalTarget;
  const effectiveMenuPosition = insideDialog ? 'absolute' : 'fixed';
  const normalizedInput = inputValue.trim();
  const normalizedInputLower = normalizedInput.toLocaleLowerCase();

  return (
    <div ref={wrapperRef} className={cn('w-full text-right', className)}>
      <Select<SearchableSelectOption, false>
        isRtl
        options={options}
        value={selected}
        onChange={(option) => {
          onChange(option?.value ?? '');
          setInputValue('');
        }}
        inputValue={inputValue}
        onInputChange={(nextInputValue, meta) => {
          if (meta.action === 'input-change') {
            setInputValue(nextInputValue);
          } else if (meta.action === 'menu-close' || meta.action === 'set-value' || meta.action === 'input-blur') {
            setInputValue('');
          }
          return nextInputValue;
        }}
        onKeyDown={(event) => {
          if (!onActionClick || !actionOnEnter || event.key !== 'Enter') return;
          if (!normalizedInput) return;
          event.preventDefault();
          event.stopPropagation();
          const exactMatch = options.find((item) => item.label.trim().toLocaleLowerCase() === normalizedInputLower);
          if (exactMatch) {
            onChange(exactMatch.value);
            setInputValue('');
            return;
          }
          onActionClick(normalizedInput);
        }}
        isDisabled={disabled}
        isSearchable={isSearchable}
        placeholder={placeholder}
        noOptionsMessage={() => emptyLabel ?? 'موردی پیدا نشد.'}
        menuPortalTarget={effectivePortalTarget}
        menuPosition={effectiveMenuPosition}
        menuShouldScrollIntoView={false}
        menuShouldBlockScroll={!insideDialog}
        classNamePrefix="best-select"
        components={{
          IndicatorsContainer: (props) => (
            <components.IndicatorsContainer {...props}>
              {onActionClick ? (
                <button
                  type="button"
                  className="mx-1 inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input px-2 text-base font-semibold leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (disabled || actionDisabled) return;
                    onActionClick(normalizedInput);
                  }}
                  disabled={disabled || actionDisabled}
                  aria-label={actionLabel ?? 'عملیات'}
                  title={actionTitle ?? actionLabel}
                >
                  +
                </button>
              ) : null}
              {props.children}
            </components.IndicatorsContainer>
          )
        }}
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
          menuPortal: (base) => ({
            ...base,
            zIndex: 320
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
