import { useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const dateOptions = [
  ["All", "All time"],
  ["Today", "Today"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
];
export function NoteDialog({
  initial,
  contact,
  onClose,
  onSave,
}: {
  initial: string;
  contact: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initial);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Follow-up note</DialogTitle>
          <DialogDescription>
            {contact} · Notes are kept on this page only and are not saved.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(note.trim());
          }}
        >
          <label className="block space-y-2 text-sm font-medium">
            Note
            <Textarea
              autoFocus
              aria-label="Follow-up note"
              className="min-h-32"
              maxLength={2000}
              placeholder="Add context for the next conversation…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Save />
              Save note
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function RecordPagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        {total
          ? `${page * 10 + 1}–${Math.min(page * 10 + 10, total)} of ${total} records`
          : "0 records"}
      </span>
      <div className="flex items-center gap-3">
        <span>
          Page {page + 1} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          title="Previous page"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="Next page"
          aria-label="Next page"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
