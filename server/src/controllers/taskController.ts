import { Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { AuthRequest } from "../middleware/authMiddleware";

const statusValues = ["todo", "in_progress", "done"] as const;
const priorityValues = ["low", "medium", "high"] as const;

const parseId = (value: string | string[] | undefined) => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  status: z.enum(statusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be in YYYY-MM-DD format")
    .optional(),
});

const updateTaskSchema = createTaskSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

const listQuerySchema = z.object({
  status: z.enum(statusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// CREATE
export const createTask = async (req: AuthRequest, res: Response) => {
  const projectId = parseId(req.params.projectId);
  if (!projectId) return res.status(400).json({ message: "Invalid project id" });

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const { title, description, status, priority, due_date } = parsed.data;

  try {
    const project = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, req.userId]
    );
    if (!project.rows[0]) {
      return res.status(404).json({ message: "Project not found" });
    }

    const result = await pool.query(
      `INSERT INTO tasks (project_id, user_id, title, description, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        req.userId,
        title,
        description ?? null,
        status ?? "todo",
        priority ?? "medium",
        due_date ?? null,
      ]
    );
    return res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// READ (list with filters + pagination)
export const getTasks = async (req: AuthRequest, res: Response) => {
  const projectId = parseId(req.params.projectId);
  if (!projectId) return res.status(400).json({ message: "Invalid project id" });

  const parsedQuery = listQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: parsedQuery.error.issues[0].message });
  }

  const { status, priority, page, limit } = parsedQuery.data;

  try {
    const project = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, req.userId]
    );
    if (!project.rows[0]) {
      return res.status(404).json({ message: "Project not found" });
    }

    const conditions = ["project_id = $1", "user_id = $2"];
    const values: unknown[] = [projectId, req.userId];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (priority) {
      values.push(priority);
      conditions.push(`priority = $${values.length}`);
    }

    const where = conditions.join(" AND ");
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tasks WHERE ${where}`,
      values
    );
    const total = Number(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM tasks WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return res.json({
      tasks: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// READ (one)
export const getTaskById = async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid task id" });

  try {
    const result = await pool.query(
      "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
      [id, req.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json({ task: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// UPDATE (partial)
export const updateTask = async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid task id" });

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const fields = Object.entries(parsed.data);
  const setClauses = fields.map(([key], i) => `${key} = $${i + 1}`);
  const values = fields.map(([, value]) => value);

  try {
    const result = await pool.query(
      `UPDATE tasks
       SET ${setClauses.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
       RETURNING *`,
      [...values, id, req.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json({ task: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// DELETE
export const deleteTask = async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid task id" });

  try {
    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json({ message: "Task deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};