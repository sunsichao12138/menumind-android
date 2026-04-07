import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const uid = "64c96812-f753-4f7e-ab82-663ce9a8fb35";

  // 获取 token
  const { data: userData } = await s.auth.admin.getUserById(uid);
  if (!userData?.user) {
    console.error("用户不存在");
    return;
  }

  // 用本地后端模拟调用
  const port = process.env.SERVER_PORT || 3001;
  const baseUrl = `http://localhost:${port}`;

  // 先获取 session token
  const { data: session } = await s.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email!,
  });

  // 直接用 service role key 模拟（设置 Authorization header）
  console.log("=== 模拟推荐请求 ===");
  console.log("用户:", userData.user.email);

  const { data: ings } = await s.from("ingredients").select("name").eq("user_id", uid);
  console.log("库存:", (ings || []).map(i => i.name).join(", "));

  try {
    const resp = await fetch(`${baseUrl}/api/ai/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "x-user-id": uid,
      },
      body: JSON.stringify({
        peopleCount: "2人",
        prepTime: "30分钟内",
        mealType: "正餐",
        tastePreference: "咸香",
        useInventory: true,
      }),
    });

    if (resp.ok) {
      const recipes = await resp.json();
      console.log("\n=== 推荐结果 ===");
      for (const r of recipes) {
        const have = (r.ingredients?.have || []).map((i: any) => i.name).join(", ");
        const miss = (r.ingredients?.missing || []).map((i: any) => i.name).join(", ");
        console.log("\n" + r.name + " (匹配" + r.matchPercentage + "%)");
        console.log("  理由: " + r.recommendationReason);
        console.log("  已有: " + (have || "无"));
        console.log("  缺少: " + miss);
      }
    } else {
      const err = await resp.text();
      console.log("请求失败:", resp.status, err);
    }
  } catch (e: any) {
    console.log("连接错误:", e.message);
  }
}

run();
