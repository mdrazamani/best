import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { SearchableSelect } from '../ui/searchable-select';
import { Textarea } from '../ui/textarea';

type Option = { value: string; label: string };

type CreateCustomerPayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  description?: string;
  referredByCollaboratorId?: string;
};

type CreateCustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCustomerPayload) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  lockedReferrer?: { id: string; label: string };
  referrerOptions?: Option[];
};

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  description: '',
  referredByCollaboratorId: ''
};

export function CreateCustomerDialog({
  open,
  onOpenChange,
  onSubmit,
  title = 'ثبت مشتری جدید',
  description = 'اطلاعات مشتری را کامل کنید.',
  submitLabel = 'ثبت مشتری',
  lockedReferrer,
  referrerOptions
}: CreateCustomerDialogProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm((prev) => ({
        ...emptyForm,
        referredByCollaboratorId: lockedReferrer?.id ?? prev.referredByCollaboratorId
      }));
      return;
    }

    if (lockedReferrer?.id) {
      setForm((prev) => ({ ...prev, referredByCollaboratorId: lockedReferrer.id }));
    }
  }, [open, lockedReferrer?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone || undefined,
      address: form.address || undefined,
      description: form.description || undefined,
      referredByCollaboratorId: lockedReferrer?.id ?? (form.referredByCollaboratorId || undefined)
    });
    onOpenChange(false);
  };

  const options = referrerOptions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input required placeholder="نام" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
            <Input required placeholder="نام خانوادگی" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
            <Input placeholder="شماره تماس" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            {lockedReferrer ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm md:col-span-1">
                معرف: {lockedReferrer.label}
              </div>
            ) : options.length ? (
              <SearchableSelect
                options={[{ value: '', label: 'بدون معرف' }, ...options]}
                value={form.referredByCollaboratorId}
                onChange={(value) => setForm((prev) => ({ ...prev, referredByCollaboratorId: value }))}
                placeholder="انتخاب معرف (اختیاری)"
              />
            ) : null}
            <Textarea placeholder="آدرس" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="md:col-span-2 min-h-[88px]" />
            <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-2 min-h-[88px]" />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

