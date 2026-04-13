const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function below1000(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return below1000(n - 10) + ' Belas';
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    return below1000(tens) + ' Puluh' + (rest ? ' ' + below1000(rest) : '');
  }
  if (n < 200) return 'Seratus' + (n - 100 ? ' ' + below1000(n - 100) : '');
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return below1000(hundreds) + ' Ratus' + (rest ? ' ' + below1000(rest) : '');
  }
  return '';
}

function below1M(n: number): string {
  if (n < 1000) return below1000(n);
  if (n < 2000) return 'Seribu' + (n - 1000 ? ' ' + below1000(n - 1000) : '');
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return below1000(thousands) + ' Ribu' + (rest ? ' ' + below1000(rest) : '');
}

function below1B(n: number): string {
  if (n < 1_000_000) return below1M(n);
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  return below1000(millions) + ' Juta' + (rest ? ' ' + below1M(rest) : '');
}

export function terbilang(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Nol Rupiah';
  let result: string;
  if (n < 1_000_000_000) {
    result = below1B(n);
  } else {
    const billions = Math.floor(n / 1_000_000_000);
    const rest = n % 1_000_000_000;
    result = below1000(billions) + ' Miliar' + (rest ? ' ' + below1B(rest) : '');
  }
  return (result.trim() + ' Rupiah').replace(/\s+/g, ' ');
}
