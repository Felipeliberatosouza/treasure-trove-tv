const errorMap: Record<string, string> = {
  "User already registered": "Este e-mail já está cadastrado na plataforma.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "Unable to validate email address: invalid format": "Formato de e-mail inválido.",
  "Signup requires a valid password": "É necessário informar uma senha válida.",
  "To signup, please provide your email": "É necessário informar um e-mail para cadastro.",
  "A user with this email address has already been registered": "Este e-mail já está cadastrado na plataforma.",
  "Email address already in use by another account": "Este e-mail já está em uso por outra conta.",
};

export function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return message;
}
