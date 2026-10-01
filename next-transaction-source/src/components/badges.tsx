import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const priorityClass: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-900 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusClass: Record<string, string> = {
  new: "bg-sky-50 text-sky-800 border-sky-200",
  saved: "bg-indigo-50 text-indigo-800 border-indigo-200",
  investigating: "bg-violet-50 text-violet-800 border-violet-200",
  contacted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  dismissed: "bg-stone-100 text-stone-600 border-stone-200",
};

const qualityClass: Record<string, string> = {
  strong: "bg-emerald-50 text-emerald-800 border-emerald-200",
  moderate: "bg-sky-50 text-sky-800 border-sky-200",
  weak: "bg-stone-100 text-stone-700 border-stone-200",
  conflicting: "bg-orange-50 text-orange-800 border-orange-200",
  incomplete: "bg-amber-50 text-amber-900 border-amber-200",
};

export function PriorityBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", priorityClass[value])}>
      {value}
    </Badge>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusClass[value])}>
      {value}
    </Badge>
  );
}

export function QualityBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", qualityClass[value])}>
      {value}
    </Badge>
  );
}

export function FictionalBadge() {
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
      Fictional demo data
    </Badge>
  );
}

export function TypeBadge({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {value}
    </Badge>
  );
}
