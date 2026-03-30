import Anthropic from "@anthropic-ai/sdk";

// Anthropic クライアントのシングルトン（モジュール初期化時に env を読む）
const apiKey = process.env.ANTHROPIC_API_KEY!;

export const anthropic = new Anthropic({ apiKey });
