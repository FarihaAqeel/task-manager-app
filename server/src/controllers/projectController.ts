import { Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { AuthRequest } from "../middleware/authMiddleware";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().optional(),
});

const parseId = (value: string | string[] | undefined) => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// CREATE
export const createProject = async (req: AuthRequest, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const { name, description } = parsed.data;

  try {
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.userId, name, description ?? null]
    );
    return res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// READ (all)
export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    return res.json({ projects: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// READ (one)
export const getProjectById = async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid project id" });

  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
      [id, req.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json({ project: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// UPDATE
export const updateProject = async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid project id" });

  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const { name, description } = parsed.data;

  try {
    const result = await pool.query(
      `UPDATE projects
       SET name = $1, description = $2
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name, description ?? null, id, req.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json({ project: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// DELETE
export const deleteProject = async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid project id" });

  try {
    const result = await pool.query(
      "DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json({ message: "Project deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};