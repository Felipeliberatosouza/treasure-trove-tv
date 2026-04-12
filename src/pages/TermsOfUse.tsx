import { useState } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const fallbackStudentSections = [
  { title: "1. Aceitação dos Termos", content: "Ao acessar ou utilizar a plataforma como aluno, você concorda em cumprir e estar vinculado a estes Termos de Uso." },
];

const fallbackTeacherSections = [
  { title: "1. Aceitação dos Termos", content: "Ao acessar ou utilizar a plataforma como professor, você concorda em cumprir e estar vinculado a estes Termos de Uso." },
];

const TermsOfUse = () => {
  const [tab, setTab] = useState<"students" | "teachers">("students");
  const { data: studentData, loading: loadingStudents } = usePlatformSettings("terms_of_use_students");
  const { data: teacherData, loading: loadingTeachers } = usePlatformSettings("terms_of_use_teachers");

  const studentSections = studentData?.sections?.length ? studentData.sections : fallbackStudentSections;
  const teacherSections = teacherData?.sections?.length ? teacherData.sections : fallbackTeacherSections;

  const sections = tab === "students" ? studentSections : teacherSections;
  const loading = tab === "students" ? loadingStudents : loadingTeachers;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-3xl space-y-8">
          <h1 className="font-display text-3xl font-bold text-gradient">Termos de Uso</h1>

          <div className="flex gap-2">
            <button
              onClick={() => setTab("students")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === "students"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Para Alunos
            </button>
            <button
              onClick={() => setTab("teachers")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === "teachers"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Para Professores
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((sec, idx) => (
                <section key={idx} className="space-y-2">
                  {sec.title && <h2 className="text-xl font-semibold">{sec.title}</h2>}
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{sec.content}</p>
                </section>
              ))}
            </div>
          )}

          <div className="pt-6 border-t border-border">
            <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TermsOfUse;
