import { analyzeSpotPair, formatSpotAnalysis, normalizeSpotPair } from "./spot-analysis.js";
import { sendTelegramMessageToChat } from "./notifications.js";

const HELP = [
  "Отправьте торговую пару для спотового анализа:",
  "SOL/USDT",
  "BTCUSDT",
  "или /spot ETH/USDT",
  "",
  "Бот проверит пару на Bitget Spot и вернёт прогноз на 30 дней.",
].join("\n");

export const handleTelegramUpdate = async (update) => {
  const message = update?.message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;
  if (!text || chatId === undefined) return;

  if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
    await sendTelegramMessageToChat(chatId, HELP);
    return;
  }

  const withoutCommand = text.replace(/^\/spot(?:@\w+)?\s*/i, "");
  const symbol = normalizeSpotPair(withoutCommand);
  if (!symbol) {
    await sendTelegramMessageToChat(chatId, HELP);
    return;
  }

  await sendTelegramMessageToChat(chatId, `SPOT — ${symbol}\nПроверяю пару и готовлю анализ...`);
  try {
    const analysis = await analyzeSpotPair({ symbol, exchange: "bitget" });
    await sendTelegramMessageToChat(chatId, formatSpotAnalysis(analysis));
  } catch (error) {
    await sendTelegramMessageToChat(chatId, `SPOT — ${symbol}\nНе удалось выполнить анализ: ${error.message}`);
  }
};
