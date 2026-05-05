import { Router, Request, Response } from "express";
import { runRecommend } from "../recommend/pipeline.js";
import { runHomePicks } from "../recommend/homePicks.js";

const router = Router();

// POST /api/ai/recommend - AI 智能推荐菜品（召回 → 排序 → AI 重排）
router.post("/recommend", async (req: Request, res: Response) => {
  try {
    const recipes = await runRecommend({
      userId: req.userId!,
      peopleCount: req.body.peopleCount,
      prepTime: req.body.prepTime,
      mealType: req.body.mealType,
      tastePreference: req.body.tastePreference,
      useInventory: req.body.useInventory,
    });
    res.json(recipes);
  } catch (err: any) {
    console.error("POST /api/ai/recommend error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/home-picks - 首页三菜推荐（纯规则引擎，秒开）
router.get("/home-picks", async (req: Request, res: Response) => {
  try {
    const hour = req.query.hour
      ? parseInt(req.query.hour as string)
      : new Date().getHours();
    const picks = await runHomePicks({ userId: req.userId!, hour });
    res.json(picks);
  } catch (err: any) {
    console.error("GET /api/ai/home-picks error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/recognize-image - 拍照识别食材
router.post("/recognize-image", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ARK_API_KEY;
    // 视觉识别专用模型（Seed-2.0-mini，比 lite 快 12x）
    const modelId = process.env.ARK_VISION_MODEL_ID || "ep-20260407202624-dq5cf";
    const arkEndpoint = process.env.ARK_API_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    if (!apiKey) {
      res.status(500).json({ error: "ARK_API_KEY not configured" });
      return;
    }

    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "No image provided" });
      return;
    }

    console.log(`[AI] Recognizing image, model: ${modelId}, size: ${Math.round(image.length / 1024)}KB`);

    const today = new Date().toISOString().split("T")[0];

    const prompt = `请仔细观察这张照片，识别照片中的食材/食品。

## 要求
1. 识别照片中最主要的一种食材或食品
2. 估算其数量和合适的单位
3. 判断其分类
4. 购买日期默认为今天：${today}
5. 根据食材类型估算合理的保存天数

## 分类选项（只能从以下选择）
蔬菜、水果、蛋奶肉类、海鲜水产、主食干货、豆制品、调料、饮品、零食、其他

## 单位选项（只能从以下选择）
克、千克、个、瓶、盒、袋

## 输出格式（严格JSON，不要markdown标记，不要额外文字）
{"name":"食材名称","category":"分类","amount":"数量","unit":"单位","purchaseDate":"${today}","expiryDays":"天数"}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(arkEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 256,
        thinking: { type: "disabled" },
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[AI] Vision API error (${response.status}):`, errBody);
      res.status(500).json({ error: `Vision API error: ${response.status}` });
      return;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log(`[AI] Vision response: ${text}`);

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonStr);
    console.log(`[AI] Recognized ingredient: ${result.name} (${result.category})`);

    res.json(result);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[AI] Vision recognition timeout");
      res.status(504).json({ error: "识别超时，请重试" });
    } else {
      console.error("[AI] Vision recognition error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/ai/auto-fill - 根据食材名称自动填充分类、存放天数、数量、单位
router.post("/auto-fill", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ARK_API_KEY;
    const modelId = process.env.ARK_MODEL_ID || "doubao-1.5-pro-256k-250115";
    const arkEndpoint = process.env.ARK_API_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    if (!apiKey) {
      res.status(500).json({ error: "ARK_API_KEY not configured" });
      return;
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "食材名称不能为空" });
      return;
    }

    console.log(`[AI] Auto-filling ingredient info for: ${name}`);

    const today = new Date().toISOString().split("T")[0];

    const prompt = `你是一个厨房食材专家。用户输入了一个食材名称："${name.trim()}"。

请根据这个食材名称，自动推断以下信息：

## 分类（只能从以下选择一个）
蔬菜、水果、蛋奶肉类、海鲜水产、主食干货、豆制品、调料、饮品、零食、其他

## 单位（只能从以下选择一个，选最常用的）
克、千克、个、ml、L

## 要求
1. amount：该食材一个人一次购买的常见数量（纯数字）
2. unit：最适合这个食材的计量单位
3. expiryDays：如果该食材适合放冰箱保存，填写冰箱冷藏的预计保存天数；如果不适合放冰箱（如常温调料、干货等），填写常温保存天数（纯数字）
4. purchaseDate：默认今天 ${today}
5. category：最合适的分类

## 严格输出JSON（不要markdown标记，不要额外文字）
{
  "category": "分类",
  "amount": "数量",
  "unit": "单位",
  "expiryDays": "天数",
  "purchaseDate": "${today}"
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(arkEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: "你是一个厨房食材专家，只输出JSON，不要任何额外文字。" },
          { role: "user", content: prompt },
        ],
        max_tokens: 128,
        temperature: 0.3,
        thinking: { type: "disabled" },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AI] Auto-fill API error:", errText);
      res.status(500).json({ error: "AI 服务调用失败" });
      return;
    }

    const data = await response.json() as any;
    let jsonStr = data.choices?.[0]?.message?.content?.trim() || "";

    // 去掉可能的 markdown 包裹
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonStr);
    console.log(`[AI] Auto-filled: ${name} → ${result.category}, ${result.amount}${result.unit}, ${result.expiryDays}天`);

    res.json(result);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[AI] Auto-fill timeout");
      res.status(504).json({ error: "识别超时，请重试" });
    } else {
      console.error("[AI] Auto-fill error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
