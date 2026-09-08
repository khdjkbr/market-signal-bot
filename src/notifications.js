export const formatSignalMessage = ({ market, symbol, signal, probabilities }) => {
  const marketLabel = market === "spot" ? "SPOT" : "FUTURES";
  return `${marketLabel}\n${symbol}: ${signal}\nРост: ${(probabilities.growth * 100).toFixed(1)}%\nПадение: ${(probabilities.decline * 100).toFixed(1)}%`;
};

const postTelegramMessage = async (chatId, message) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !message) {
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Telegram request failed with HTTP ${response.status}`);
  }
  return true;
};

export const sendTelegramMessageToChat = (chatId, message) => postTelegramMessage(chatId, message);

export const sendTelegramMessage = (message) => postTelegramMessage(process.env.TELEGRAM_CHAT_ID, message);
