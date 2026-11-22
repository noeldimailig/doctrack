import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchFormProps {
  action: string;
  defaultValue?: string;
  placeholder?: string;
}

export function SearchForm({ action, defaultValue = "", placeholder = "Search..." }: SearchFormProps) {
  return (
    <form action={action} method="get" className="flex w-full max-w-sm items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={defaultValue} placeholder={placeholder} className="pl-8" />
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
