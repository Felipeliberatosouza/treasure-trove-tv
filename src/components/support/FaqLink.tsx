import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
}

/** Link "Dúvidas?" que abre o FAQ público (sempre lido ao abrir, então reflete as edições do admin). */
const FaqLink = () => {
  const [open, setOpen] = useState(false);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("support_faqs")
      .select("id, category, question, answer")
      .eq("status", "active")
      .neq("category", "Atendimento")
      .order("category")
      .order("created_at")
      .then(({ data }) => {
        setFaqs((data as Faq[]) || []);
        setLoading(false);
      });
  }, [open]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, Faq[]>();
    faqs
      .filter((f) => !q || `${f.question} ${f.answer}`.toLowerCase().includes(q))
      .forEach((f) => map.set(f.category, [...(map.get(f.category) || []), f]));
    return [...map.entries()];
  }, [faqs, search]);

  return (
    <>
      <div className="text-center py-6">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle className="h-5 w-5 text-primary" />
          Dúvidas? <span className="font-semibold text-primary underline underline-offset-4">Tire suas dúvidas aqui!</span>
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Perguntas frequentes</DialogTitle>
            <DialogDescription>Encontre respostas rápidas sobre a Revisão Fácil.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Buscar dúvida..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-secondary border-border" />
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta encontrada.</p>}
          {groups.map(([cat, items]) => (
            <div key={cat}>
              <h3 className="mt-2 text-sm font-semibold text-primary">{cat}</h3>
              <Accordion type="single" collapsible>
                {items.map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger className="text-left text-sm">{f.question}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground whitespace-pre-wrap">{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FaqLink;
