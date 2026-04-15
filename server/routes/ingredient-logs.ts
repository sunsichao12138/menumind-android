import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";

const router = Router();

// GET /api/ingredient-logs - 获取食材操作日志
router.get("/", async (req: Request, res: Response) => {
  try {
    const { family_id } = req.query;

    let query = supabase
      .from("ingredient_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (family_id) {
      query = query.eq("family_id", family_id);
    } else {
      query = query.eq("user_id", req.userId!);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 查询用户名称
    const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const nameMap = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      nameMap.set(p.user_id, p.display_name || "用户");
    });

    const result = (data || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      userName: nameMap.get(log.user_id) || "用户",
      familyId: log.family_id,
      action: log.action,
      ingredientName: log.ingredient_name,
      detail: log.detail,
      createdAt: log.created_at,
    }));

    res.json(result);
  } catch (err: any) {
    console.error("GET /api/ingredient-logs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Helper: 写入日志（供其他路由调用）
export async function logIngredientAction(
  userId: string,
  action: string,
  ingredientName: string,
  detail: string,
  familyId?: string | null
) {
  try {
    await supabase.from("ingredient_logs").insert({
      user_id: userId,
      family_id: familyId || null,
      action,
      ingredient_name: ingredientName,
      detail,
    });
  } catch (err: any) {
    console.error("[IngredientLog] Failed to write log:", err.message);
  }
}
