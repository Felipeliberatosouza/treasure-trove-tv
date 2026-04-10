import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Create auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email: "carlos.silva@teste.com",
    password: "Teste@123",
    email_confirm: true,
    user_metadata: {
      name: "Carlos Silva",
      role: "teacher",
      bio: "Professor de Matemática e Física com mais de 10 anos de experiência. Mestre em Educação pela USP. Apaixonado por ensinar e transformar vidas através do conhecimento.",
      expertise_area: "Matemática, Física, Cálculo",
      birth_date: "1988-05-15",
      phone: "11987654321",
    },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  const userId = data.user.id;

  // Update profile with avatar and extra data
  await supabase.from("profiles").update({
    avatar_url: "https://uzhajthlokwglujtgmgm.supabase.co/storage/v1/object/public/avatars/carlos-silva%2Favatar.jpg",
    bio: "Professor de Matemática e Física com mais de 10 anos de experiência. Mestre em Educação pela USP. Apaixonado por ensinar e transformar vidas através do conhecimento.",
    expertise_area: "Matemática, Física, Cálculo",
    areas: ["Matemática", "Física", "Cálculo"],
    phone: "11987654321",
    birth_date: "1988-05-15",
    profile_title: "Professor de Matemática e Física",
  }).eq("user_id", userId);

  return new Response(JSON.stringify({ success: true, userId }), {
    headers: { "Content-Type": "application/json" },
  });
});
