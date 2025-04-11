import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

export function verifyTelegramWebAppData(initData: string, botToken: string) {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
        .sort()
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secretKey = createHmac("sha256", "WebAppData")
        .update(botToken)
        .digest();
    const calculatedHash = createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

    if (calculatedHash !== hash) return null;

    const userStr = params.get("user");
    return userStr ? JSON.parse(userStr) : null;
}