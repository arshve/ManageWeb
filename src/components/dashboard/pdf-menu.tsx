'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText } from 'lucide-react';

export function PdfMenu({ entryId }: { entryId: string }) {
  function download(type: 'invoice' | 'kwitansi', variant?: 'dp' | 'full') {
    const qs = variant
      ? `?type=${type}&variant=${variant}`
      : `?type=${type}`;
    window.open(`/api/entries/${entryId}/pdf${qs}`, '_blank');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Download PDF"
          />
        }
      >
        <FileText className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => download('invoice')}>
          Invoice
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Kwitansi</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => download('kwitansi', 'dp')}>
            DP
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => download('kwitansi', 'full')}>
            Pelunasan
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
