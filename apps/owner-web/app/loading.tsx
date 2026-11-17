import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Memuat ruang usaha"
      id="main-content"
      tabIndex={-1}
      className="loading-page space-y-6"
    >
      <span className="sr-only">Memuat data tampilan…</span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
