import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">403</h1>
        <p className="text-muted-foreground">
          Anda tidak memiliki akses ke halaman ini.
        </p>
        <Link href="/" className={buttonVariants()}>
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
