export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { formatRupiah, formatWeight } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Beef } from 'lucide-react';
import Image from 'next/image';

export default async function CataloguePage() {
  const livestock = await prisma.livestock.findMany({
    where: { isSold: false, condition: 'SEHAT' },
    orderBy: { createdAt: 'desc' },
  });

  const typeLabels: Record<string, string> = {
    KAMBING: 'Kambing',
    DOMBA: 'Domba',
    SAPI: 'Sapi',
  };

  return (
    <main className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header — Squarespace bold style */}
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-4">
            Katalog
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Hewan Qurban Tersedia
          </h1>
          <p className="text-lg text-muted-foreground">
            {livestock.length} hewan dalam kondisi sehat dan siap qurban.
          </p>
        </div>

        {livestock.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Beef className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Belum ada hewan tersedia saat ini.</p>
            <p className="text-sm mt-1">Silakan cek kembali nanti.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {livestock.map((item, index) => (
              <div key={item.id} className="group">
                {/* Image area */}
                <div className="relative aspect-[4/3] bg-secondary mb-4 overflow-hidden">
                  {item.photoUrl ? (
                    <Image
                      src={item.photoUrl}
                      alt={`${item.type}${item.grade ? ' ' + item.grade : ''} - ${item.sku}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      priority={index === 0}
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Beef className="h-16 w-16 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {typeLabels[item.type]}
                      {item.grade ? ` — Grade ${item.grade}` : ''}
                    </h3>
                    <Badge variant="outline" className="text-xs font-normal">
                      {item.condition}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {item.sku}
                  </p>
                  {formatWeight(item.weightMin, item.weightMax) && (
                    <p className="text-sm text-muted-foreground">
                      Berat: {formatWeight(item.weightMin, item.weightMax)}
                    </p>
                  )}
                  {item.hargaJual && (
                    <p className="text-lg font-bold">
                      {formatRupiah(item.hargaJual)}
                    </p>
                  )}
                  {item.tag && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Tag: {item.tag}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
