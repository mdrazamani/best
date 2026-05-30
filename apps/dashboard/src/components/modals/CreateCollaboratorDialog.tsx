import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type CreateCollaboratorPayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  description?: string;
};

type CreateCollaboratorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCollaboratorPayload) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
};

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  description: ''
};

export function CreateCollaboratorDialog({
  open,
  onOpenChange,
  onSubmit,
  title = 'ثبت همکار جدید',
  description = 'اطلاعات همکار را کامل کنید.',
  submitLabel = 'ثبت همکار'
}: CreateCollaboratorDialogProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName && !lastName) {
      toast.error('نام یا نام خانوادگی را وارد کنید.');
      return;
    }
    await onSubmit({
      firstName,
      lastName,
      phone: form.phone || undefined,
      address: form.address || undefined,
      description: form.description || undefined
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="نام" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
            <Input placeholder="نام خانوادگی" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
            <Input placeholder="شماره تماس" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <Textarea placeholder="آدرس" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="md:col-span-2 min-h-[92px]" />
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

