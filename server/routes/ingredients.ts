import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";
import { calculateConsumption } from "../utils/unitConversion.js";

const router = Router();

// GET /api/ingredients - 获取全部食材
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    let query = supabase.from("ingredients").select("*").eq("user_id", req.userId!).order("created_at", { ascending: false });

    if (category && category !== "全部" && category !== "临期") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];

    // 临期过滤（expiry_days <= 3）
    if (category === "临期") {
      result = result.filter((item: any) => item.expiry_days <= 3);
    }

    // 搜索过滤
    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      result = result.filter((item: any) => item.name.toLowerCase().includes(q));
    }

    // 转换字段名为前端格式
    const formatted = result.map((item: any) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      expiryDays: item.expiry_days,
      category: item.category,
      image: item.image,
      suggestions: item.suggestions || [],
    }));

    res.json(formatted);
  } catch (err: any) {
    console.error("GET /api/ingredients error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingredients - 添加食材
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, amount, expiryDays, category, image, suggestions } = req.body;

    const { data, error } = await supabase
      .from("ingredients")
      .insert({
        user_id: req.userId!,
        name,
        amount,
        expiry_days: expiryDays || 7,
        category: category || "其他",
        image: image || "",
        suggestions: suggestions || [],
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: data.id,
      name: data.name,
      amount: data.amount,
      expiryDays: data.expiry_days,
      category: data.category,
      image: data.image,
      suggestions: data.suggestions || [],
    });
  } catch (err: any) {
    console.error("POST /api/ingredients error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ingredients/:id - 更新食材
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: any = {};

    if (req.body.amount !== undefined) updates.amount = req.body.amount;
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.expiryDays !== undefined) updates.expiry_days = req.body.expiryDays;
    if (req.body.category !== undefined) updates.category = req.body.category;

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("ingredients")
      .update(updates)
      .eq("id", id)
      .eq("user_id", req.userId!)
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      name: data.name,
      amount: data.amount,
      expiryDays: data.expiry_days,
      category: data.category,
      image: data.image,
      suggestions: data.suggestions || [],
    });
  } catch (err: any) {
    console.error("PATCH /api/ingredients error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ingredients/:id - 删除食材
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("ingredients").delete().eq("id", id).eq("user_id", req.userId!);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/ingredients error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingredients/consume - 批量消耗食材（烹饪扣库存，支持智能单位换算）
router.post("/consume", async (req: Request, res: Response) => {
  try {
    const { items } = req.body as {
      items: Array<{ name: string; amount: number; unit: string }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required" });
      return;
    }

    // 1) 读取用户全部库存
    const { data: inventory, error: fetchErr } = await supabase
      .from("ingredients")
      .select("*")
      .eq("user_id", req.userId!);

    if (fetchErr) throw fetchErr;

    const results: Array<{
      name: string;
      consumedDisplay: string;
      previousStock: string;
      newStock: string;
      matched: boolean;
      skipped: boolean;
      reason: string;
    }> = [];

    // 2) 逐项匹配 & 智能扣减
    for (const item of items) {
      if (!item.name || item.amount <= 0) continue;

      // 模糊匹配：优先完全匹配，其次 includes 匹配
      let matched = (inventory || []).find(
        (inv: any) => inv.name === item.name
      );
      if (!matched) {
        matched = (inventory || []).find((inv: any) =>
          inv.name.includes(item.name) || item.name.includes(inv.name)
        );
      }

      if (matched) {
        const previousStock = matched.amount || "0";
        // 将前端传来的 amount+unit 重组为字符串，交给 calculateConsumption
        const consumeStr = `${item.amount}${item.unit}`;
        const result = calculateConsumption(item.name, previousStock, consumeStr);

        if (!result.skipped) {
          const newValStr = result.newStockStr;
          const match = newValStr.match(/^([\d.]+)/);
          const numericVal = match ? parseFloat(match[1]) : 0;

          if (numericVal <= 0) {
            // <= 0 自动删除
            const { error: deleteErr } = await supabase
              .from("ingredients")
              .delete()
              .eq("id", matched.id)
              .eq("user_id", req.userId!);
              
            if (deleteErr) {
              console.error(`Failed to delete ingredient ${matched.name}:`, deleteErr.message);
            }
          } else {
            // 更新剩余数量
            const { error: updateErr } = await supabase
              .from("ingredients")
              .update({ amount: result.newStockStr, updated_at: new Date().toISOString() })
              .eq("id", matched.id)
              .eq("user_id", req.userId!);

            if (updateErr) {
              console.error(`Failed to update ingredient ${matched.name}:`, updateErr.message);
            }
          }
        }

        results.push({
          name: item.name,
          consumedDisplay: result.consumedDisplay,
          previousStock,
          newStock: result.skipped ? previousStock : result.newStockStr,
          matched: true,
          skipped: result.skipped,
          reason: result.reason,
        });

        console.log(
          `[consume] ${item.name}: ${previousStock} → ${result.newStockStr} (${result.reason})`
        );
      } else {
        // 库存中未找到该食材
        results.push({
          name: item.name,
          consumedDisplay: `${item.amount}${item.unit}`,
          previousStock: "无库存",
          newStock: "无库存",
          matched: false,
          skipped: true,
          reason: "库存中未找到该食材",
        });
      }
    }

    const consumed = results.filter((r) => r.matched && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;

    res.json({
      success: true,
      consumed,
      skipped,
      notFound: results.filter((r) => !r.matched).length,
      details: results,
    });
  } catch (err: any) {
    console.error("POST /api/ingredients/consume error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
