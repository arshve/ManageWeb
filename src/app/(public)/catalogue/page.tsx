export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Beef } from "lucide-react";
import Image from "next/image";

export default async function CataloguePage() {
  const livestock = await prisma.livestock.findMany({
    where: { isSold: false, condition: "SEHAT" },
    orderBy: { createdAt: "desc" },
  });

  const pricing = await prisma.pricing.findMany();
  const priceMap = new Map(
    pricing.map((p) => [`${p.animalType}-${p.grade}`, p.hargaJual])
  );

  const typeLabels: Record<string, string> = {
    KAMBING: "Kambing",
    DOMBA: "Domba",
    SAPI: "Sapi",
  };

  return (
    <main className="py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Katalog Hewan Qurban
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Pilih hewan qurban berkualitas dari Millenials Farm. Semua hewan
            dalam kondisi sehat dan siap qurban.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {livestock.length} hewan tersedia
          </p>
        </div>

        {livestock.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Beef className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Belum ada hewan tersedia saat ini.</p>
            <p className="text-sm mt-1">Silakan cek kembali nanti.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {livestock.map((item) => {
              const price = priceMap.get(`${item.type}-${item.grade}`);
              return (
                <Card
                  key={item.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative h-52 bg-gradient-to-br from-primary/10 to-muted flex items-center justify-center">
                    {item.photoUrl ? (
                      <Image
                        src={item.photoUrl}
                        alt={`${item.type} ${item.grade} - ${item.sku}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Beef className="h-20 w-20 text-primary/20" />
                    )}
                    <Badge className="absolute top-3 left-3">
                      {typeLabels[item.type] || item.type}
                    </Badge>
                    <Badge variant="outline" className="absolute top-3 right-3 bg-background">
                      Grade {item.grade}
                    </Badge>
                  </div>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        {typeLabels[item.type]} — Grade {item.grade}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {item.sku}
                    </p>
                    {item.weight && (
                      <p className="text-sm text-muted-foreground">
                        Berat: {item.weight} kg
                      </p>
                    )}
                    {price && (
                      <p className="text-lg font-bold text-primary">
                        {formatRupiah(price)}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {item.tagBsd && (
                        <Badge variant="outline" className="text-xs">
                          BSD: {item.tagBsd}
                        </Badge>
                      )}
                      {item.tagKandang && (
                        <Badge variant="outline" className="text-xs">
                          Kandang: {item.tagKandang}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
