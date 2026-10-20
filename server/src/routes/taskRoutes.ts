import { Router } from "express";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../controllers/taskController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/projects/:projectId/tasks", authMiddleware, createTask);
router.get("/projects/:projectId/tasks", authMiddleware, getTasks);
router.get("/tasks/:id", authMiddleware, getTaskById);
router.patch("/tasks/:id", authMiddleware, updateTask);
router.delete("/tasks/:id", authMiddleware, deleteTask);

export default router;