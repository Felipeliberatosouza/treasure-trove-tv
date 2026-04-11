import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthCheckerProps {
  password: string;
  birthDate?: string;
}

const EASY_SEQUENCES = [
  "123456", "654321", "abcdef", "fedcba", "qwerty", "password", "senha",
  "111111", "222222", "333333", "444444", "555555", "666666", "777777",
  "888888", "999999", "000000", "aaaaaa", "abcabc", "123123",
];

const PasswordStrengthChecker = ({ password, birthDate }: PasswordStrengthCheckerProps) => {
  const criteria = useMemo(() => {
    const pwd = password || "";

    const hasMinLength = pwd.length >= 6;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    // Check if password contains birth date digits (e.g. 19900115, 15011990, 150190)
    let isNotBirthDate = true;
    if (birthDate && pwd.length >= 6) {
      const clean = birthDate.replace(/\D/g, "");
      if (clean.length === 8) {
        const variants = [
          clean,
          clean.slice(6, 8) + clean.slice(4, 6) + clean.slice(0, 4),
          clean.slice(6, 8) + clean.slice(4, 6) + clean.slice(2, 4),
          clean.slice(0, 4) + clean.slice(4, 6) + clean.slice(6, 8),
        ];
        isNotBirthDate = !variants.some((v) => pwd.includes(v));
      }
    }

    const isNotEasySequence = !EASY_SEQUENCES.some(
      (seq) => pwd.toLowerCase().includes(seq)
    );

    return [
      { label: "Mínimo de 6 caracteres", met: hasMinLength },
      { label: "Uma letra maiúscula", met: hasUppercase },
      { label: "Um número", met: hasNumber },
      { label: "Um caractere especial (!@#$...)", met: hasSpecial },
      { label: "Não pode ser data de nascimento", met: isNotBirthDate },
      { label: "Não pode ser sequência fácil", met: isNotEasySequence },
    ];
  }, [password, birthDate]);

  const allMet = criteria.every((c) => c.met);

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {criteria.map((c) => (
        <div key={c.label} className="flex items-center gap-2 text-xs">
          {c.met ? (
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
          <span className={c.met ? "text-green-500" : "text-muted-foreground"}>
            {c.label}
          </span>
        </div>
      ))}
      {allMet && (
        <p className="text-xs text-green-500 font-medium mt-1">✓ Senha segura!</p>
      )}
    </div>
  );
};

export function validatePassword(password: string, birthDate?: string): string | null {
  if (password.length < 6) return "A senha deve ter pelo menos 6 caracteres";
  if (!/[A-Z]/.test(password)) return "A senha deve conter uma letra maiúscula";
  if (!/\d/.test(password)) return "A senha deve conter um número";
  if (!/[^A-Za-z0-9]/.test(password)) return "A senha deve conter um caractere especial";
  if (birthDate) {
    const clean = birthDate.replace(/\D/g, "");
    if (clean.length === 8) {
      const variants = [
        clean,
        clean.slice(6, 8) + clean.slice(4, 6) + clean.slice(0, 4),
        clean.slice(6, 8) + clean.slice(4, 6) + clean.slice(2, 4),
      ];
      if (variants.some((v) => password.includes(v))) return "A senha não pode conter sua data de nascimento";
    }
  }
  if (EASY_SEQUENCES.some((seq) => password.toLowerCase().includes(seq))) return "A senha não pode ser uma sequência fácil";
  return null;
}

export default PasswordStrengthChecker;
