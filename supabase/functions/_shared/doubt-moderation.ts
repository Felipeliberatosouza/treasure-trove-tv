// Moderação automática das mensagens do chat de dúvidas.
// Bloqueia troca de contatos (telefone, e-mail, sites, redes sociais) e
// linguagem ofensiva. A lista de palavrões é configurável pelo administrador.

export interface ModerationResult {
  blocked: boolean
  reason: string | null
  matches: string[]
}

const DEFAULT_BAD_WORDS = [
  'porra', 'caralho', 'merda', 'buceta', 'foda-se', 'foda se', 'fodase',
  'puta', 'putaria', 'viado', 'bicha', 'corno', 'arrombado', 'desgraçado',
  'vagabundo', 'vagabunda', 'imbecil', 'idiota', 'burro', 'retardado',
  'otario', 'otário', 'cuzao', 'cuzão', 'piranha', 'escroto', 'babaca',
]

/** Remove acentos, normaliza leetspeak e separadores usados para disfarçar. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0@]/g, (c) => (c === '0' ? 'o' : 'a'))
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
}

const CONTACT_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'e-mail', re: /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\barroba\b)\s*[a-z0-9.-]+\s*(\.|\bponto\b)\s*[a-z]{2,}/gi },
  { label: 'endereço de site', re: /\b(?:https?:\/\/|www\.)\S+/gi },
  { label: 'endereço de site', re: /\b[a-z0-9-]+\s*(?:\.|\bponto\b)\s*(?:com|com\.br|net|br|org|io|me)\b/gi },
  // Telefone: exige DDD entre parênteses, prefixo +55, celular iniciado em 9
  // ou uma sequência longa de dígitos. Evita casar anos como "2019 2020".
  { label: 'telefone', re: /\(\d{2}\)\s*9?\d{4}[\s.-]?\d{4}\b/g },
  { label: 'telefone', re: /\+?55[\s.-]*\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]?\d{4}\b/g },
  { label: 'telefone', re: /\b9\d{4}[\s.-]?\d{4}\b/g },
  { label: 'telefone', re: /\b\d{10,13}\b/g },
  { label: 'telefone', re: /\b(?:whats\s*app|whatsapp|zap|telegram|instagram|insta|facebook|tiktok)\b\s*[:\-]?\s*[@\w.+]{3,}/gi },
  { label: 'perfil de rede social', re: /(^|\s)@[a-z0-9._]{3,}/gi },
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function moderateDoubtText(
  text: string,
  blockedWords: string[] = []
): ModerationResult {
  const matches: string[] = []
  let reason: string | null = null

  for (const { label, re } of CONTACT_PATTERNS) {
    const found = text.match(re)
    if (found && found.length) {
      matches.push(...found.map((m) => m.trim()))
      reason = `Compartilhamento de contato (${label}) não é permitido no chat de dúvidas.`
    }
  }

  const normalized = normalize(text)
  const words = (blockedWords.length ? blockedWords : DEFAULT_BAD_WORDS).map(normalize)
  // Palavra inteira: evita bloquear "computação" (puta) ou "enviado" (viado).
  const hits = words.filter((w) => {
    if (w.length <= 2) return false
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(w)}($|[^\\p{L}\\p{N}])`, 'u')
    return re.test(normalized)
  })
  if (hits.length) {
    matches.push(...hits)
    reason = 'Linguagem ofensiva não é permitida no chat de dúvidas.'
  }

  return { blocked: reason !== null, reason, matches: [...new Set(matches)].slice(0, 10) }
}

export { DEFAULT_BAD_WORDS }
