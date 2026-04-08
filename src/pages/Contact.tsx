import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, MapPin, Clock, Phone } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const Contact = () => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const { data: contact } = usePlatformSettings("contact");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }

    if (form.name.length > 100 || form.email.length > 255 || form.subject.length > 200 || form.message.length > 2000) {
      toast.error("Um ou mais campos excedem o limite de caracteres.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error("Insira um e-mail válido.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    });
    setLoading(false);

    if (error) {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      return;
    }

    toast.success("Mensagem enviada com sucesso! Responderemos em breve.");
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  const displayEmail = contact?.email || "contato@revisaofacil.com";
  const displayPhone = contact?.phone;
  const displayAddress = contact?.address || "Brasil";

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 md:px-16 lg:px-32">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold text-gradient">Contato</h1>
          <p className="text-muted-foreground leading-relaxed">
            Tem alguma dúvida, sugestão ou precisa de ajuda? Preencha o formulário abaixo e nossa equipe responderá o mais rápido possível.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-5">
          <form onSubmit={handleSubmit} className="space-y-5 md:col-span-3">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="Seu nome completo" value={form.name} onChange={handleChange} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="seu@email.com" value={form.email} onChange={handleChange} maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto</Label>
              <Input id="subject" name="subject" placeholder="Sobre o que deseja falar?" value={form.subject} onChange={handleChange} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea id="message" name="message" placeholder="Escreva sua mensagem aqui..." value={form.message} onChange={handleChange} maxLength={2000} rows={5} />
            </div>
            <Button type="submit" disabled={loading} className="w-full font-display">
              {loading ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </form>

          <div className="space-y-6 md:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <h2 className="text-lg font-semibold">Informações de Contato</h2>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <a href={`mailto:${displayEmail}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {displayEmail}
                  </a>
                </div>
              </div>
              {displayPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">{displayPhone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Localização</p>
                  <p className="text-sm text-muted-foreground">{displayAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Horário de Atendimento</p>
                  <p className="text-sm text-muted-foreground">Segunda a Sexta, 9h às 18h</p>
                </div>
              </div>
              {(contact?.instagram || contact?.youtube || contact?.facebook || contact?.twitter) && (
                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-sm font-medium">Redes Sociais</p>
                  <div className="flex flex-wrap gap-3">
                    {contact.instagram && (
                      <a href={`https://instagram.com/${contact.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Instagram</a>
                    )}
                    {contact.youtube && (
                      <a href={contact.youtube} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">YouTube</a>
                    )}
                    {contact.facebook && (
                      <a href={contact.facebook} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Facebook</a>
                    )}
                    {contact.twitter && (
                      <a href={`https://x.com/${contact.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">X</a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
        </div>
      </div>
    </div>
  );
};

export default Contact;
