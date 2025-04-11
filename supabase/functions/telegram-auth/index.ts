import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTelegramWebAppData } from "./telegram-utils.ts";

const supabaseUrl = Deno.env.get("https://seckthcbnslsropswpik.supabase.co") ?? "";
const supabaseServiceKey = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2t0aGNibnNsc3JvcHN3cGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNzU3ODMsImV4cCI6MjA1ODc1MTc4M30.JoI03vFuRd-7sApD4dZ-zeBfUQlZrzRg7jtz0HgnJyI") ?? "";
const botToken = Deno.env.get("7738302503:AAGAMhLO30IGu_pgP2mJsf-Y1xSFJ8Na3E8") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
    try {
        const { initData } = await req.json();

        // Проверка initData
        const user = verifyTelegramWebAppData(initData, botToken);
        if (!user) {
            return new Response("Invalid Telegram data", { status: 401 });
        }

        const telegramId = user.id.toString();

        // Проверка пользователя в auth.users
        let { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(`${telegramId}@telegram.local`);
        if (authError && authError.code !== "user_not_found") throw authError;

        if (!authUser) {
            // Создание пользователя
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: `${telegramId}@telegram.local`,
                email_confirm: true,
                user_metadata: { telegram_id: telegramId },
            });
            if (createError) throw createError;

            // Добавление в таблицу users
            const { error: insertError } = await supabase.from("users").insert({
                telegram_id: telegramId,
                channel_link: null,
            });
            if (insertError) throw insertError;

            authUser = newUser;
        }

        // Генерация JWT
        const { data: { session }, error: sessionError } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: `${telegramId}@telegram.local`,
        });
        if (sessionError) throw sessionError;

        return new Response(JSON.stringify({ token: session.access_token }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error:", error);
        return new Response("Server error", { status: 500 });
    }
});
