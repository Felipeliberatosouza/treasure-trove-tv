const errorMap: Record<string, string> = {
  "Email not confirmed": "Confirme seu cadastro no e-mail enviado para você!",
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Invalid email or password": "E-mail ou senha incorretos.",
  "User already registered": "Este e-mail já está cadastrado na plataforma.",
  "A user with this email address has already been registered": "Este e-mail já está cadastrado na plataforma.",
  "Email address already in use by another account": "Este e-mail já está em uso por outra conta.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "Rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "For security purposes, you can only request this after": "Por segurança, aguarde antes de tentar novamente.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "Unable to validate email address: invalid format": "Formato de e-mail inválido.",
  "Signup requires a valid password": "É necessário informar uma senha válida.",
  "To signup, please provide your email": "É necessário informar um e-mail para cadastro.",
  "New password should be different from the old password": "A nova senha deve ser diferente da senha atual.",
  "Auth session missing": "Sessão expirada. Faça login novamente.",
  "User not found": "Usuário não encontrado.",
  "Token has expired or is invalid": "Link expirado ou inválido. Solicite um novo.",
  "Access token expired": "Sessão expirada. Faça login novamente.",
  "Refresh token not found": "Sessão expirada. Faça login novamente.",
  "Invalid Refresh Token": "Sessão expirada. Faça login novamente.",
  "OAuth error": "Erro ao autenticar com provedor externo.",
  "Provider not found": "Provedor de autenticação não encontrado.",
  "User banned": "Esta conta foi suspensa.",
  "Password is known to be weak and easy to guess": "Esta senha é conhecida por ser fraca e fácil de adivinhar. Escolha uma senha diferente.",
  "Password is too weak": "Senha muito fraca. Escolha uma senha mais forte.",
  "Password is too short": "Senha muito curta.",
  "pwned": "Esta senha foi encontrada em vazamentos de dados. Escolha uma senha diferente.",
  "Password should contain": "A senha deve conter caracteres mais variados (letras, números e símbolos).",
  "weak_password": "Esta senha é conhecida por ser fraca e fácil de adivinhar. Escolha uma senha diferente.",
  "Email link is invalid or has expired": "Link expirado ou inválido. Solicite um novo.",
  "same_password": "A nova senha deve ser diferente da senha atual.",
  "Database error saving new user": "Erro ao salvar o novo usuário. Tente novamente em alguns instantes.",
};

export function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return message;
}
