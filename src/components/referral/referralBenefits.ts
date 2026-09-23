/**
 * Textos únicos do programa de indicação (Créditos de IA + Cashback).
 * Usados em todas as telas de convite para manter a mesma mensagem.
 */
export const REFERRAL_TITLE = "Convide amigos e ganhe Créditos de IA + Cashback";

export const REFERRAL_RULES = [
  {
    key: "credits",
    title: "Créditos de IA na hora",
    text: "Assim que seu amigo abre o link do convite, os Créditos de IA caem na sua conta.",
  },
  {
    key: "cashback",
    title: "Cashback na primeira compra",
    text: "Quando esse amigo faz a primeira compra, você ganha cashback para usar como desconto.",
  },
] as const;

export const referralSummary = (percent: number, platformName: string) =>
  `Um único convite, dois prêmios: você ganha Créditos de IA quando seu amigo abre o link e ${percent}% de cashback quando ele faz a primeira compra na ${platformName}.`;
