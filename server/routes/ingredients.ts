import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";

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

// POST /api/ingredients/consume - 批量消耗食材（烹饪扣库存）
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
      consumed: number;
      unit: string;
      previousStock: string;
      newStock: string;
      matched: boolean;
    }> = [];

    // 2) 逐项匹配 & 扣减
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
        // 解析当前库存数字
        const stockMatch = (matched.amount || "").match(/^([\d.]+)\s*(.*)$/);
        let stockVal = 0;
        let stockUnit = "";
        if (stockMatch) {
          stockVal = parseFloat(stockMatch[1]) || 0;
          stockUnit = stockMatch[2] || "";
        }

        const previousStock = matched.amount || "0";
        const newVal = Math.max(0, stockVal - item.amount);
        const newAmount = `${newVal}${stockUnit || item.unit}`;

        // 更新数据库
        const { error: updateErr } = await supabase
          .from("ingredients")
          .update({ amount: newAmount, updated_at: new Date().toISOString() })
          .eq("id", matched.id)
          .eq("user_id", req.userId!);

        if (updateErr) {
          console.error(`Failed to update ingredient ${matched.name}:`, updateErr.message);
        }

        // 如果扣减后为 0，可选择性删除（保留记录，不删）
        results.push({
          name: item.name,
          consumed: item.amount,
          unit: item.unit,
          previousStock,
          newStock: newAmount,
          matched: true,
        });
      } else {
        // 库存中未找到该食材
        results.push({
          name: item.name,
          consumed: item.amount,
          unit: item.unit,
          previousStock: "无库存",
          newStock: "无库存",
          matched: false,
        });
      }
    }

    res.json({
      success: true,
      consumed: results.filter((r) => r.matched).length,
      notFound: results.filter((r) => !r.matched).length,
      details: results,
    });
  } catch (err: any) {
    console.error("POST /api/ingredients/consume error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
