import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";

const router = Router();

// POST /api/families - 创建家庭
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "家庭名称不能为空" });
      return;
    }

    // 创建家庭
    const { data: family, error: familyErr } = await supabase
      .from("families")
      .insert({ name: name.trim(), owner_id: req.userId! })
      .select()
      .single();

    if (familyErr) throw familyErr;

    // 把创建者加入成员表
    const { error: memberErr } = await supabase
      .from("family_members")
      .insert({ family_id: family.id, user_id: req.userId!, role: "owner" });

    if (memberErr) throw memberErr;

    console.log(`[Family] Created: ${family.name} (${family.id}) by ${req.userId}`);
    res.status(201).json({
      id: family.id,
      name: family.name,
      ownerId: family.owner_id,
      createdAt: family.created_at,
    });
  } catch (err: any) {
    console.error("POST /api/families error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/families/mine - 获取我加入的所有家庭
router.get("/mine", async (req: Request, res: Response) => {
  try {
    const { data: memberships, error } = await supabase
      .from("family_members")
      .select("family_id, role, families(id, name, owner_id, created_at)")
      .eq("user_id", req.userId!);

    if (error) throw error;

    const result = (memberships || []).map((m: any) => ({
      id: m.families.id,
      name: m.families.name,
      ownerId: m.families.owner_id,
      role: m.role,
      createdAt: m.families.created_at,
    }));

    res.json(result);
  } catch (err: any) {
    console.error("GET /api/families/mine error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/families/:id - 获取家庭详情 + 成员列表
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 先验证用户是否属于该家庭
    const { data: membership } = await supabase
      .from("family_members")
      .select("role")
      .eq("family_id", id)
      .eq("user_id", req.userId!)
      .single();

    if (!membership) {
      res.status(403).json({ error: "你不是该家庭的成员" });
      return;
    }

    // 获取家庭信息
    const { data: family, error: familyErr } = await supabase
      .from("families")
      .select("*")
      .eq("id", id)
      .single();

    if (familyErr) throw familyErr;

    // 获取成员列表
    const { data: members, error: membersErr } = await supabase
      .from("family_members")
      .select("user_id, role, joined_at")
      .eq("family_id", id);

    if (membersErr) throw membersErr;

    // 获取成员名称
    const userIds = (members || []).map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => {
      profileMap.set(p.user_id, p);
    });

    const memberList = (members || []).map((m: any) => {
      const profile = profileMap.get(m.user_id);
      return {
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        displayName: profile?.display_name || "用户",
        avatarUrl: profile?.avatar_url || "",
      };
    });

    res.json({
      id: family.id,
      name: family.name,
      ownerId: family.owner_id,
      createdAt: family.created_at,
      members: memberList,
    });
  } catch (err: any) {
    console.error("GET /api/families/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/families/:id/join - 加入家庭
router.post("/:id/join", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查家庭是否存在
    const { data: family, error: familyErr } = await supabase
      .from("families")
      .select("id, name")
      .eq("id", id)
      .single();

    if (familyErr || !family) {
      res.status(404).json({ error: "家庭不存在，请检查ID" });
      return;
    }

    // 检查是否已加入
    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", id)
      .eq("user_id", req.userId!)
      .single();

    if (existing) {
      res.status(409).json({ error: "你已经是该家庭的成员了" });
      return;
    }

    // 加入
    const { error: joinErr } = await supabase
      .from("family_members")
      .insert({ family_id: id, user_id: req.userId!, role: "member" });

    if (joinErr) throw joinErr;

    console.log(`[Family] User ${req.userId} joined family ${family.name} (${id})`);
    res.json({ success: true, familyName: family.name });
  } catch (err: any) {
    console.error("POST /api/families/:id/join error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/families/:id/leave - 退出家庭
router.delete("/:id/leave", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查是否是 owner
    const { data: membership } = await supabase
      .from("family_members")
      .select("role")
      .eq("family_id", id)
      .eq("user_id", req.userId!)
      .single();

    if (!membership) {
      res.status(404).json({ error: "你不是该家庭的成员" });
      return;
    }

    if (membership.role === "owner") {
      // Owner 退出 = 解散家庭
      await supabase.from("family_members").delete().eq("family_id", id);
      await supabase.from("families").delete().eq("id", id);
      console.log(`[Family] Owner ${req.userId} disbanded family ${id}`);
      res.json({ success: true, disbanded: true });
    } else {
      // 普通成员退出
      await supabase
        .from("family_members")
        .delete()
        .eq("family_id", id)
        .eq("user_id", req.userId!);
      console.log(`[Family] User ${req.userId} left family ${id}`);
      res.json({ success: true, disbanded: false });
    }
  } catch (err: any) {
    console.error("DELETE /api/families/:id/leave error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
